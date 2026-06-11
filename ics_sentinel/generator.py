"""Synthetic Modbus TCP traffic generator.

Produces a realistic benign baseline: an HMI master politely polling two PLC
slaves on a fixed cadence, with occasional legitimate setpoint writes from
the engineering workstation. Register values come from a tiny physical
process simulation, so the traffic is coherent over time rather than random
noise — tank levels rise while the pump runs and fall while it doesn't.

Phase 2 adds attack scenarios as separate frame lists merged into this
baseline by timestamp (see :func:`merge_streams`).
"""

from __future__ import annotations

import random
from itertools import count

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
        plc: config.PlcDevice,
        function_code: int,
        address: int,
        values: tuple[int, ...],
        label: str = BENIGN_LABEL,
    ) -> ModbusFrame:
        return ModbusFrame(
            transaction_id=self._next_txn(src_ip),
            unit_id=plc.unit_id,
            function_code=function_code,
            address=address,
            values=values,
            src_ip=src_ip,
            dst_ip=plc.ip,
            timestamp=self._jittered(t),
            label=label,
        )

    def _poll_plc(self, t: float, plc: config.PlcDevice) -> list[ModbusFrame]:
        """One HMI poll cycle against one PLC: level, setpoint, pump state."""
        proc = self.processes[plc.unit_id]
        return [
            self._frame(
                t=t,
                src_ip=config.HMI_IP,
                plc=plc,
                function_code=FunctionCode.READ_HOLDING_REGISTERS,
                address=config.TANK_LEVEL_REGISTER,
                values=(round(proc.level),),
            ),
            self._frame(
                t=t + 0.01,
                src_ip=config.HMI_IP,
                plc=plc,
                function_code=FunctionCode.READ_HOLDING_REGISTERS,
                address=config.PUMP_SETPOINT_REGISTER,
                values=(proc.setpoint,),
            ),
            self._frame(
                t=t + 0.02,
                src_ip=config.HMI_IP,
                plc=plc,
                function_code=FunctionCode.READ_COILS,
                address=config.PUMP_RUN_COIL,
                values=(int(proc.pump_on),),
            ),
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
                plc=plc,
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


def merge_streams(*streams: list[ModbusFrame]) -> list[ModbusFrame]:
    """Merge frame lists into one timestamp-ordered stream.

    Phase 2 uses this to splice attack frames into the benign baseline.
    """
    merged = [frame for stream in streams for frame in stream]
    merged.sort(key=lambda f: f.timestamp)
    return merged
