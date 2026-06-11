"""Tests for the Phase 2 attack scenarios.

Each scenario must (a) carry its ground-truth label, (b) exhibit the wire
property its Phase 3 detection rule will key on, and (c) leave the benign
baseline untouched when spliced in.
"""

from __future__ import annotations

import pytest

from ics_sentinel import config
from ics_sentinel.generator import ATTACK_SCENARIOS, TrafficGenerator
from ics_sentinel.modbus import BENIGN_LABEL, ModbusFrame


def mixed_stream(scenarios: list[str], duration: float = 60.0) -> list[ModbusFrame]:
    return TrafficGenerator(seed=config.DEFAULT_SEED).generate_with_scenarios(
        duration, scenarios
    )


def attack_frames(stream: list[ModbusFrame], label: str) -> list[ModbusFrame]:
    return [f for f in stream if f.label == label]


@pytest.mark.parametrize("name", sorted(ATTACK_SCENARIOS))
def test_scenario_injects_labeled_frames_in_order(name):
    stream = mixed_stream([name])
    injected = attack_frames(stream, name)
    assert injected, f"scenario {name} produced no frames"
    timestamps = [f.timestamp for f in stream]
    assert timestamps == sorted(timestamps)
    # Attacks land inside the capture window, mixed into benign traffic.
    assert stream[0].label == BENIGN_LABEL
    assert stream[-1].label == BENIGN_LABEL


@pytest.mark.parametrize("name", sorted(ATTACK_SCENARIOS))
def test_scenario_does_not_disturb_benign_baseline(name):
    stream = mixed_stream([name])
    benign_part = [f for f in stream if f.label == BENIGN_LABEL]
    pure = TrafficGenerator(seed=config.DEFAULT_SEED).generate_benign(60.0)
    assert benign_part == pure


def test_unauthorized_write_comes_from_unauthorized_source():
    injected = attack_frames(mixed_stream(["unauthorized_write"]), "unauthorized_write")
    for frame in injected:
        assert frame.is_write
        assert frame.src_ip not in config.AUTHORIZED_WRITE_SOURCES
        # Values themselves are unremarkable — the source is the tell.
        assert frame.is_valid()


def test_dangerous_setpoint_is_outside_safe_range_but_authorized():
    injected = attack_frames(mixed_stream(["dangerous_setpoint"]), "dangerous_setpoint")
    lo, hi = config.SAFE_REGISTER_RANGES[config.PUMP_SETPOINT_REGISTER]
    for frame in injected:
        assert frame.is_write
        assert frame.address == config.PUMP_SETPOINT_REGISTER
        assert not lo <= frame.values[0] <= hi
        # Comes from the EWS, so only the safety rule should fire.
        assert frame.src_ip in config.AUTHORIZED_WRITE_SOURCES


def test_recon_scan_sweeps_many_points_quickly():
    injected = attack_frames(mixed_stream(["recon_scan"]), "recon_scan")
    points = {(f.dst_ip, f.unit_id, f.address) for f in injected}
    assert len(points) >= 50
    assert all(f.is_read for f in injected)
    assert {f.src_ip for f in injected} == {config.ATTACKER_IP}
    span = injected[-1].timestamp - injected[0].timestamp
    assert span < 10.0, "a scan is fast; benign polling never covers this in seconds"


def test_malformed_frames_fail_structural_validation():
    injected = attack_frames(mixed_stream(["malformed_frame"]), "malformed_frame")
    assert len(injected) >= 2
    assert all(not f.is_valid() for f in injected)


def test_replay_flood_is_identical_frames_at_high_rate():
    injected = attack_frames(mixed_stream(["replay_flood"]), "replay_flood")
    assert len(injected) >= 20
    first = injected[0]
    for frame in injected[1:]:
        # A replay is byte-identical on the wire — same txn ID and payload —
        # only the observation timestamp differs.
        assert (frame.transaction_id, frame.function_code, frame.address, frame.values, frame.src_ip) == (
            first.transaction_id,
            first.function_code,
            first.address,
            first.values,
            first.src_ip,
        )
    span = injected[-1].timestamp - injected[0].timestamp
    assert span < 2.0


def test_all_scenarios_compose_and_are_deterministic():
    names = sorted(ATTACK_SCENARIOS)
    a = mixed_stream(names)
    b = mixed_stream(names)
    assert a == b
    for name in names:
        assert attack_frames(a, name), f"{name} missing from composed stream"


def test_unknown_scenario_raises():
    with pytest.raises(ValueError, match="unknown scenario"):
        mixed_stream(["nonexistent_attack"])
