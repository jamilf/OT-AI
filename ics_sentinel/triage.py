"""AI triage layer: Claude as the SOC analyst, with a deterministic fallback.

Each alert (plus its ATT&CK context and the plant's process context) is sent
to Claude, which returns a structured triage: severity with justification, a
plain-English explanation for a plant operator, an attack narrative,
validated ATT&CK techniques, ordered response actions, and a false-positive
assessment. One additional call produces an incident-level executive summary.

When ``ANTHROPIC_API_KEY`` is absent (or the ``anthropic`` package isn't
installed, or the API errors out), the triager falls back to deterministic
templated triage so the demo always runs end-to-end. Every result carries a
``mode`` of ``AI`` or ``MOCK`` and the report labels it prominently.

Claude is prompted to return only JSON and the response is parsed
defensively (code fences stripped, braces located, one retry on malformed
output) rather than relying on newer SDK-side schema enforcement — this
keeps the module working against any installed ``anthropic`` version, and
the mock path is the final safety net either way.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone

from . import config
from .detection import (
    RULE_FLOOD,
    RULE_MALFORMED,
    RULE_SAFETY,
    RULE_SCAN,
    RULE_SPOOF,
    RULE_UNAUTHORIZED_WRITE,
    Alert,
)

SEVERITIES = ("Critical", "High", "Medium", "Low")

#: Current Claude model; override with the ICS_SENTINEL_MODEL env var.
DEFAULT_MODEL = "claude-opus-4-8"

_SEVERITY_RANK = {sev: i for i, sev in enumerate(SEVERITIES)}


@dataclass(frozen=True, slots=True)
class TriageResult:
    """Structured triage verdict for one alert."""

    alert_id: str
    severity: str
    severity_justification: str
    plain_english_explanation: str
    attack_narrative: str
    confirmed_attack_techniques: tuple[str, ...]
    recommended_actions: tuple[str, ...]
    false_positive_likelihood: str
    false_positive_reasoning: str
    mode: str  # "AI" or "MOCK"

    @property
    def severity_rank(self) -> int:
        """0 = Critical … 3 = Low; unknown severities sort last."""
        return _SEVERITY_RANK.get(self.severity, len(SEVERITIES))


# ---------------------------------------------------------------------------
# Defensive JSON parsing
# ---------------------------------------------------------------------------


def extract_json(text: str) -> dict:
    """Pull a JSON object out of model output, tolerating fences and prose."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else ""
        cleaned = cleaned.rsplit("```", 1)[0]
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("no JSON object found in model output")
    data = json.loads(cleaned[start : end + 1])
    if not isinstance(data, dict):
        raise ValueError("model output JSON is not an object")
    return data


def _normalize_severity(raw: object) -> str:
    value = str(raw).strip().title()
    if value not in SEVERITIES:
        raise ValueError(f"invalid severity {raw!r}")
    return value


def _str_tuple(raw: object) -> tuple[str, ...]:
    if isinstance(raw, str):
        return (raw,)
    if isinstance(raw, list):
        return tuple(str(item) for item in raw)
    return ()


def result_from_payload(alert_id: str, payload: dict, mode: str) -> TriageResult:
    """Build a TriageResult from parsed model JSON, validating severity."""
    return TriageResult(
        alert_id=alert_id,
        severity=_normalize_severity(payload["severity"]),
        severity_justification=str(payload.get("severity_justification", "")),
        plain_english_explanation=str(payload.get("plain_english_explanation", "")),
        attack_narrative=str(payload.get("attack_narrative", "")),
        confirmed_attack_techniques=_str_tuple(
            payload.get("confirmed_attack_techniques")
        ),
        recommended_actions=_str_tuple(payload.get("recommended_actions")),
        false_positive_likelihood=str(
            payload.get("false_positive_likelihood", "Unknown")
        ).title(),
        false_positive_reasoning=str(payload.get("false_positive_reasoning", "")),
        mode=mode,
    )


# ---------------------------------------------------------------------------
# Shared prompt context
# ---------------------------------------------------------------------------

