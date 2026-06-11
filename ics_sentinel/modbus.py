"""Modbus TCP frame model.

Frames are plain typed Python objects, not raw bytes — the demo needs no
sockets, scapy, or ICS hardware. Each :class:`ModbusFrame` represents one
observed request/response transaction on the wire: for reads, ``values``
holds the data the slave returned; for writes, the data the master sent.

Modbus has no authentication or encryption, so every field here is exactly
what any device on the network could forge — which is the whole point of
monitoring it.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import IntEnum


class FunctionCode(IntEnum):
    """The common Modbus function codes ICS Sentinel understands."""

    READ_COILS = 1
    READ_DISCRETE_INPUTS = 2
    READ_HOLDING_REGISTERS = 3
    READ_INPUT_REGISTERS = 4
    WRITE_SINGLE_COIL = 5
    WRITE_SINGLE_REGISTER = 6
    WRITE_MULTIPLE_REGISTERS = 16

    @property
    def display_name(self) -> str:
        return self.name.replace("_", " ").title()


READ_CODES: frozenset[int] = frozenset(
    {
        FunctionCode.READ_COILS,
        FunctionCode.READ_DISCRETE_INPUTS,
        FunctionCode.READ_HOLDING_REGISTERS,
        FunctionCode.READ_INPUT_REGISTERS,
    }
)

WRITE_CODES: frozenset[int] = frozenset(
    {
        FunctionCode.WRITE_SINGLE_COIL,
        FunctionCode.WRITE_SINGLE_REGISTER,
        FunctionCode.WRITE_MULTIPLE_REGISTERS,
    }
)

KNOWN_CODES: frozenset[int] = READ_CODES | WRITE_CODES

# Protocol limits used for structural validation.
MAX_TRANSACTION_ID = 0xFFFF
MAX_UNIT_ID = 0xFF
MAX_REGISTER_VALUE = 0xFFFF

# Ground-truth label for traffic the generator considers legitimate. Attack
# scenarios (Phase 2) use their own labels. Labels exist for tests and demo
# annotation only — the detection engine never reads them.
BENIGN_LABEL = "benign"


@dataclass(frozen=True, slots=True)
class ModbusFrame:
    """One observed Modbus TCP transaction.

    ``function_code`` is a plain ``int`` rather than :class:`FunctionCode` so
    attack scenarios can inject illegal codes the enum doesn't define.
    """

    transaction_id: int
    unit_id: int
    function_code: int
    address: int
    values: tuple[int, ...]
    src_ip: str
    dst_ip: str
    timestamp: float  # unix epoch seconds
    label: str = field(default=BENIGN_LABEL, compare=False)

    @property
    def is_read(self) -> bool:
        return self.function_code in READ_CODES

    @property
    def is_write(self) -> bool:
        return self.function_code in WRITE_CODES

    @property
    def function_name(self) -> str:
        if self.function_code in KNOWN_CODES:
            return FunctionCode(self.function_code).display_name
        return f"Illegal Function ({self.function_code})"

    def is_valid(self) -> bool:
        """Structural validity: known function code and in-range fields.

        This is the groundwork for the Phase 3 malformed-frame rule; it says
        nothing about whether the frame is *authorized* or *safe*.
        """
        return (
            self.function_code in KNOWN_CODES
            and 0 <= self.transaction_id <= MAX_TRANSACTION_ID
            and 0 <= self.unit_id <= MAX_UNIT_ID
            and self.address >= 0
            and len(self.values) >= 1
            and all(0 <= v <= MAX_REGISTER_VALUE for v in self.values)
            # Single-point operations carry exactly one value.
            and (
                self.function_code == FunctionCode.WRITE_MULTIPLE_REGISTERS
                or self.function_code in READ_CODES
                or len(self.values) == 1
            )
        )

    def __str__(self) -> str:
        clock = datetime.fromtimestamp(self.timestamp, tz=timezone.utc).strftime(
            "%H:%M:%S.%f"
        )[:-3]
        arrow = "←" if self.is_read else "→"
        vals = ",".join(str(v) for v in self.values)
        return (
            f"{clock}  {self.src_ip} → {self.dst_ip} [unit {self.unit_id}] "
            f"txn={self.transaction_id:<5} {self.function_name:<28} "
            f"addr={self.address} {arrow} {vals}"
        )
