"""Tests for the Phase 3 detection engine.

Two-sided discipline: every rule must fire on its attack scenario AND every
rule must stay silent on a pure benign stream. Low false positives are the
difference between a detector and a noise generator.
"""

from __future__ import annotations

import pytest

from ics_sentinel import config
from ics_sentinel.detection import (
    RULE_FLOOD,
    RULE_MALFORMED,
    RULE_SAFETY,
    RULE_SCAN,
    RULE_UNAUTHORIZED_WRITE,
    Alert,
    DetectionEngine,
)
from ics_sentinel.generator import TrafficGenerator


def analyze(scenarios: list[str], duration: float = 60.0) -> list[Alert]:
    gen = TrafficGenerator(seed=config.DEFAULT_SEED)
    return DetectionEngine().analyze(gen.generate_with_scenarios(duration, scenarios))


def rules_fired(alerts: list[Alert]) -> set[str]:
    return {a.rule_id for a in alerts}


# ----------------------------------------------------------------------
# False-positive discipline: benign traffic produces ZERO alerts
# ----------------------------------------------------------------------


def test_benign_traffic_is_silent():
    assert analyze([]) == []


def test_long_benign_traffic_is_silent():
    """More benign writes accumulate over 10 minutes — still no alerts."""
    assert analyze([], duration=600.0) == []


@pytest.mark.parametrize("seed", [1, 2, 3, 99])
def test_benign_traffic_silent_across_seeds(seed):
    gen = TrafficGenerator(seed=seed)
    assert DetectionEngine().analyze(gen.generate_benign(120.0)) == []


# ----------------------------------------------------------------------
# True positives: each rule fires on its scenario
# ----------------------------------------------------------------------


def test_unauthorized_write_fires_r1_only():
    alerts = analyze(["unauthorized_write"])
    assert rules_fired(alerts) == {RULE_UNAUTHORIZED_WRITE}
    assert all(a.src_ip == config.ATTACKER_IP for a in alerts)
    # Two distinct writes (coil + register) → two alerts, not 0 and not 40.
    assert len(alerts) == 2


def test_dangerous_setpoint_fires_safety_only():
    """From the authorized EWS, so the allowlist rule must stay quiet."""
    alerts = analyze(["dangerous_setpoint"])
    assert rules_fired(alerts) == {RULE_SAFETY}
    (alert,) = alerts
    assert alert.src_ip == config.EWS_IP
    assert "200" in alert.description


def test_recon_scan_fires_scan_once():
    alerts = analyze(["recon_scan"])
    assert rules_fired(alerts) == {RULE_SCAN}
    assert len(alerts) == 1, "one scan episode should yield one alert"
    assert alerts[0].src_ip == config.ATTACKER_IP


def test_malformed_frames_fire_r4():
    alerts = analyze(["malformed_frame"])
    fired = rules_fired(alerts)
    assert RULE_MALFORMED in fired
    # The corrupt write PDU is also a write from an unauthorized source —
    # defense in depth means R1 may legitimately fire alongside R4.
    assert fired <= {RULE_MALFORMED, RULE_UNAUTHORIZED_WRITE}
    malformed = [a for a in alerts if a.rule_id == RULE_MALFORMED]
    assert len(malformed) == 3


def test_replay_flood_fires_frequency_rule():
    alerts = analyze(["replay_flood"])
    fired = rules_fired(alerts)
    assert RULE_FLOOD in fired
    flood = [a for a in alerts if a.rule_id == RULE_FLOOD]
    assert len(flood) == 1, "one burst should coalesce into one flood alert"
    assert flood[0].count >= 20


def test_replay_flood_deduplicates_unauthorized_writes():
    """40 identical frames must not become 40 R1 alerts."""
    alerts = analyze(["replay_flood"])
    r1 = [a for a in alerts if a.rule_id == RULE_UNAUTHORIZED_WRITE]
    assert len(r1) == 1
    assert r1[0].count == 40


# ----------------------------------------------------------------------
# Composition and structure
# ----------------------------------------------------------------------


def test_all_scenarios_fire_all_rules_with_clean_alert_list():
    from ics_sentinel.generator import ATTACK_SCENARIOS

    alerts = analyze(sorted(ATTACK_SCENARIOS))
    assert rules_fired(alerts) == {
        RULE_UNAUTHORIZED_WRITE,
        RULE_SAFETY,
        RULE_SCAN,
        RULE_MALFORMED,
        RULE_FLOOD,
    }
    # ~250 attack frames collapse into a clean, readable alert list.
    assert len(alerts) <= 12


def test_alert_ids_sequential_and_chronological():
    alerts = analyze(["unauthorized_write", "replay_flood"])
    assert [a.id for a in alerts] == [f"ALT-{i:03d}" for i in range(1, len(alerts) + 1)]
    timestamps = [a.timestamp for a in alerts]
    assert timestamps == sorted(timestamps)


def test_alert_carries_raw_frame_and_required_fields():
    alerts = analyze(["dangerous_setpoint"])
    alert = alerts[0]
    assert alert.raw_frame.values == (200,)
    assert alert.rule_name
    assert alert.function_code == alert.raw_frame.function_code
    assert alert.dst_ip == alert.raw_frame.dst_ip


def test_detection_never_reads_ground_truth_labels():
    """Relabeling attack frames as 'benign' must not change the verdict."""
    from dataclasses import replace

    gen = TrafficGenerator(seed=config.DEFAULT_SEED)
    stream = gen.generate_with_scenarios(60.0, ["unauthorized_write"])
    stripped = [replace(f, label="benign") for f in stream]
    assert len(DetectionEngine().analyze(stripped)) == len(
        DetectionEngine().analyze(stream)
    )
