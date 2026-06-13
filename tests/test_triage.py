"""Tests for the triage layer (incident-level mock mode + defensive parsing)."""

from __future__ import annotations

import pytest

from ics_sentinel import attack_map, config
from ics_sentinel.detection import DetectionEngine
from ics_sentinel.generator import ATTACK_SCENARIOS, TrafficGenerator
from ics_sentinel.incidents import Incident, correlate
from ics_sentinel.triage import (
    SEVERITIES,
    Triager,
    extract_json,
    incident_payload,
    result_from_payload,
)


@pytest.fixture(autouse=True)
def no_api_key(monkeypatch):
    """Tests must never hit the network — force mock mode."""
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)


@pytest.fixture(scope="module")
def incidents():
    gen = TrafficGenerator(seed=config.DEFAULT_SEED)
    frames = gen.generate_with_scenarios(60.0, sorted(ATTACK_SCENARIOS))
    alerts = attack_map.enrich(DetectionEngine().analyze(frames))
    return correlate(alerts)


def test_mock_mode_without_key():
    assert Triager().mode == "MOCK"


def test_mock_triage_covers_every_incident(incidents):
    triager = Triager()
    results = triager.triage_incidents(incidents)
    assert len(results) == len(incidents)
    for incident, result in zip(incidents, results):
        assert result.subject_id == incident.id
        assert result.mode == "MOCK"
        assert result.severity in SEVERITIES
        assert result.plain_english_explanation
        assert result.recommended_actions
        assert result.confirmed_attack_techniques


def test_mock_triage_is_deterministic(incidents):
    a = Triager().triage_incidents(incidents)
    b = Triager().triage_incidents(incidents)
    assert a == b


def test_incident_severity_is_led_by_most_severe_member(incidents):
    """The attacker incident contains a safety violation → Critical overall."""
    triager = Triager()
    results = triager.triage_incidents(incidents)
    # The EWS incident carries the dangerous_setpoint (Critical) safety alert.
    ews = [
        (i, r) for i, r in zip(incidents, results) if i.src_ip == config.EWS_IP
    ]
    assert ews and ews[0][1].severity == "Critical"


def test_incident_merges_actions_and_techniques():
    """A multi-rule incident pulls actions and techniques from all members."""
    gen = TrafficGenerator(seed=config.DEFAULT_SEED)
    frames = gen.generate_with_scenarios(
        60.0, ["unauthorized_write", "recon_scan", "replay_flood"]
    )
    alerts = attack_map.enrich(DetectionEngine().analyze(frames))
    incs = correlate(alerts)
    attacker = next(i for i in incs if i.src_ip == config.ATTACKER_IP)
    assert len(attacker.rule_ids) >= 2
    result = Triager().triage_incident(attacker)
    techniques = {t.split(":")[0] for t in result.confirmed_attack_techniques}
    assert {"T0855", "T0846", "T0814"} <= techniques


def test_single_alert_triage_convenience(incidents):
    alert = incidents[0].alerts[0]
    result = Triager().triage(alert)
    assert result.subject_id == alert.id
    assert result.severity in SEVERITIES


def test_executive_summary_mentions_counts_and_attacker(incidents):
    triager = Triager()
    results = triager.triage_incidents(incidents)
    summary = triager.executive_summary(incidents, results)
    assert str(len(incidents)) in summary
    assert config.ATTACKER_IP in summary


def test_executive_summary_empty_case():
    assert "No alerts" in Triager().executive_summary([], [])


def test_incident_payload_shape(incidents):
    payload = incident_payload(incidents[0])
    assert payload["incident_id"] == incidents[0].id
    assert payload["alert_count"] == len(incidents[0].alerts)
    assert payload["alerts"] and "rule" in payload["alerts"][0]


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
        "INC-01",
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
        result_from_payload("INC-01", {"severity": "Catastrophic"}, mode="AI")


def test_severity_rank_orders_critical_first():
    ranks = [
        result_from_payload("x", {"severity": s}, "AI").severity_rank
        for s in SEVERITIES
    ]
    assert ranks == sorted(ranks)


# ----------------------------------------------------------------------
# AI-path plumbing (no network — fake client)
# ----------------------------------------------------------------------

_VALID_TRIAGE_JSON = (
    '{"severity": "High", "severity_justification": "x", '
    '"plain_english_explanation": "x", "attack_narrative": "x", '
    '"confirmed_attack_techniques": ["T0855: x"], '
    '"recommended_actions": ["block the host"], '
    '"false_positive_likelihood": "Low", "false_positive_reasoning": "x"}'
)


class _Block:
    type = "text"

    def __init__(self, text):
        self.text = text


class _Usage:
    input_tokens = 100
    output_tokens = 50


class _Resp:
    def __init__(self, text):
        self.content = [_Block(text)]
        self.usage = _Usage()


class _FakeMessages:
    def __init__(self, *, reject_schema):
        self.reject_schema = reject_schema
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        if "output_config" in kwargs and self.reject_schema:
            # Simulate an SDK/model that doesn't accept structured outputs.
            raise TypeError("unexpected keyword argument 'output_config'")
        return _Resp(_VALID_TRIAGE_JSON)


class _FakeClient:
    def __init__(self, *, reject_schema):
        self.messages = _FakeMessages(reject_schema=reject_schema)


def _ai_triager(monkeypatch, *, reject_schema):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    triager = Triager.__new__(Triager)
    triager.model = "test-model"
    triager.input_tokens = 0
    triager.output_tokens = 0
    triager._client = _FakeClient(reject_schema=reject_schema)
    return triager


def test_ai_triage_uses_structured_outputs(monkeypatch, incidents):
    triager = _ai_triager(monkeypatch, reject_schema=False)
    result = triager.triage_incident(incidents[0])
    assert result.mode == "AI"
    assert result.severity == "High"
    assert "output_config" in triager._client.messages.calls[0]
    assert triager.input_tokens == 100  # usage accumulated


def test_ai_triage_falls_back_when_schema_unsupported(monkeypatch, incidents):
    triager = _ai_triager(monkeypatch, reject_schema=True)
    result = triager.triage_incident(incidents[0])
    # First call sent schema (rejected), retry without it succeeded.
    assert result.mode == "AI"
    assert result.severity == "High"
    calls = triager._client.messages.calls
    assert "output_config" in calls[0]
    assert "output_config" not in calls[1]
