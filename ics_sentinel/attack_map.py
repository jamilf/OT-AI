"""MITRE ATT&CK for ICS technique catalog and alert enrichment.

Maps each detection rule to the real ATT&CK for ICS techniques it evidences.
The mapping rationale lives in DESIGN.md; the short version: a rule detects
*behavior on the wire*, and each technique here is the adversary behavior
that produces exactly that wire pattern on an unauthenticated protocol.
"""

from __future__ import annotations

from dataclasses import dataclass, replace

from .detection import (
    RULE_FLOOD,
    RULE_MALFORMED,
    RULE_SAFETY,
    RULE_SCAN,
    RULE_SPOOF,
    RULE_UNAUTHORIZED_WRITE,
    Alert,
)


@dataclass(frozen=True, slots=True)
class Technique:
    """One MITRE ATT&CK for ICS technique."""

    technique_id: str
    name: str
    tactic: str

    @property
    def url(self) -> str:
        return f"https://attack.mitre.org/techniques/{self.technique_id}/"

    def __str__(self) -> str:
        return f"{self.technique_id} {self.name} [{self.tactic}]"


#: ATT&CK for ICS techniques referenced by ICS Sentinel.
TECHNIQUES: dict[str, Technique] = {
    t.technique_id: t
    for t in (
        Technique("T0855", "Unauthorized Command Message", "Impair Process Control"),
        Technique("T0836", "Modify Parameter", "Impair Process Control"),
        Technique("T0831", "Manipulation of Control", "Impact"),
        Technique("T0846", "Remote System Discovery", "Discovery"),
        Technique("T0814", "Denial of Service", "Inhibit Response Function"),
        Technique("T0856", "Spoof Reporting Message", "Evasion / Impair Process Control"),
    )
}

#: Detection rule → ATT&CK technique IDs that wire pattern evidences.
RULE_TECHNIQUE_IDS: dict[str, tuple[str, ...]] = {
    # A command the engineering workstation didn't send is, by definition,
    # an unauthorized command message.
    RULE_UNAUTHORIZED_WRITE: ("T0855",),
    # An out-of-range setpoint is a modified operating parameter; chasing it
    # manipulates the physical process toward an unsafe state.
    RULE_SAFETY: ("T0836", "T0831"),
    # Sweeping registers/unit IDs is how an adversary discovers PLCs and
    # maps the process before acting.
    RULE_SCAN: ("T0846",),
    # Illegal function codes / corrupt PDUs can crash fragile PLC stacks
    # and are a classic ICS DoS vector.
    RULE_MALFORMED: ("T0814",),
    # Command flooding both denies legitimate control and hammers the
    # process with unauthorized commands.
    RULE_FLOOD: ("T0814", "T0855"),
    # A conflicting second response is a falsified reporting message —
    # hiding true process state from operators.
    RULE_SPOOF: ("T0856",),
}


def techniques_for_rule(rule_id: str) -> tuple[Technique, ...]:
    return tuple(
        TECHNIQUES[tid] for tid in RULE_TECHNIQUE_IDS.get(rule_id, ())
    )


def enrich(alerts: list[Alert]) -> list[Alert]:
    """Return alerts with their ATT&CK techniques attached."""
    return [
        replace(alert, techniques=techniques_for_rule(alert.rule_id))
        for alert in alerts
    ]
