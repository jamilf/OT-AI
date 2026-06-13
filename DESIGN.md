# ICS Sentinel — Design Notes

Living document; grows with each phase. Phase 1 sections below.

## Why frames are typed objects, not bytes

The core demo must run on any laptop with no hardware, no pcaps, and no raw
sockets. A Modbus TCP transaction is therefore modeled as a frozen dataclass
(`ics_sentinel/modbus.py`) carrying exactly the fields a passive monitor
would extract from the wire: transaction ID, unit ID, function code,
address, values, endpoints, timestamp. One frame represents a completed
request/response pair — for reads, `values` is what the slave returned; for
writes, what the master sent. This is a deliberate simplification (a real
sensor sees two packets per transaction) that keeps the detection logic
focused on semantics rather than reassembly. A `scapy`-based pcap ingestion
path can later populate the same dataclass, leaving everything downstream
unchanged.

`function_code` is a plain `int` rather than the `FunctionCode` enum so
Phase 2 can inject illegal codes — the malformed-frame detection needs
traffic the type system would otherwise forbid.

Each frame also carries a ground-truth `label` ("benign" or, later, an
attack-scenario name). Labels exist only for tests and demo annotation; the
detection engine never reads them — detections must earn their alerts from
the traffic itself.

## Why the generator simulates physics

Random register values would make the later "process safety violation" and
anomaly detections meaningless — there would be no normal to violate. So the
generator (`ics_sentinel/generator.py`) runs a minimal water-tank model per
PLC: the pump fills the tank toward a setpoint under hysteresis control
while downstream demand drains it. Polled values are therefore coherent over
time (levels oscillate a few percent around setpoint), giving Phase 3 a
realistic baseline and making out-of-range writes physically interpretable
("setpoint forced to 200% — the tank will overflow").

Benign traffic shape mirrors real SCADA behavior:

- the HMI polls each PLC on a fixed cadence (2 s) with small jitter,
- transaction IDs increase monotonically per master, as a real TCP stack
  would produce,
- writes are rare, come *only* from the engineering workstation IP, and stay
  within the configured operating envelope.

All of this is seeded (`random.Random(seed)`) and starts from a fixed
simulation epoch, so every run, test, and README sample is reproducible.

## Single source of truth: `config.py`

Topology (HMI/EWS/PLC addresses), the register map, safe value ranges, and
traffic cadence live in one module. Phase 3's rules (write allowlist, safe
ranges, scan thresholds) will read the same constants the generator uses —
preventing the classic demo bug where detector and simulator drift apart.

## Attack scenarios (Phase 2)

Each scenario is a generator method returning a labeled frame list, spliced
into the benign baseline by timestamp (`merge_streams`). Tests assert that
the benign portion of a mixed stream is byte-identical to a pure benign run
with the same seed — attacks compose without perturbing the baseline.

Two deliberate design choices:

- **Each scenario isolates one detection signal.** `unauthorized_write`
  writes perfectly ordinary *values* from the wrong *source*;
  `dangerous_setpoint` writes an impossible value from the *authorized*
  workstation (a compromised-EWS/insider story). This keeps Phase 3's rules
  honest — one rule fires per scenario, and tests can pin that down. The
  scenarios still compose (`--scenario all`) for the full-pipeline demo.
- **Replay frames are byte-identical**, including the transaction ID — only
  the observation timestamp differs, exactly what a capture-and-replay tool
  produces on an unauthenticated protocol. The frequency anomaly (40 writes
  in 1 s vs. minutes apart at baseline) is the detectable signal.

One simplification: attack frames are wire events only — a `dangerous_setpoint`
write does not actually move the simulated tank. Feeding attacks back into
the physics would make detection-on-consequences possible (interesting
future work) but isn't needed to demonstrate detection-on-traffic.

## Detection choices (Phase 3)

Every rule is tested *both ways*: it must fire on its attack scenario and
stay silent on benign streams across multiple seeds and a 10-minute run.
False-positive discipline is the difference between a detector and a noise
generator — in a real plant, a noisy OT IDS gets unplugged.

- **R1 write-source allowlist.** On a protocol with no authentication, source
  identity is the only authorization signal that exists. An allowlist of
  control sources is exactly what real OT network monitoring does (and why
  OT networks are supposed to be segmented).
- **R2 safe-range check.** OT security's distinguishing feature is *physical*
  consequence. Encoding the process engineer's safe operating envelope turns
  a generic "write event" into "this command can overflow the tank" —
  detectable even when the source is the legitimate workstation (insider /
  compromised-EWS case).
- **R3 scan window.** Counts *distinct* (PLC, unit, register) points per
  source in a sliding window. Benign polling touches exactly 6 points, so
  the threshold (12) has enormous margin; an enumeration sweep touches 160
  in seconds. Distinct-point counting (not frame counting) is what separates
  a fast poller from a scanner.
- **R4 structural validation.** Healthy Modbus stacks never emit undefined
  function codes or wrong-arity PDUs. Anything structurally invalid is
  fuzzing, exploit tooling, or corruption — all reportable.
