"""AI triage layer: Claude as the SOC analyst, with a deterministic fallback.

Triage operates on **incidents** (correlated alert groups — see
:mod:`ics_sentinel.incidents`): each incident, with its member alerts,
ATT&CK context, and the plant's process context, goes to Claude in one call
for a structured verdict — severity with justification, a plain-English
explanation for a plant operator, an attack narrative, validated ATT&CK
techniques, ordered response actions, and a false-positive assessment. One
additional call produces an incident-level executive summary.

When ``ANTHROPIC_API_KEY`` is absent (or the ``anthropic`` package isn't
installed, or the API errors out), the triager falls back to deterministic
templated triage so the demo always runs. Every result carries a ``mode``
of ``AI`` or ``MOCK`` and the report labels it prominently.

Robustness layers for the AI path, outermost first: schema-enforced
structured outputs (``output_config.format``) where the installed SDK/model
supports it, falling back to prompt-instructed JSON; defensive parsing
(fences stripped, braces located); one format-reminder retry; and finally
the mock template. The triager also accumulates token usage across calls
for the demo's cost line.
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
from .incidents import Incident

SEVERITIES = ("Critical", "High", "Medium", "Low")

#: Current Claude model; override with the ICS_SENTINEL_MODEL env var.
DEFAULT_MODEL = "claude-opus-4-8"

_SEVERITY_RANK = {sev: i for i, sev in enumerate(SEVERITIES)}


@dataclass(frozen=True, slots=True)
class TriageResult:
    """Structured triage verdict for one incident."""

    subject_id: str  # incident id (or alert id for incident-of-one triage)
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


def _is_schema_rejection(exc: Exception) -> bool:
    """True if an exception means 'this SDK/model won't take output_config'.

    Covers the older-SDK case (``TypeError`` on an unknown kwarg) and the
    API-level rejection (a ``BadRequestError``/400, matched by name so the
    ``anthropic`` package need not be importable in mock/test environments).
    """
    if isinstance(exc, TypeError):
        return True
    name = type(exc).__name__
    return "BadRequest" in name or getattr(exc, "status_code", None) == 400


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


def result_from_payload(subject_id: str, payload: dict, mode: str) -> TriageResult:
    """Build a TriageResult from parsed model JSON, validating severity."""
    return TriageResult(
        subject_id=subject_id,
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


#: JSON schema for structured outputs (schema-enforced where supported).
TRIAGE_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "severity": {"type": "string", "enum": list(SEVERITIES)},
        "severity_justification": {"type": "string"},
        "plain_english_explanation": {"type": "string"},
        "attack_narrative": {"type": "string"},
        "confirmed_attack_techniques": {
            "type": "array",
            "items": {"type": "string"},
        },
        "recommended_actions": {"type": "array", "items": {"type": "string"}},
        "false_positive_likelihood": {
            "type": "string",
            "enum": ["Low", "Medium", "High"],
        },
        "false_positive_reasoning": {"type": "string"},
    },
    "required": [
        "severity",
        "severity_justification",
        "plain_english_explanation",
        "attack_narrative",
        "confirmed_attack_techniques",
        "recommended_actions",
        "false_positive_likelihood",
        "false_positive_reasoning",
    ],
    "additionalProperties": False,
}


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

SYSTEM_PROMPT = f"""You are a senior OT/ICS security analyst triaging \
incidents from a passive Modbus TCP monitoring system. An incident groups one
or more related alerts attributed to a single source host.

{PROCESS_CONTEXT}

For each incident you receive, respond with ONLY a single JSON object (no
markdown fences, no prose before or after) with exactly these fields:
- "severity": one of "Critical", "High", "Medium", "Low" — for the incident
  as a whole (its most dangerous element drives it)
- "severity_justification": 1-2 sentences
- "plain_english_explanation": what happened across the incident, in terms a
  plant operator with no security background understands
- "attack_narrative": how the member alerts fit together as stages of the
  attacker's likely campaign
- "confirmed_attack_techniques": array of strings, each "<ID>: <one-line
  reasoning>", validating (or rejecting) the candidate MITRE ATT&CK for ICS
  techniques attached to the alerts