PROCESS_CONTEXT = f"""\
Monitored environment: a small water-treatment plant on Modbus TCP (a protocol
with no authentication — any host on the network can command a PLC).
- HMI/SCADA master {config.HMI_IP}: polls the PLCs every {config.POLL_INTERVAL_S:g}s, never writes.
- Engineering workstation {config.EWS_IP}: the ONLY authorized write source.
- PLCs: {", ".join(f"{p.name} ({p.ip}, unit {p.unit_id})" for p in config.PLCS)}.
- Register {config.TANK_LEVEL_REGISTER} = tank level (0-100%%); register \
{config.PUMP_SETPOINT_REGISTER} = pump setpoint (safe operating range \
{config.SAFE_REGISTER_RANGES[config.PUMP_SETPOINT_REGISTER][0]}-\
{config.SAFE_REGISTER_RANGES[config.PUMP_SETPOINT_REGISTER][1]}); coil \
{config.PUMP_RUN_COIL} = pump on/off.
Driving the tank past its limits causes overflow or pump damage — a physical
safety incident, not just an IT incident."""

SYSTEM_PROMPT = f"""You are a senior OT/ICS security analyst triaging alerts \
from a passive Modbus TCP monitoring system.

{PROCESS_CONTEXT}

For each alert you receive, respond with ONLY a single JSON object (no markdown
fences, no prose before or after) with exactly these fields:
- "severity": one of "Critical", "High", "Medium", "Low"
- "severity_justification": 1-2 sentences
- "plain_english_explanation": what happened, in terms a plant operator with no
  security background understands
- "attack_narrative": how this fits an attacker's likely objective and where it
  sits in a plausible kill chain
- "confirmed_attack_techniques": array of strings, each "<ID>: <one-line
  reasoning>", validating (or rejecting) the candidate MITRE ATT&CK for ICS
  techniques attached to the alert
- "recommended_actions": array of concrete, ordered response steps an OT team
  can execute (most urgent first)
- "false_positive_likelihood": one of "Low", "Medium", "High"
- "false_positive_reasoning": 1-2 sentences

Severity should reflect physical-process impact first, classic CIA second."""