- **R5 statistical write-rate baseline.** Writes are bucketed per source per
  second; a bucket alerts when it exceeds the mean + 3σ of *all other*
  buckets (leave-one-out, so a flood can't inflate its own threshold), with
  a small floor (5) because the benign baseline has near-zero variance and a
  degenerate σ would otherwise flag a second write. This is the "simple
  statistics, no ML" sweet spot: defensible math, one tunable constant.

**Alert coalescing.** Repeated identical findings within a window merge into
one alert with a `count`, and flood buckets merge across boundaries — a
40-frame replay yields 2 alerts (one R1 with count 40, one R5), not 41.
Alert volume is the thing that kills real SOCs; the design treats it as a
first-class concern (and it cuts LLM triage calls ~20×).

## ATT&CK for ICS mapping rationale (Phase 4)

A detection rule observes a *wire pattern*; the mapped technique is the
adversary behavior that produces that pattern:

| Rule | Technique(s) | Why |
|---|---|---|
| R1 | T0855 Unauthorized Command Message | A command not from the EWS is, by definition, an unauthorized command message. |
| R2 | T0836 Modify Parameter + T0831 Manipulation of Control | The write modifies an operating parameter; the consequence of the controller chasing it is manipulation of the physical process. Both tagged because responders care about cause *and* effect. |
| R3 | T0846 Remote System Discovery | Register/unit sweeps are how an adversary discovers PLCs and maps the process pre-attack. |
| R4 | T0814 Denial of Service | Illegal codes/corrupt PDUs crash fragile PLC protocol stacks — a classic ICS DoS vector (and fuzzing precursor). |
| R5 | T0814 + T0855 | A replay burst both floods the controller (denial of control) and hammers it with commands the operator never issued. |

T0856 (Spoof Reporting Message) is deliberately *not* claimed: we don't
simulate falsified responses, and mapping techniques you can't actually
detect is how ATT&CK coverage tables lose credibility.

## AI triage design (Phase 5)

- **Structure is forced, parsing is defensive.** Claude is prompted to return
  a single JSON object with a fixed schema; the parser strips code fences,
  locates the outermost braces, validates severity against the enum, retries
  once with a format reminder, and finally falls back to the mock template.
  The demo can never be broken by the AI layer (hard requirement).
- **Context is the differentiator.** Each request carries the plant's process
  context (topology, register semantics, safe ranges) and the alert's ATT&CK
  candidates — so the model can reason "register 40002 is a pump setpoint
  and 200 overflows the tank," not just "a write happened." Severity is
  explicitly anchored to physical-process impact first.
- **Mock mode is honest.** Templates state outright that severity is
  heuristic, and every output is labeled `[MOCK]` vs `[AI]` end to end.
- Model: `claude-opus-4-8` (current recommended default), overridable via
  `ICS_SENTINEL_MODEL`; key only ever read from `ANTHROPIC_API_KEY`.

## Reporting (Phase 6)

One renderer choice per the scope guardrails: a terminal report (no web
dashboard). `rich` draws an at-a-glance overview table plus severity-ranked
incident panels, Critical first; a small plain-text fallback keeps the
zero-dependency promise when `rich` isn't installed (and is reachable on
demand via `--plain` / `force_plain=True`). Both label the triage mode
prominently. Markdown and SIEM-shaped JSON exporters (`--output`) render the
same ranked content for hand-off.

## Refinement (v1.1)

Post-v1 work, each addition kept to the same two-sided-test discipline.

- **R6 conflicting-duplicate response (T0856).** The `response_spoof`
  scenario injects a second answer per poll with the tank level frozen while
  the real value moves (the Stuxnet operator-blinding move). R6 groups frames
  by `(src, dst, unit, fc, address, txn_id)` and fires when two within a 5 s
  window carry *different* values. The window guards 16-bit txn-id
  wraparound; the conflict requirement is exactly what separates a spoof from
  a byte-identical replay — a test asserts `replay_flood` does **not** fire R6.
- **Learned baselines (`--baseline`).** `learn_baseline()` derives the scan
  and flood thresholds from a clean sample (busiest observed distinct-point
  window ×2, busiest write bucket ×3) and never learns *looser* than the
  static config floor. On the quiet benign baseline it actually tightens the
  flood floor. Tested to stay silent on its own training traffic yet still
  catch every scenario.
- **Incident correlation.** `correlate()` groups alerts by source IP — on an
  OT segment the source *is* the actor, so one host's scan→write→flood is one
  incident, not ten tickets. This is the unit of triage now: the demo's 11
  alerts become 3 incidents (3 LLM calls instead of 11), and the model
  reasons about the whole campaign at once. Mock severity is led by the most
  dangerous member with actions/techniques merged across rules.
- **Structured outputs + cost.** The AI path attempts schema-enforced JSON
  (`output_config.format`) and degrades to prompt-instructed JSON on older
  SDKs/models (rejection matched by exception name so `anthropic` need not be
  importable in mock/test runs); `extract_json` remains the universal net.
  Token usage is accumulated for the demo's cost line.
- **Real pcap ingestion (`--pcap`).** `load_pcap()` parses captured Modbus
  TCP into the *same* `ModbusFrame` objects, pairing requests/responses by
  transaction so the entire downstream pipeline is source-agnostic. scapy is
  an optional extra, lazily imported.
