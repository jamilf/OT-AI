"""Central configuration for the simulated plant and (later) detection thresholds.

Everything that describes the monitored environment lives here so the
generator (Phase 1), detection engine (Phase 3), and triage context (Phase 5)
all share a single source of truth.

The simulated process is a small water-treatment skid:

    PLC 1 (10.0.0.20, unit 1) — raw-water intake tank
    PLC 2 (10.0.0.21, unit 2) — treated-water storage tank

Each PLC exposes:
    holding register 40001 — tank level, percent (0–100)
    holding register 40002 — pump setpoint, percent (0–100)
    coil 0                 — pump run state (on/off)
"""

from __future__ import annotations

from dataclasses import dataclass

# ---------------------------------------------------------------------------
# Network topology
# ---------------------------------------------------------------------------

HMI_IP = "10.0.0.10"  # SCADA/HMI master — polls the PLCs, never writes
EWS_IP = "10.0.0.11"  # engineering workstation — the only authorized write source
ATTACKER_IP = "10.0.0.66"  # compromised host used by the attack scenarios


@dataclass(frozen=True)
class PlcDevice:
    """A monitored PLC slave."""

    name: str
    ip: str
    unit_id: int


PLCS: tuple[PlcDevice, ...] = (
    PlcDevice(name="PLC-1 intake", ip="10.0.0.20", unit_id=1),
    PlcDevice(name="PLC-2 storage", ip="10.0.0.21", unit_id=2),
)

# IPs allowed to issue Modbus write commands (Phase 3: unauthorized-write rule).
AUTHORIZED_WRITE_SOURCES: frozenset[str] = frozenset({EWS_IP})

# ---------------------------------------------------------------------------
# Process model (register map)
# ---------------------------------------------------------------------------

TANK_LEVEL_REGISTER = 40001  # percent full, read-only in practice
PUMP_SETPOINT_REGISTER = 40002  # target level the pump controller holds
PUMP_RUN_COIL = 0  # pump on/off

# Physically safe value ranges per writable point (Phase 3: safety-violation
# rule). Reads outside these ranges are also suspicious — a real tank cannot
# be 250% full.
SAFE_REGISTER_RANGES: dict[int, tuple[int, int]] = {
    TANK_LEVEL_REGISTER: (0, 100),
    PUMP_SETPOINT_REGISTER: (20, 90),  # operating envelope for the setpoint
}

# ---------------------------------------------------------------------------
# Benign traffic shape
# ---------------------------------------------------------------------------

POLL_INTERVAL_S = 2.0  # HMI polls each PLC every cycle
POLL_JITTER_S = 0.05  # small network/scheduler jitter on each frame
SETPOINT_WRITE_PROBABILITY = 0.03  # chance per poll cycle of a legit EWS write

DEFAULT_DURATION_S = 60.0
DEFAULT_SEED = 42

# Fixed simulation epoch so seeded runs are byte-for-byte reproducible
# (2026-01-05 08:00:00 UTC).
SIMULATION_START_EPOCH = 1767600000.0
