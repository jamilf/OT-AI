"""Tests for the Phase 5 triage layer (mock mode + defensive parsing)."""

from __future__ import annotations

import pytest

from ics_sentinel import attack_map, config
from ics_sentinel.detection import DetectionEngine
from ics_sentinel.generator import ATTACK_SCENARIOS, TrafficGenerator
from ics_sentinel.triage import (
    SEVERITIES,
    Triager,
    extract_json,
    result_from_payload,
)


@pytest.fixture(autouse=True)
def no_api_key(monkeypatch):
    """Tests must never hit the network — force mock mode."""
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)


@pytest.fixture(scope="module")
def enriched_alerts():
    gen = TrafficGenerator(seed=config.DEFAULT_SEED)
    frames = gen.generate_with_scenarios(60.0, sorted(ATTACK_SCENARIOS))
    return attack_map.enrich(DetectionEngine().analyze(frames))


def test_mock_mode_without_key():
    assert Triager().mode == "MOCK"


def test_mock_triage_covers_every_alert(enriched_alerts):
    triager = Triager()
    results = triager.triage_all(enriched_alerts)
    assert len(results) == len(enriched_alerts)
    for alert, result in zip(enriched_alerts, results):
        assert result.alert_id == alert.id
        assert result.mode == "MOCK"
        assert result.severity in SEVERITIES
        assert result.plain_english_explanation
        assert result.recommended_actions
        assert result.confirmed_attack_techniques


def test_mock_triage_is_deterministic(enriched_alerts):
    a = Triager().triage_all(enriched_alerts)
    b = Triager().triage_all(enriched_alerts)
    assert a == b


def test_safety_violation_is_critical(enriched_alerts):
    results = Triager().triage_all(enriched_alerts)
    safety = [
        r
        for a, r in zip(enriched_alerts, results)
        if a.rule_id == "R2-SAFETY"
    ]
    assert safety and all(r.severity == "Critical" for r in safety)


def test_executive_summary_mentions_counts_and_attacker(enriched_alerts):
    triager = Triager()
    results = triager.triage_all(enriched_alerts)
    summary = triager.executive_summary(enriched_alerts, results)
    assert str(len(enriched_alerts)) in summary
    assert config.ATTACKER_IP in summary


def test_executive_summary_empty_case():
    assert "No alerts" in Triager().executive_summary([], [])


# ----------------------------------------------------------------------
# Defensive JSON parsing
# ----------------------------------------------------------------------


def test_extract_json_plain():
    assert extract_json('{"severity": "High"}') == {"severity": "High"}


def test_extract_json_strips_code_fences():
    text = '```json\n{"severity": "Low", "n": 1}\n```'
    assert extract_json(text) == {"severity": "Low", "n": 1}


def test_extract_json_tolerates_surrounding_prose():
    text = 'Here is the triage:\n{"severity": "Medium"}\nHope that helps!'
    assert extract_json(text) == {"severity": "Medium"}


@pytest.mark.parametrize("garbage", ["", "no json here", "[1, 2, 3]", "{broken"])
def test_extract_json_raises_on_garbage(garbage):
    with pytest.raises((ValueError, Exception)):
        extract_json(garbage)


def test_result_from_payload_normalizes_severity():
    result = result_from_payload(
        "ALT-001",
        {
            "severity": "critical",
            "recommended_actions": "isolate the host",
            "confirmed_attack_techniques": ["T0855: rogue command"],
        },
        mode="AI",
    )
    assert result.severity == "Critical"
    assert result.severity_rank == 0
    assert result.recommended_actions == ("isolate the host",)
    assert result.mode == "AI"


def test_result_from_payload_rejects_invalid_severity():
    with pytest.raises(ValueError):
        result_from_payload("ALT-001", {"severity": "Catastrophic"}, mode="AI")


def test_severity_rank_orders_critical_first():
    ranks = [
        result_from_payload("x", {"severity": s}, "AI").severity_rank
        for s in SEVERITIES
    ]
    assert ranks == sorted(ranks)
