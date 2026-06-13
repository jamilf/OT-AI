"""Tests for alert → incident correlation."""

from __future__ import annotations

from ics_sentinel import attack_map, config
from ics_sentinel.detection import DetectionEngine
from ics_sentinel.generator import ATTACK_SCENARIOS, TrafficGenerator
from ics_sentinel.incidents import correlate


def all_scenario_alerts():
    gen = TrafficGenerator(seed=config.DEFAULT_SEED)
    frames = gen.generate_with_scenarios(60.0, sorted(ATTACK_SCENARIOS))
    return attack_map.enrich(DetectionEngine().analyze(frames))


def test_correlate_groups_by_source_ip():
    incidents = correlate(all_scenario_alerts())
    # All attacker alerts collapse into one incident per source IP.
    by_src = {i.src_ip: i for i in incidents}
    assert len(by_src) == len(incidents)
    assert config.ATTACKER_IP in by_src
    # The attacker incident bundles several distinct rules.
    assert len(by_src[config.ATTACKER_IP].rule_ids) >= 3


def test_correlation_cuts_triage_calls():
    alerts = all_scenario_alerts()
    incidents = correlate(alerts)
    assert len(incidents) < len(alerts)


def test_incidents_numbered_and_ordered_by_first_activity():
    incidents = correlate(all_scenario_alerts())
    assert [i.id for i in incidents] == [
        f"INC-{n:02d}" for n in range(1, len(incidents) + 1)
    ]
    starts = [i.start for i in incidents]
    assert starts == sorted(starts)


def test_incident_alerts_are_chronological():
    for incident in correlate(all_scenario_alerts()):
        times = [a.timestamp for a in incident.alerts]
        assert times == sorted(times)
        assert incident.start == times[0]
        assert incident.end == times[-1]


def test_empty_input():
    assert correlate([]) == []