def alert_payload(alert: Alert) -> dict:
    """The alert as compact JSON for the model (and for tests)."""
    frame = alert.raw_frame
    return {
        "alert_id": alert.id,
        "rule": f"{alert.rule_id} {alert.rule_name}",
        "time_utc": datetime.fromtimestamp(alert.timestamp, tz=timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z"),
        "source_ip": alert.src_ip,
        "dest_ip": alert.dst_ip,
        "unit_id": frame.unit_id,
        "function": frame.function_name,
        "address": frame.address,
        "values": list(frame.values)[:8],
        "occurrences": alert.count,
        "description": alert.description,
        "candidate_attack_techniques": [str(t) for t in alert.techniques],
    }


# ---------------------------------------------------------------------------
# Deterministic mock triage (the always-works fallback)
# ---------------------------------------------------------------------------

# severity, fp_likelihood, explanation, narrative, actions
_MOCK_PROFILES: dict[str, tuple[str, str, str, str, tuple[str, ...]]] = {
    RULE_SAFETY: (
        "Critical",
        "Low",
        "A command set {function} at {dst} to {values}, far outside the safe "
        "operating range. If the controller obeys it, the tank can overflow "
        "or the pump can be damaged.",
        "Forcing an impossible setpoint is direct process manipulation — the "
        "attacker (or a compromised authorized workstation) is trying to "
        "cause physical damage or a plant shutdown.",
        (
            "Immediately verify the current setpoint on the PLC and restore a "
            "safe value via local HMI",
            "Isolate or quarantine the source workstation {src} pending "
            "forensic review",
            "Place the affected loop in manual/local control until cleared",
            "Review change-management records for any legitimate work order",
        ),
    ),
    RULE_UNAUTHORIZED_WRITE: (
        "High",
        "Low",
        "Host {src} sent a control command ({function}) to PLC {dst}. That "
        "host is not the engineering workstation, and nothing else is "
        "allowed to issue commands.",
        "Issuing valid-looking commands from a rogue host is the core move "
        "on an unauthenticated protocol: the attacker already has network "
        "access and is testing or exercising control over the process.",
        (
            "Block {src} at the OT firewall / switch ACL immediately",
            "Verify actual PLC state (coil and setpoint) against expected "
            "values",
            "Identify the device behind {src} and how it reached the control "
            "VLAN",
            "Hunt for prior reconnaissance from the same source",
        ),
    ),
    RULE_FLOOD: (
        "High",
        "Low",
        "PLC {dst} received {count} identical commands in about a second "
        "from {src}. Normal operations send commands minutes apart.",
        "A replayed command burst either floods the controller (denial of "
        "control) or hammers a state change so operators cannot undo it — "
        "classic capture-and-replay against unauthenticated Modbus.",
        (
            "Rate-limit or block {src} at the network boundary",
            "Confirm the PLC is responsive and its outputs match expected "
            "state",
            "Capture traffic for forensics before clearing the condition",
            "Schedule replay-resistant controls (e.g. protocol gateway) as "
            "follow-up",
        ),
    ),
    RULE_SCAN: (
        "Medium",
        "Medium",
        "Host {src} rapidly read {count_points} across the PLCs, including "
        "addresses and unit IDs that do not exist — like someone rattling "
        "every door handle in the plant.",
        "Enumeration is the staging step: the attacker is mapping registers "
        "and devices to plan a later, targeted manipulation. Expect "
        "follow-on writes if not contained.",
        (
            "Identify and isolate the scanning host {src}",
            "Cross-reference with asset inventory — is this an authorized "
            "scanner?",
            "Raise monitoring sensitivity for write commands in the next "
            "24-48h",
        ),
    ),
    RULE_SPOOF: (
        "High",
        "Low",
        "The monitor saw two different answers for the same poll of {dst} — "
        "the value on the operator's screen may be falsified while the real "
        "process state is different.",
        "Injecting fake 'all is well' readings is how attackers blind "
        "operators while manipulating the process (the Stuxnet pattern). "
        "Treat current readings from this PLC as untrusted until verified.",
        (
            "Verify the actual tank level locally at the PLC / field "
            "instrument — do not trust the HMI value",
            "Capture traffic and inspect switch ARP/CAM tables for the "
            "man-in-the-middle host",
            "Fail over the affected loop to local/manual control until the "
            "injection path is found",
            "Check for concurrent write activity that the spoof may be "
            "covering",
        ),
    ),
    RULE_MALFORMED: (
        "Medium",
        "Medium",
        "Frames from {src} were structurally invalid (illegal function codes "
        "or corrupt payloads). Healthy devices never produce these.",
        "Malformed traffic suggests fuzzing or exploit tooling probing the "
        "PLC's protocol stack — some PLCs crash outright on illegal codes, "
        "making this a denial-of-service precursor.",
        (
            "Block {src} pending investigation",
            "Check PLC diagnostics/uptime for faults or restarts",
            "Verify firmware patch level of exposed PLCs",
        ),
    ),
}


def _mock_triage(alert: Alert) -> TriageResult:
    severity, fp, explanation, narrative, actions = _MOCK_PROFILES[alert.rule_id]
    fields = {
        "src": alert.src_ip,
        "dst": alert.dst_ip,
        "function": alert.raw_frame.function_name,
        "values": ", ".join(str(v) for v in alert.raw_frame.values),
        "count": alert.count,
        "count_points": f"{alert.count if alert.count > 1 else 'many'} points",
    }
    return TriageResult(
        alert_id=alert.id,
        severity=severity,
        severity_justification=(
            f"Deterministic template severity for rule {alert.rule_id} "
            "(no API key — heuristic, not model-reasoned)."
        ),
        plain_english_explanation=explanation.format(**fields),
        attack_narrative=narrative.format(**fields),
        confirmed_attack_techniques=tuple(
            f"{t.technique_id}: mapped from rule {alert.rule_id} ({t.name})"
            for t in alert.techniques
        ),
        recommended_actions=tuple(a.format(**fields) for a in actions),
        false_positive_likelihood=fp,
        false_positive_reasoning=(
            "Template assessment based on rule type; benign traffic does not "
            "produce this wire pattern in the simulated plant."
        ),
        mode="MOCK",
    )


def _mock_summary(alerts: list[Alert], results: list[TriageResult]) -> str:
    by_sev: dict[str, int] = {}
    for r in results:
        by_sev[r.severity] = by_sev.get(r.severity, 0) + 1
    sev_part = ", ".join(
        f"{by_sev[s]} {s}" for s in SEVERITIES if by_sev.get(s)
    )
    sources = sorted({a.src_ip for a in alerts})
    rules = sorted({a.rule_id for a in alerts})
    story = (
        f"{len(alerts)} alert(s) ({sev_part}) across rules {', '.join(rules)}, "
        f"originating from {', '.join(sources)}."
    )
    if config.ATTACKER_IP in sources:
        story += (
            f" Activity from {config.ATTACKER_IP} forms a coherent intrusion: "
            "reconnaissance and/or direct process commands from a host with "
            "no business issuing them. Recommended priority: isolate "
            f"{config.ATTACKER_IP}, verify PLC state, then investigate any "
            "anomalies from authorized hosts."
        )
    return story


# ---------------------------------------------------------------------------
# Triager
# ---------------------------------------------------------------------------


class Triager:
    """Triage alerts with Claude when possible, mock templates otherwise."""

    def __init__(self, model: str | None = None) -> None:
        self.model = model or os.environ.get("ICS_SENTINEL_MODEL", DEFAULT_MODEL)
        self._client = None
        if os.environ.get("ANTHROPIC_API_KEY"):
            try:
                import anthropic

                self._client = anthropic.Anthropic()
            except ImportError:
                pass  # SDK not installed → mock mode

    @property
    def mode(self) -> str:
        return "AI" if self._client is not None else "MOCK"

    def triage(self, alert: Alert) -> TriageResult:
        if self._client is None:
            return _mock_triage(alert)
        try:
            return self._ai_triage(alert)
        except Exception:
            # Whatever the API does, the demo must not break.
            return _mock_triage(alert)

    def triage_all(self, alerts: list[Alert]) -> list[TriageResult]:
        return [self.triage(alert) for alert in alerts]

    def executive_summary(
        self, alerts: list[Alert], results: list[TriageResult]
    ) -> str:
        if not alerts:
            return "No alerts — traffic consistent with the benign baseline."
        if self._client is None:
            return _mock_summary(alerts, results)
        try:
            return self._ai_summary(alerts, results)
        except Exception:
            return _mock_summary(alerts, results)

    # -- AI paths -------------------------------------------------------

    def _ask(self, system: str, user: str, max_tokens: int = 2000) -> str:
        response = self._client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return "".join(
            block.text for block in response.content if block.type == "text"
        )

    def _ai_triage(self, alert: Alert) -> TriageResult:
        prompt = "Triage this alert:\n" + json.dumps(alert_payload(alert), indent=2)
        text = self._ask(SYSTEM_PROMPT, prompt)
        try:
            payload = extract_json(text)
            return result_from_payload(alert.id, payload, mode="AI")
        except (ValueError, KeyError, json.JSONDecodeError):
            # One retry with an explicit format reminder, then give up to mock.
            text = self._ask(
                SYSTEM_PROMPT,
                prompt + "\n\nReturn ONLY the JSON object — no other text.",
            )
            payload = extract_json(text)
            return result_from_payload(alert.id, payload, mode="AI")

    def _ai_summary(self, alerts: list[Alert], results: list[TriageResult]) -> str:
        lines = [
            f"- {r.alert_id} [{r.severity}] {a.rule_name}: "
            f"{a.src_ip} -> {a.dst_ip} ({a.count}x) — {a.description}"
            for a, r in zip(alerts, results)
        ]
        prompt = (
            "Here are all triaged alerts from one monitoring window:\n"
            + "\n".join(lines)
            + "\n\nWrite a 1-2 paragraph executive incident summary for plant "
            "management: group related alerts into a coherent incident story, "
            "name the most urgent risk, and state the single most important "
            "next action. Plain prose, no JSON, no headers."
        )
        return self._ask(SYSTEM_PROMPT, prompt, max_tokens=1500).strip()
