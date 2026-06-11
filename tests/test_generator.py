"""Tests for the Modbus frame model and benign traffic generator (Phase 1)."""

from __future__ import annotations

import pytest

from ics_sentinel import config
from ics_sentinel.generator import ProcessSimulator, TrafficGenerator, merge_streams
from ics_sentinel.modbus import BENIGN_LABEL, FunctionCode, ModbusFrame


@pytest.fixture(scope="module")
def benign_frames() -> list[ModbusFrame]:
    return TrafficGenerator(seed=config.DEFAULT_SEED).generate_benign(120.0)


def test_all_frames_structurally_valid(benign_frames):
    assert benign_frames, "generator produced no traffic"
    assert all(f.is_valid() for f in benign_frames)


def test_all_frames_labeled_benign(benign_frames):
    assert all(f.label == BENIGN_LABEL for f in benign_frames)


def test_frames_chronologically_ordered(benign_frames):
    timestamps = [f.timestamp for f in benign_frames]
    assert timestamps == sorted(timestamps)


def test_writes_only_from_engineering_workstation(benign_frames):
    write_sources = {f.src_ip for f in benign_frames if f.is_write}
    assert write_sources <= config.AUTHORIZED_WRITE_SOURCES


def test_benign_writes_stay_in_safe_range(benign_frames):
    lo, hi = config.SAFE_REGISTER_RANGES[config.PUMP_SETPOINT_REGISTER]
    for frame in benign_frames:
        if frame.is_write:
            assert frame.address == config.PUMP_SETPOINT_REGISTER
            assert lo <= frame.values[0] <= hi


def test_tank_levels_physically_plausible(benign_frames):
    levels = [
        f.values[0]
        for f in benign_frames
        if f.is_read and f.address == config.TANK_LEVEL_REGISTER
    ]
    assert levels, "no tank-level reads in stream"
    assert all(0 <= level <= 100 for level in levels)


def test_poll_cadence_matches_config(benign_frames):
    """Consecutive level reads of the same PLC should be ~one poll interval apart."""
    plc = config.PLCS[0]
    poll_times = [
        f.timestamp
        for f in benign_frames
        if f.dst_ip == plc.ip and f.address == config.TANK_LEVEL_REGISTER
    ]
    gaps = [b - a for a, b in zip(poll_times, poll_times[1:])]
    assert gaps, "need at least two poll cycles"
    for gap in gaps:
        assert gap == pytest.approx(config.POLL_INTERVAL_S, abs=2 * config.POLL_JITTER_S)


def test_transaction_ids_contiguous_per_source(benign_frames):
    """Each master issues txn IDs 1..N with no gaps or repeats.

    Observation order may differ slightly from issue order (timestamp
    jitter), so we check the ID set rather than strict wire ordering.
    """
    ids_by_source: dict[str, list[int]] = {}
    for frame in benign_frames:
        ids_by_source.setdefault(frame.src_ip, []).append(frame.transaction_id)
    for ids in ids_by_source.values():
        assert sorted(ids) == list(range(1, len(ids) + 1))


def test_generation_is_deterministic():
    a = TrafficGenerator(seed=7).generate_benign(30.0)
    b = TrafficGenerator(seed=7).generate_benign(30.0)
    assert a == b


def test_different_seeds_differ():
    a = TrafficGenerator(seed=1).generate_benign(30.0)
    b = TrafficGenerator(seed=2).generate_benign(30.0)
    assert a != b


def test_process_simulator_holds_level_near_setpoint():
    proc = ProcessSimulator(level=50.0, setpoint=60)
    for _ in range(500):
        proc.step(2.0)
    assert 60 - 5 <= proc.level <= 60 + 5


def test_merge_streams_orders_by_timestamp():
    gen = TrafficGenerator(seed=3)
    stream = gen.generate_benign(20.0)
    odd, even = stream[1::2], stream[0::2]
    assert merge_streams(odd, even) == stream


def test_illegal_function_code_is_invalid():
    frame = ModbusFrame(
        transaction_id=1,
        unit_id=1,
        function_code=0x5A,  # not a real Modbus function
        address=0,
        values=(1,),
        src_ip="10.0.0.99",
        dst_ip=config.PLCS[0].ip,
        timestamp=config.SIMULATION_START_EPOCH,
    )
    assert not frame.is_valid()
    assert "Illegal" in frame.function_name


def test_write_single_register_requires_one_value():
    frame = ModbusFrame(
        transaction_id=1,
        unit_id=1,
        function_code=FunctionCode.WRITE_SINGLE_REGISTER,
        address=config.PUMP_SETPOINT_REGISTER,
        values=(10, 20),  # two values on a single-register write is malformed
        src_ip=config.EWS_IP,
        dst_ip=config.PLCS[0].ip,
        timestamp=config.SIMULATION_START_EPOCH,
    )
    assert not frame.is_valid()
