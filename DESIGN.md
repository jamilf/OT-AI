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

## Looking ahead

- **Phase 2** splices labeled attack frame lists into the benign baseline via
  `generator.merge_streams`, so scenarios compose without touching the
  benign path.
- **Phase 3** detections will be tested both ways: each rule must fire on its
  attack scenario *and* stay silent on a pure benign stream — false-positive
  discipline is the difference between a detector and a noise generator.
