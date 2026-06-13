# ICS Sentinel — Incident Report

3 incident(s) · 11 alert(s) · triage mode: `[MOCK]` deterministic triage (no API key)

## Executive summary

3 incident(s) (1 Critical, 2 High) comprising 11 alert(s), from 10.0.0.10, 10.0.0.11, 10.0.0.66. Activity from 10.0.0.66 forms a coherent intrusion: reconnaissance and/or direct process commands from a host with no business issuing them. Recommended priority: isolate 10.0.0.66, verify PLC state, then investigate any anomalies from authorized hosts.

## [Critical] INC-02 — actor `10.0.0.11` (1 alerts) `[MOCK]`

**Window:** 2026-01-05 08:00:18 UTC → 08:00:18

| Alert | Time | Rule | Command | ATT&CK |
|---|---|---|---|---|
| ALT-003 | 08:00:18 | Process safety violation | Write Single Register → 10.0.0.21 [unit 2] addr 40002 values [200] | [T0836](https://attack.mitre.org/techniques/T0836/), [T0831](https://attack.mitre.org/techniques/T0831/) |

**Severity:** Critical — Deterministic template severity led by rule R2-SAFETY (no API key — heuristic, not model-reasoned).

**What happened (operator view):** A command set Write Single Register at 10.0.0.21 to 200, far outside the safe operating range. If the controller obeys it, the tank can overflow or the pump can be damaged.

**Attack narrative:** Forcing an impossible setpoint is direct process manipulation — the attacker (or a compromised authorized workstation) is trying to cause physical damage or a plant shutdown.

**Confirmed techniques:**
- T0836: mapped from rule R2-SAFETY (Modify Parameter)
- T0831: mapped from rule R2-SAFETY (Manipulation of Control)

**Recommended actions:**
1. Immediately verify the current setpoint on the PLC and restore a safe value via local HMI
2. Isolate or quarantine the source workstation 10.0.0.11 pending forensic review
3. Place the affected loop in manual/local control until cleared
4. Review change-management records for any legitimate work order

*False-positive likelihood: Low — Template assessment based on rule type; benign traffic does not produce this wire pattern in the simulated plant.*

## [High] INC-01 — actor `10.0.0.66` (9 alerts) `[MOCK]`

**Window:** 2026-01-05 08:00:12 UTC → 08:00:36

| Alert | Time | Rule | Command | ATT&CK |
|---|---|---|---|---|
| ALT-001 | 08:00:12 | Unauthorized write source | Write Single Coil → 10.0.0.20 [unit 1] addr 0 values [0] | [T0855](https://attack.mitre.org/techniques/T0855/) |
| ALT-002 | 08:00:13 | Unauthorized write source | Write Single Register → 10.0.0.20 [unit 1] addr 40002 values [30] | [T0855](https://attack.mitre.org/techniques/T0855/) |
| ALT-004 | 08:00:24 | Reconnaissance / enumeration scan | Read Holding Registers → 10.0.0.20 [unit 1] addr 40012 values [0] | [T0846](https://attack.mitre.org/techniques/T0846/) |
| ALT-005 | 08:00:30 | Illegal or malformed frame | Illegal Function (90) → 10.0.0.20 [unit 1] addr 40001 values [1] | [T0814](https://attack.mitre.org/techniques/T0814/) |
| ALT-006 | 08:00:30 | Illegal or malformed frame | Illegal Function (0) → 10.0.0.20 [unit 1] addr 0 values [0] | [T0814](https://attack.mitre.org/techniques/T0814/) |
| ALT-007 | 08:00:30 | Unauthorized write source | Write Single Register → 10.0.0.20 [unit 1] addr 40002 values [60, 61] | [T0855](https://attack.mitre.org/techniques/T0855/) |
| ALT-008 | 08:00:30 | Illegal or malformed frame | Write Single Register → 10.0.0.20 [unit 1] addr 40002 values [60, 61] | [T0814](https://attack.mitre.org/techniques/T0814/) |
| ALT-009 | 08:00:36 | Unauthorized write source | Write Single Coil → 10.0.0.20 [unit 1] addr 0 values [0] ×40 | [T0855](https://attack.mitre.org/techniques/T0855/) |
| ALT-010 | 08:00:36 | Anomalous command frequency | Write Single Coil → 10.0.0.20 [unit 1] addr 0 values [0] ×40 | [T0814](https://attack.mitre.org/techniques/T0814/), [T0855](https://attack.mitre.org/techniques/T0855/) |

**Severity:** High — Deterministic template severity led by rule R1-UNAUTH-WRITE (no API key — heuristic, not model-reasoned).

**What happened (operator view):** 9 related alerts from 10.0.0.66. Most severe: Host 10.0.0.66 sent a control command (Write Single Coil) to PLC 10.0.0.20. That host is not the engineering workstation, and nothing else is allowed to issue commands.

**Attack narrative:** Issuing valid-looking commands from a rogue host is the core move on an unauthenticated protocol: the attacker already has network access and is testing or exercising control over the process. Combined with the other activity from this source (Reconnaissance / enumeration scan, Illegal or malformed frame, Illegal or malformed frame, Illegal or malformed frame, Anomalous command frequency), this reads as a multi-stage intrusion rather than isolated events.

**Confirmed techniques:**
- T0855: mapped from rule R1-UNAUTH-WRITE (Unauthorized Command Message)
- T0846: mapped from rule R3-SCAN (Remote System Discovery)
- T0814: mapped from rule R4-MALFORMED (Denial of Service)
- T0814: mapped from rule R5-FLOOD (Denial of Service)
- T0855: mapped from rule R5-FLOOD (Unauthorized Command Message)

**Recommended actions:**
1. Block 10.0.0.66 at the OT firewall / switch ACL immediately
2. Verify actual PLC state (coil and setpoint) against expected values
3. Identify the device behind 10.0.0.66 and how it reached the control VLAN
4. Hunt for prior reconnaissance from the same source
5. Rate-limit or block 10.0.0.66 at the network boundary
6. Confirm the PLC is responsive and its outputs match expected state

*False-positive likelihood: Low — Template assessment based on rule type; benign traffic does not produce this wire pattern in the simulated plant.*

## [High] INC-03 — actor `10.0.0.10` (1 alerts) `[MOCK]`

**Window:** 2026-01-05 08:00:46 UTC → 08:00:46

| Alert | Time | Rule | Command | ATT&CK |
|---|---|---|---|---|
| ALT-011 | 08:00:46 | Conflicting duplicate response | Read Holding Registers → 10.0.0.20 [unit 1] addr 40001 values [47] ×7 | [T0856](https://attack.mitre.org/techniques/T0856/) |

**Severity:** High — Deterministic template severity led by rule R6-SPOOF (no API key — heuristic, not model-reasoned).

**What happened (operator view):** The monitor saw two different answers for the same poll of 10.0.0.20 — the value on the operator's screen may be falsified while the real process state is different.

**Attack narrative:** Injecting fake 'all is well' readings is how attackers blind operators while manipulating the process (the Stuxnet pattern). Treat current readings from this PLC as untrusted until verified.

**Confirmed techniques:**
- T0856: mapped from rule R6-SPOOF (Spoof Reporting Message)

**Recommended actions:**
1. Verify the actual tank level locally at the PLC / field instrument — do not trust the HMI value
2. Capture traffic and inspect switch ARP/CAM tables for the man-in-the-middle host
3. Fail over the affected loop to local/manual control until the injection path is found
4. Check for concurrent write activity that the spoof may be covering

*False-positive likelihood: Low — Template assessment based on rule type; benign traffic does not produce this wire pattern in the simulated plant.*