- "recommended_actions": array of concrete, ordered response steps an OT team
  can execute (most urgent first)
- "false_positive_likelihood": one of "Low", "Medium", "High"
- "false_positive_reasoning": 1-2 sentences

Severity should reflect physical-process impact first, classic CIA second."""


def alert_payload(alert: Alert) -> dict:
    """One alert as compact JSON for the model (and for tests/exports)."""
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


def incident_payload(incident: Incident) -> dict:
    return {
        "incident_id": incident.id,
        "source_ip": incident.src_ip,
        "alert_count": len(incident.alerts),
        "alerts": [alert_payload(a) for a in incident.alerts],
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


def _profile_fields(alert: Alert) -> dict:
    return {
        "src": alert.src_ip,
        "dst": alert.dst_ip,
        "function": alert.raw_frame.function_name,
        "values": ", ".join(str(v) for v in alert.raw_frame.values),
        "count": alert.count,
        "count_points": f"{alert.count if alert.count > 1 else 'many'} points",
    }


def _mock_rank(alert: Alert) -> int:
    return _SEVERITY_RANK[_MOCK_PROFILES[alert.rule_id][0]]


def _mock_incident_triage(incident: Incident) -> TriageResult:
    """Deterministic incident verdict: lead with the most severe member."""
    lead = min(incident.alerts, key=lambda a: (_mock_rank(a), a.timestamp))
    severity, fp, explanation, narrative, _ = _MOCK_PROFILES[lead.rule_id]
    fields = _profile_fields(lead)

    explanation = explanation.format(**fields)
    narrative = narrative.format(**fields)
    if len(incident.alerts) > 1:
        rule_names = ", ".join(
            a.rule_name for a in incident.alerts if a.rule_id != lead.rule_id
        )
        explanation = (
            f"{len(incident.alerts)} related alerts from {incident.src_ip}. "
            f"Most severe: {explanation}"
        )
        if rule_names:
            narrative += (
                f" Combined with the other activity from this source "
                f"({rule_names}), this reads as a multi-stage intrusion "
                "rather than isolated events."
            )

    # Merge actions across the incident's distinct rules, most severe first.
    actions: dict[str, None] = {}
    seen_rules: set[str] = set()
    for alert in sorted(incident.alerts, key=_mock_rank):
        if alert.rule_id in seen_rules:
            continue
        seen_rules.add(alert.rule_id)
        for action in _MOCK_PROFILES[alert.rule_id][4]:
            actions.setdefault(action.format(**_profile_fields(alert)), None)
    techniques: dict[str, None] = {}
    for alert in incident.alerts:
        for t in alert.techniques:
            techniques.setdefault(
                f"{t.technique_id}: mapped from rule {alert.rule_id} ({t.name})",
                None,
            )

    return TriageResult(
        subject_id=incident.id,
        severity=severity,
        severity_justification=(
            f"Deterministic template severity led by rule {lead.rule_id} "
            "(no API key — heuristic, not model-reasoned)."
        ),
        plain_english_explanation=explanation,
        attack_narrative=narrative,
        confirmed_attack_techniques=tuple(techniques),
        recommended_actions=tuple(list(actions)[:6]),
        false_positive_likelihood=fp,
        false_positive_reasoning=(
            "Template assessment based on rule type; benign traffic does not "
            "produce this wire pattern in the simulated plant."
        ),
        mode="MOCK",
    )


def _mock_summary(incidents: list[Incident], results: list[TriageResult]) -> str:
    alerts = [a for i in incidents for a in i.alerts]
    by_sev: dict[str, int] = {}
    for r in results:
        by_sev[r.severity] = by_sev.get(r.severity, 0) + 1
    sev_part = ", ".join(f"{by_sev[s]} {s}" for s in SEVERITIES if by_sev.get(s))
    sources = sorted({i.src_ip for i in incidents})
    story = (
        f"{len(incidents)} incident(s) ({sev_part}) comprising "
        f"{len(alerts)} alert(s), from {', '.join(sources)}."
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
    """Triage incidents with Claude when possible, mock templates otherwise."""

    def __init__(self, model: str | None = None) -> None:
        self.model = model or os.environ.get("ICS_SENTINEL_MODEL", DEFAULT_MODEL)
        self.input_tokens = 0
        self.output_tokens = 0
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

    def triage_incident(self, incident: Incident) -> TriageResult:
        if self._client is None:
            return _mock_incident_triage(incident)
        try:
            return self._ai_triage(incident)
        except Exception:
            # Whatever the API does, the demo must not break.
            return _mock_incident_triage(incident)

    def triage_incidents(self, incidents: list[Incident]) -> list[TriageResult]:
        return [self.triage_incident(incident) for incident in incidents]

    def triage(self, alert: Alert) -> TriageResult:
        """Convenience: triage a single alert as an incident-of-one."""
        return self.triage_incident(
            Incident(id=alert.id, src_ip=alert.src_ip, alerts=(alert,))
        )

    def executive_summary(
        self, incidents: list[Incident], results: list[TriageResult]
    ) -> str:
        if not incidents:
            return "No alerts — traffic consistent with the benign baseline."
        if self._client is None:
            return _mock_summary(incidents, results)
        try:
            return self._ai_summary(incidents, results)
        except Exception:
            return _mock_summary(incidents, results)

    # -- AI paths -------------------------------------------------------

    def _ask(
        self,
        system: str,
        user: str,
        max_tokens: int = 2000,
        schema: dict | None = None,
    ) -> str:
        """One model call. Tries schema-enforced structured output first;
        falls back to plain prompting on SDKs/models that don't support it."""
        base = dict(
            model=self.model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        if schema is not None:
            try:
                response = self._client.messages.create(
                    **base,
                    output_config={
                        "format": {"type": "json_schema", "schema": schema}
                    },
                )
            except Exception as exc:
                # Older SDK (TypeError on the kwarg) or a model/endpoint that
                # rejects structured outputs (400) → retry plain-prompted.
                if not _is_schema_rejection(exc):
                    raise
                response = self._client.messages.create(**base)
        else:
            response = self._client.messages.create(**base)
        usage = getattr(response, "usage", None)
        if usage is not None:
            self.input_tokens += getattr(usage, "input_tokens", 0) or 0
            self.output_tokens += getattr(usage, "output_tokens", 0) or 0
        return "".join(
            block.text for block in response.content if block.type == "text"
        )

    def _ai_triage(self, incident: Incident) -> TriageResult:
        prompt = "Triage this incident:\n" + json.dumps(
            incident_payload(incident), indent=2
        )
        text = self._ask(SYSTEM_PROMPT, prompt, schema=TRIAGE_SCHEMA)
        try:
            payload = extract_json(text)
            return result_from_payload(incident.id, payload, mode="AI")
        except (ValueError, KeyError, json.JSONDecodeError):
            # One retry with an explicit format reminder, then give up to mock.
            text = self._ask(
                SYSTEM_PROMPT,
                prompt + "\n\nReturn ONLY the JSON object — no other text.",
                schema=TRIAGE_SCHEMA,
            )
            payload = extract_json(text)
            return result_from_payload(incident.id, payload, mode="AI")

    def _ai_summary(
        self, incidents: list[Incident], results: list[TriageResult]
    ) -> str:
        lines = []
        for incident, result in zip(incidents, results):
            lines.append(
                f"- {incident.id} [{result.severity}] from {incident.src_ip}, "
                f"{len(incident.alerts)} alert(s):"
            )
            lines += [
                f"    - {a.id} {a.rule_name} -> {a.dst_ip} ({a.count}x): "
                f"{a.description}"
                for a in incident.alerts
            ]
        prompt = (
            "Here are all triaged incidents from one monitoring window:\n"
            + "\n".join(lines)
            + "\n\nWrite a 1-2 paragraph executive incident summary for plant "
            "management: tell the incident story, name the most urgent risk, "
            "and state the single most important next action. Plain prose, "
            "no JSON, no headers."
        )
        return self._ask(SYSTEM_PROMPT, prompt, max_tokens=1500).strip()
