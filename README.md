# ICS Sentinel

**An AI SOC analyst for industrial networks: detects attacks on Modbus TCP control traffic, then uses Claude to triage every alert into plain English, MITRE ATT&CK for ICS context, and concrete response actions.**

## Why it matters

Operational Technology — the PLCs, RTUs, and SCADA systems that run power
grids, water treatment, and manufacturing — was built for reliability, not
security, and is increasingly targeted (Industroyer, TRITON, the Oldsmar
water incident). Modbus, one of the most common OT protocols, has **no
authentication or encryption**: any device on the network can issue commands
to a PLC. Meanwhile, OT analysts face severe alert fatigue and a shortage of
staff who understand both the protocols and the threat landscape.

ICS Sentinel demonstrates both halves of the answer: detection of
OT-specific attacks, and AI that compresses the triage work that normally
requires a scarce specialist.

## Architecture

```mermaid
flowchart LR
    G[Traffic Source<br/>synthetic Modbus TCP generator] --> D[Detection Engine<br/>rules + statistics]
    D --> A[Alerts]
    A --> M[ATT&CK for ICS<br/>technique mapping]
    M --> T[AI Triage<br/>Claude]
    T --> E[Enriched Incidents]
    E --> R[Analyst Report]
```

## Project status

Built in phases; each phase is a working checkpoint.

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 1 | Modbus TCP frame model + synthetic benign traffic generator | ✅ done |
| 2 | Injectable attack scenarios | ✅ done |
| 3 | Detection engine (rules + statistical baselines) | ⏳ next |
| 4 | MITRE ATT&CK for ICS mapping | planned |
| 5 | AI triage layer (Claude, with mock fallback) | planned |
| 6 | Ranked incident report + full one-command demo | planned |

## Quickstart

Requires Python 3.11+. Phase 1 has **zero dependencies** — no ICS hardware,
no pcaps, nothing to install:

```bash
git clone <this-repo> && cd OT-AI
python -m ics_sentinel.demo                              # benign baseline
python -m ics_sentinel.demo --scenario unauthorized_write
python -m ics_sentinel.demo --scenario all --duration 120 --seed 7
```

Run the tests:

```bash
pip install pytest   # or: pip install -e ".[dev]"
pytest
```

From Phase 5 onward, set `ANTHROPIC_API_KEY` (see `.env.example`) to enable
real AI triage; without it the tool runs end-to-end in a clearly labeled
`[MOCK]` triage mode.

## The simulated plant

A small water-treatment skid, so register values are physically meaningful
rather than random:

- **HMI master** `10.0.0.10` polls two PLCs every 2 s
- **Engineering workstation** `10.0.0.11` — the *only* authorized write source
- **PLC-1 intake** `10.0.0.20` (unit 1) and **PLC-2 storage** `10.0.0.21` (unit 2), each exposing:
  - holding register `40001` — tank level (0–100 %)
  - holding register `40002` — pump setpoint
  - coil `0` — pump on/off

Tank levels evolve under simple pump physics with hysteresis control, so the
polled values are coherent over time — the baseline the later detection
phases will defend.

## Attack scenarios

Five injectable scenarios (`--scenario NAME`, repeatable, or `all`), each
keyed to a detection the engine will need to make:

| Scenario | What happens on the wire | Why it's dangerous |
|----------|--------------------------|--------------------|
| `unauthorized_write` | Pump shut off + setpoint changed by `10.0.0.66` — values look normal, the *source* doesn't | Modbus has no auth: any host can command a PLC |
| `dangerous_setpoint` | Setpoint written to **200%** from the *authorized* EWS (compromised/insider) | Controller chasing an impossible setpoint overflows the tank |
| `recon_scan` | One source sweep-reads 160 register/unit combinations in ~4s, probing units that don't exist | Classic pre-attack enumeration of the process |
| `malformed_frame` | Illegal function codes (0x5A, 0x00) and a corrupt write PDU | Fuzzing / exploit tooling; can crash fragile PLC stacks |
| `replay_flood` | A captured pump-off command replayed 40× in one second, byte-identical | Control flooding / DoS without ever cracking anything |

Frames carry a ground-truth `label` for testing and demo annotation only —
the detection engine never sees it.

```
08:00:12.041  10.0.0.10 → 10.0.0.20 [unit 1] txn=38    Read Holding Registers       addr=40002 ← 49
08:00:12.049  10.0.0.66 → 10.0.0.20 [unit 1] txn=1     Write Single Coil            addr=0 → 0  ⚠ ATTACK[unauthorized_write]
08:00:13.327  10.0.0.66 → 10.0.0.20 [unit 1] txn=2     Write Single Register        addr=40002 → 30  ⚠ ATTACK[unauthorized_write]
08:00:14.018  10.0.0.10 → 10.0.0.21 [unit 2] txn=47    Read Holding Registers       addr=40002 ← 62
```

## Sample output (Phase 1)

```
ICS Sentinel — synthetic Modbus TCP traffic (benign baseline)
HMI master 10.0.0.10 polling PLC-1 intake (10.0.0.20, unit 1), PLC-2 storage (10.0.0.21, unit 2); writes only from EWS 10.0.0.11
----------------------------------------------------------------------------------------------------
08:00:00.011  10.0.0.10 → 10.0.0.20 [unit 1] txn=1     Read Holding Registers       addr=40001 ← 64
08:00:00.046  10.0.0.10 → 10.0.0.20 [unit 1] txn=2     Read Holding Registers       addr=40002 ← 55
08:00:00.053  10.0.0.10 → 10.0.0.20 [unit 1] txn=3     Read Coils                   addr=0 ← 0
08:00:00.525  10.0.0.11 → 10.0.0.20 [unit 1] txn=1     Write Single Register        addr=40002 → 49  [EWS write]
08:00:02.001  10.0.0.10 → 10.0.0.20 [unit 1] txn=7     Read Holding Registers       addr=40001 ← 63
...
----------------------------------------------------------------------------------------------------
181 frames over 58.0s — 180 reads / 1 writes — sources: 10.0.0.10 (180), 10.0.0.11 (1)
```

## Scope & limitations

This is a weekend-sized portfolio build, deliberately scoped:

- Modbus TCP only (DNP3, S7comm, OPC-UA are future work)
- Statistical baselines, not trained ML models
- In-memory state, no database, no deployment tooling
- Synthetic traffic is the primary source; real pcap ingestion is a stretch goal

See `DESIGN.md` for detection rationale and `demo/README.md` for the demo
assets to record once Phase 6 lands.
