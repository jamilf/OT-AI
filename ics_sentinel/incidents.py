"""Alert → incident correlation.

Groups related alerts into incidents before triage, so the AI reasons about
the attacker's whole campaign at once (and the LLM call count drops ~5× on
the default demo: 11 alerts → 2 incidents).

Correlation key: source IP. On an OT segment the source is the actor — one
host scanning, then writing, then flooding is one intrusion story, not ten
tickets. Incidents are ordered (and numbered) by first activity.
"""

from __future__ import annotations

from dataclasses import dataclass

from .detection import Alert


@dataclass(frozen=True, slots=True)
class Incident:
    """One or more related alerts attributed to a single actor (source IP)."""

    id: str  # "INC-01"
    src_ip: str
    alerts: tuple[Alert, ...]  # chronological

    @property
    def start(self) -> float:
        return self.alerts[0].timestamp

    @property
    def end(self) -> float:
        return self.alerts[-1].timestamp

    @property
    def rule_ids(self) -> tuple[str, ...]:
        seen: dict[str, None] = {}
        for alert in self.alerts:
            seen.setdefault(alert.rule_id, None)
        return tuple(seen)


def correlate(alerts: list[Alert]) -> list[Incident]:
    """Group alerts by source IP into incidents, ordered by first activity."""
    by_src: dict[str, list[Alert]] = {}
    for alert in sorted(alerts, key=lambda a: a.timestamp):
        by_src.setdefault(alert.src_ip, []).append(alert)
    groups = sorted(by_src.items(), key=lambda kv: kv[1][0].timestamp)
    return [
        Incident(id=f"INC-{i:02d}", src_ip=src, alerts=tuple(group))
        for i, (src, group) in enumerate(groups, 1)
    ]
