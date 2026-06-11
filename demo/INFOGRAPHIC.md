# ICS Sentinel — Infographic Brief

Source content for generating a one-page infographic (designer hand-off or
AI image-generation prompt). All numbers are from a real default run
(`python -m ics_sentinel.demo`, seed 42, 60s window) and verified by tests.

---

## 1. Title block

- **Title:** ICS Sentinel
- **Tagline:** An AI SOC analyst for industrial networks
- **One-liner:** Detects attacks on unauthenticated Modbus TCP control
  traffic, then uses Claude to triage every alert into plain English, MITRE
  ATT&CK for ICS context, and concrete response actions.
- **Hook stat (callout):** Modbus has **no authentication and no
  encryption** — any device on the network can command a PLC.

## 2. The core visual: 5-stage pipeline (left → right)

This is the centerpiece. One horizontal flow, five nodes:

| # | Stage | Icon idea | Caption (short) | Caption (detail) |
|---|-------|-----------|-----------------|------------------|
| 1 | **Traffic** | water tank / PLC cabinet | Simulated plant traffic | Synthetic Modbus TCP: an HMI polling 2 PLCs on a water-treatment skid, plus 5 injectable attack scenarios. 387 frames in 60s. |
| 2 | **Detection** | radar / magnifying glass | 5 rules + statistics | Allowlist, safe-range, scan-window, structural validation, mean+3σ rate baseline. 387 frames → **10 alerts**. |
| 3 | **ATT&CK mapping** | crosshair matrix / grid | MITRE ATT&CK for ICS | Each alert tagged with real adversary techniques: T0855, T0836, T0831, T0846, T0814. |
| 4 | **AI triage** | brain / chat spark | Claude as the analyst | Severity + justification, operator-plain-English explanation, attack narrative, ordered response actions, false-positive likelihood. Mock fallback if no API key. |
| 5 | **Report** | ranked list / dashboard | Ranked incident report | Critical first. One executive summary tells the incident story across all alerts. |

Funnel framing for the flow (numbers shrink left to right — visualize as a
narrowing funnel): **387 frames → 10 alerts → 1 Critical incident → 1
executive summary**.

## 3. The plant (small network diagram)

A mini map of the monitored network — five nodes:

- 🖥️ **HMI master** `10.0.0.10` — polls every 2s, never writes
- 🔧 **Engineering workstation** `10.0.0.11` — the ONLY authorized write source
- 🏭 **PLC-1 intake** `10.0.0.20` (unit 1) and 🏭 **PLC-2 storage** `10.0.0.21` (unit 2)
  - register `40001` = tank level (0–100%)
  - register `40002` = pump setpoint (safe range **20–90**)
  - coil `0` = pump on/off
- 💀 **Attacker** `10.0.0.66` — compromised host on the OT segment

Visual cue: green arrows (HMI polls, EWS writes) vs red arrows (attacker
traffic). Tank levels follow real pump physics (hysteresis control), so the
baseline is physically coherent — not random noise.

## 4. Five attacks vs five detections (matchup table)

Render as 5 paired rows: attack (red, left) ⚔️ detection (blue, right), with
the ATT&CK ID as a badge.

| Attack | What it looks like on the wire | Caught by | ATT&CK badge |
|---|---|---|---|
| **Unauthorized write** | Normal-looking commands… from the wrong host | Write-source allowlist | T0855 |
| **Dangerous setpoint** | Pump setpoint forced to **200%** — from the *authorized* workstation (insider/compromised) | Safe-range check | T0836 + T0831 |
| **Recon scan** | **160** register/unit probes in ~4 seconds (benign polling touches 6 points) | Distinct-points window (threshold 12) | T0846 |
| **Malformed frames** | Illegal function codes (0x5A, 0x00), corrupt payloads | Structural validation | T0814 |
| **Replay flood** | One captured command replayed **40×/second**, byte-identical | Statistical rate baseline (mean+3σ) | T0814 + T0855 |

Severity outcome of the default run (small stacked bar or donut):
**1 Critical · 5 High · 4 Medium · 0 Low**.

## 5. The AI triage card (show one real example)

Reproduce the Critical incident as a styled "analyst card":

> **[CRITICAL] ALT-003 — Process safety violation**
> `10.0.0.11 → 10.0.0.21` · Write Single Register · addr 40002 · value **200**
> **ATT&CK:** T0836 Modify Parameter · T0831 Manipulation of Control
> **Operator view:** "A command set the pump setpoint to 200, far outside the
> safe range. If the controller obeys it, the tank can overflow or the pump
> can be damaged."
> **Action 1:** Verify the setpoint on the PLC and restore a safe value via local HMI
> **Action 2:** Quarantine the source workstation pending forensic review
> **False-positive likelihood:** Low

Add the mode badge: 🟢 `[AI]` triage by Claude / 🟡 `[MOCK]` deterministic
fallback — the demo never breaks without an API key.

## 6. Proof points (stat strip along the bottom)

- **0** false positives on benign traffic (tested across seeds + a 10-minute stream)
- **40× replay → 2 alerts**, not 41 (alert coalescing; ~20× fewer LLM calls)
- **75** pytest tests
- **0** dependencies to run the demo (Python 3.11+ stdlib; `rich` + `anthropic` optional)
- **1 command:** `python -m ics_sentinel.demo`

## 7. Suggested visual language

- **Palette:** dark slate background; industrial safety colors — alert red
  `#D64541`, warning amber `#F5A623`, OK green `#2ECC71`, OT/ICS blue
  `#2C82C9`; severity ramp red → amber → yellow → green.
- **Typography:** monospace for IPs, register numbers, technique IDs;
  bold sans for stage names.
- **Motifs:** PLC/tank pictograms, terminal-style panels (the real output is
  a terminal report), MITRE technique IDs as rounded badges, red "attacker"
  node visually outside a dashed trust boundary.
- **Layout suggestion (top to bottom):** title block → pipeline funnel →
  plant map + attack/detection matchup side by side → AI triage card →
  stat strip.

## 8. Ready-to-use generation prompt

> A clean, dark-themed technical infographic titled "ICS Sentinel — an AI SOC
> analyst for industrial networks." A horizontal 5-stage pipeline (Traffic →
> Detection → ATT&CK Mapping → AI Triage → Report) drawn as a narrowing
> funnel labeled 387 frames → 10 alerts → 1 critical incident. Below it: a
> small OT network map (HMI, engineering workstation, two PLCs with a water
> tank, and a red attacker node at 10.0.0.66 outside a dashed trust
> boundary), beside a table pairing five attacks with the five detection
> rules that catch them, each tagged with MITRE ATT&CK badges (T0855, T0836,
> T0831, T0846, T0814). A highlighted "Critical incident" analyst card shows
> a pump setpoint forced to 200% with recommended response actions. Bottom
> stat strip: 0 false positives, 75 tests, 0 dependencies, 1 command.
> Industrial safety palette (slate, red, amber, blue), monospace accents,
> terminal-panel styling.
