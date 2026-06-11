"""Synthetic Modbus TCP traffic generator: benign baseline + attack scenarios.

Benign traffic is a realistic baseline: an HMI master politely polling two
PLC slaves on a fixed cadence, with occasional legitimate setpoint writes
from the engineering workstation. Register values come from a tiny physical
process simulation, so the traffic is coherent over time rather than random
noise — tank levels rise while the pump runs and fall while it doesn't.

Attack scenarios (Phase 2) are generated as separate, ground-truth-labeled
frame lists and spliced into the baseline by timestamp. Each scenario name in
:data:`ATTACK_SCENARIOS` maps to a generator method; the demo exposes them
via ``--scenario``. Labels are for tests and demo annotation only — the
detection engine (Phase 3) never reads them.
"""

from __future__ import annotations

import random
from dataclasses import replace
from itertools import count
from typing import Callable

from . import config
from .modbus import BENIGN_LABEL, FunctionCode, ModbusFrame


class ProcessSimulator:
    """Minimal water-tank physics for one PLC.

    The pump controller uses simple hysteresis around the setpoint: the pump
    starts when the level drops 2% below setpoint and stops 2% above it.
    While running, the pump fills faster than the constant downstream demand
    drains the tank.
    """

    FILL_RATE = 0.9  # % per second while pump runs (net of demand)
    DRAIN_RATE = 0.4  # % per second while pump is off
    HYSTERESIS = 2.0

    def __init__(self, level: float, setpoint: int) -> None:
        self.level = level
        self.setpoint = setpoint
        self.pump_on = level < setpoint

    def step(self, dt: float) -> None:
        if self.pump_on:
            self.level += self.FILL_RATE * dt
            if self.level > self.setpoint + self.HYSTERESIS:
                self.pump_on = False
        else:
            self.level -= self.DRAIN_RATE * dt
            if self.level < self.setpoint - self.HYSTERESIS:
                self.pump_on = True
        self.level = max(0.0, min(100.0, self.level))


