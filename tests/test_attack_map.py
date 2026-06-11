"""Tests for the Phase 4 MITRE ATT&CK for ICS mapping."""

from __future__ import annotations

import pytest

from ics_sentinel import attack_map, config
from ics_sentinel.detection import RULE_NAMES, DetectionEngine
from ics_sentinel.generator import ATTACK_SCENARIOS, TrafficGenerator


def test_every_rule_has_a_mapping():
    assert set(attack_map.RULE_TECHNIQUE_IDS) == set(RULE_NAMES)


def test_all_mapped_ids_exist_in_catalog():
    for ids in attack_map.RULE_TECHNIQUE_IDS.values():
        for tid in ids:
            assert tid in attack_map.TECHNIQUES


def test_technique_fields_and_url():
    t = attack_map.TECHNIQUES["T0855"]
    assert t.name == "Unauthorized Command Message"
    assert t.tactic == "Impair Process Control"
    assert t.url == "https://attack.mitre.org/techniques/T0855/"


@pytest.mark.parametrize(
    ("scenario", "expected_ids"),
    [
        ("unauthorized_write", {"T0855"}),
        ("dangerous_setpoint", {"T0836", "T0831"}),
        ("recon_scan", {"T0846"}),
        ("replay_flood", {"T0814", "T0855"}),
    ],
)
def test_enriched_alerts_carry_expected_techniques(scenario, expected_ids):
    gen = TrafficGenerator(seed=config.DEFAULT_SEED)
    alerts = attack_map.enrich(
        DetectionEngine().analyze(gen.generate_with_scenarios(60.0, [scenario]))
    )
    seen = {t.technique_id for a in alerts for t in a.techniques}
    assert expected_ids <= seen


def test_every_alert_in_full_mix_is_enriched():
    gen = TrafficGenerator(seed=config.DEFAULT_SEED)
    alerts = attack_map.enrich(
        DetectionEngine().analyze(
            gen.generate_with_scenarios(60.0, sorted(ATTACK_SCENARIOS))
        )
    )
    assert alerts
    for alert in alerts:
        assert alert.techniques, f"{alert.rule_id} alert missing techniques"
        for technique in alert.techniques:
            assert technique.technique_id.startswith("T0")
            assert technique.tactic