class TrafficGenerator:
    """Builds time-ordered streams of :class:`ModbusFrame` objects."""

    def __init__(self, seed: int = config.DEFAULT_SEED) -> None:
        self.rng = random.Random(seed)
        # Per-source monotonically increasing transaction IDs, like a real
        # master's TCP stack would produce.
        self._txn_counters: dict[str, count] = {}
        # One simulated process per PLC, started at slightly different states
        # so the two tanks don't move in lockstep.
        self.processes: dict[int, ProcessSimulator] = {
            plc.unit_id: ProcessSimulator(
                level=self.rng.uniform(45.0, 75.0),
                setpoint=self.rng.randint(55, 70),
            )
            for plc in config.PLCS
        }

    def _next_txn(self, src_ip: str) -> int:
        counter = self._txn_counters.setdefault(src_ip, count(1))
        return next(counter) & 0xFFFF

    def _jittered(self, t: float) -> float:
        return t + self.rng.uniform(0.0, config.POLL_JITTER_S)

    def _frame(
        self,
        *,
        t: float,
        src_ip: str,
        dst_ip: str,
        unit_id: int,
        function_code: int,
        address: int,
        values: tuple[int, ...],
        label: str = BENIGN_LABEL,
    ) -> ModbusFrame:
        return ModbusFrame(
            transaction_id=self._next_txn(src_ip),
            unit_id=unit_id,
            function_code=function_code,
            address=address,
            values=values,
            src_ip=src_ip,
            dst_ip=dst_ip,
            timestamp=self._jittered(t),
            label=label,
        )

    # ------------------------------------------------------------------
    # Benign baseline
    # ------------------------------------------------------------------

    def _poll_plc(self, t: float, plc: config.PlcDevice) -> list[ModbusFrame]:
        """One HMI poll cycle against one PLC: level, setpoint, pump state."""
        proc = self.processes[plc.unit_id]
        points = (
            (FunctionCode.READ_HOLDING_REGISTERS, config.TANK_LEVEL_REGISTER, round(proc.level)),
            (FunctionCode.READ_HOLDING_REGISTERS, config.PUMP_SETPOINT_REGISTER, proc.setpoint),
            (FunctionCode.READ_COILS, config.PUMP_RUN_COIL, int(proc.pump_on)),
        )
        return [
            self._frame(
                t=t + i * 0.01,
                src_ip=config.HMI_IP,
                dst_ip=plc.ip,
                unit_id=plc.unit_id,
                function_code=fc,
                address=addr,
                values=(value,),
            )
            for i, (fc, addr, value) in enumerate(points)
        ]

    def _maybe_setpoint_write(self, t: float) -> list[ModbusFrame]:
        """Occasional legitimate setpoint change from the engineering workstation."""
        if self.rng.random() >= config.SETPOINT_WRITE_PROBABILITY:
            return []
        plc = self.rng.choice(config.PLCS)
        lo, hi = config.SAFE_REGISTER_RANGES[config.PUMP_SETPOINT_REGISTER]
        new_setpoint = self.rng.randint(lo, hi)
        self.processes[plc.unit_id].setpoint = new_setpoint
        return [
            self._frame(
                t=t + 0.5,
                src_ip=config.EWS_IP,
                dst_ip=plc.ip,
                unit_id=plc.unit_id,
                function_code=FunctionCode.WRITE_SINGLE_REGISTER,
                address=config.PUMP_SETPOINT_REGISTER,
                values=(new_setpoint,),
            )
        ]

    def generate_benign(
        self, duration_s: float = config.DEFAULT_DURATION_S
    ) -> list[ModbusFrame]:
        """Generate ``duration_s`` of benign traffic, sorted by timestamp."""
        frames: list[ModbusFrame] = []
        t = config.SIMULATION_START_EPOCH
        end = t + duration_s
        while t < end:
            for plc in config.PLCS:
                frames.extend(self._poll_plc(t, plc))
            frames.extend(self._maybe_setpoint_write(t))
            for proc in self.processes.values():
                proc.step(config.POLL_INTERVAL_S)
            t += config.POLL_INTERVAL_S
        frames.sort(key=lambda f: f.timestamp)
        return frames

    # ------------------------------------------------------------------
    # Attack scenarios — each returns a labeled frame list starting at t0.
    # Attack frames are wire events only: they do not feed back into the
    # process simulation (see DESIGN.md).
    # ------------------------------------------------------------------

    def attack_unauthorized_write(self, t0: float) -> list[ModbusFrame]:
        """Pump shut off, then setpoint changed, by a host that is not the EWS.

        The written values are perfectly ordinary — what makes this malicious
        is the *source*. Exercises the write-allowlist rule in isolation.
        """
        plc = config.PLCS[0]
        return [
            self._frame(
                t=t0,
                src_ip=config.ATTACKER_IP,
                dst_ip=plc.ip,
                unit_id=plc.unit_id,
                function_code=FunctionCode.WRITE_SINGLE_COIL,
                address=config.PUMP_RUN_COIL,
                values=(0,),
                label="unauthorized_write",
            ),
            self._frame(
                t=t0 + 1.3,
                src_ip=config.ATTACKER_IP,
                dst_ip=plc.ip,
                unit_id=plc.unit_id,
                function_code=FunctionCode.WRITE_SINGLE_REGISTER,
                address=config.PUMP_SETPOINT_REGISTER,
                values=(30,),
                label="unauthorized_write",
            ),
        ]

    def attack_dangerous_setpoint(self, t0: float) -> list[ModbusFrame]:
        """Setpoint driven far past the physical maximum — from the EWS itself.

        Sourced from the *authorized* workstation (compromised or insider) so
        only the process-safety rule fires, not the allowlist rule: a tank
        cannot be 200% full, and a controller chasing that setpoint will
        overflow it.
        """
        plc = config.PLCS[1]
        return [
            self._frame(
                t=t0,
                src_ip=config.EWS_IP,
                dst_ip=plc.ip,
                unit_id=plc.unit_id,
                function_code=FunctionCode.WRITE_SINGLE_REGISTER,
                address=config.PUMP_SETPOINT_REGISTER,
                values=(200,),
                label="dangerous_setpoint",
            )
        ]

    def attack_recon_scan(self, t0: float) -> list[ModbusFrame]:
        """Modbus enumeration: one source sweep-reading registers across unit IDs.

        Sweeps 20 consecutive registers on unit IDs 1–4 of each PLC at ~25 ms
        spacing — far more distinct addresses/units than any legitimate poller
        touches, in seconds.
        """
        frames: list[ModbusFrame] = []
        t = t0
        for plc in config.PLCS:
            for unit_id in range(1, 5):  # probes units that don't even exist
                for offset in range(20):
                    frames.append(
                        self._frame(
                            t=t,
                            src_ip=config.ATTACKER_IP,
                            dst_ip=plc.ip,
                            unit_id=unit_id,
                            function_code=FunctionCode.READ_HOLDING_REGISTERS,
                            address=config.TANK_LEVEL_REGISTER + offset,
                            values=(0,),
                            label="recon_scan",
                        )
                    )
                    t += 0.025
        return frames

    def attack_malformed_frame(self, t0: float) -> list[ModbusFrame]:
        """Structurally invalid traffic: illegal function codes + bad PDU.

        Fuzzing, a broken exploit tool, or protocol abuse — none of these
        codes/shapes belong on a healthy Modbus network.
        """
        plc = config.PLCS[0]
        common = dict(src_ip=config.ATTACKER_IP, dst_ip=plc.ip, unit_id=plc.unit_id)
        return [
            self._frame(  # function code 0x5A is not defined by Modbus
                t=t0,
                function_code=0x5A,
                address=config.TANK_LEVEL_REGISTER,
                values=(1,),
                label="malformed_frame",
                **common,
            ),
            self._frame(  # function code 0 is reserved/illegal
                t=t0 + 0.4,
                function_code=0x00,
                address=0,
                values=(0,),
                label="malformed_frame",
                **common,
            ),
            self._frame(  # write-single-register PDU carrying two values
                t=t0 + 0.8,
                function_code=FunctionCode.WRITE_SINGLE_REGISTER,
                address=config.PUMP_SETPOINT_REGISTER,
                values=(60, 61),
                label="malformed_frame",
                **common,
            ),
        ]

    def attack_replay_flood(self, t0: float) -> list[ModbusFrame]:
        """A captured pump-off command replayed 40× at 25 ms intervals.

        Replayed frames are byte-identical — same transaction ID — with only
        the wire timestamp differing. Benign writes arrive minutes apart;
        this is 40 in one second: control flooding / DoS.
        """
        plc = config.PLCS[0]
        captured = self._frame(
            t=t0,
            src_ip=config.ATTACKER_IP,
            dst_ip=plc.ip,
            unit_id=plc.unit_id,
            function_code=FunctionCode.WRITE_SINGLE_COIL,
            address=config.PUMP_RUN_COIL,
            values=(0,),
            label="replay_flood",
        )
        return [
            replace(captured, timestamp=captured.timestamp + i * 0.025)
            for i in range(40)
        ]

    # ------------------------------------------------------------------
    # Mixed streams
    # ------------------------------------------------------------------

    def generate_with_scenarios(
        self,
        duration_s: float = config.DEFAULT_DURATION_S,
        scenarios: tuple[str, ...] | list[str] = (),
    ) -> list[ModbusFrame]:
        """Benign baseline with the named attack scenarios spliced in.

        Attacks are spread deterministically across the middle 60% of the
        capture window, in the order given.
        """
        unknown = [name for name in scenarios if name not in ATTACK_SCENARIOS]
        if unknown:
            raise ValueError(
                f"unknown scenario(s) {unknown}; valid: {sorted(ATTACK_SCENARIOS)}"
            )
        streams = [self.generate_benign(duration_s)]
        for i, name in enumerate(scenarios):
            t0 = config.SIMULATION_START_EPOCH + duration_s * (
                0.2 + 0.6 * i / len(scenarios)
            )
            streams.append(ATTACK_SCENARIOS[name](self, t0))
        return merge_streams(*streams)


#: Scenario name → generator method, as exposed by ``demo.py --scenario``.
ATTACK_SCENARIOS: dict[str, Callable[[TrafficGenerator, float], list[ModbusFrame]]] = {
    "unauthorized_write": TrafficGenerator.attack_unauthorized_write,
    "dangerous_setpoint": TrafficGenerator.attack_dangerous_setpoint,
    "recon_scan": TrafficGenerator.attack_recon_scan,
    "malformed_frame": TrafficGenerator.attack_malformed_frame,
    "replay_flood": TrafficGenerator.attack_replay_flood,
}


def merge_streams(*streams: list[ModbusFrame]) -> list[ModbusFrame]:
    """Merge frame lists into one timestamp-ordered stream."""
    merged = [frame for stream in streams for frame in stream]
    merged.sort(key=lambda f: f.timestamp)
    return merged
