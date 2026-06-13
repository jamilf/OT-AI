"""Optional real-pcap ingestion via scapy (stretch goal).

Parses a captured ``.pcap``/``.pcapng`` of Modbus TCP (port 502) into the
same :class:`~ics_sentinel.modbus.ModbusFrame` objects the synthetic
generator produces, so the entire downstream pipeline — detection, ATT&CK
mapping, triage, report — works unchanged on real traffic.

``scapy`` is an optional dependency (``pip install 'ics-sentinel[pcap]'``);
it is imported lazily with a clear message if missing. Requests and
responses are paired by ``(src, dst, transaction_id)`` to match this tool's
merged-transaction model: a read's ``values`` are taken from the slave's
response, a write's from the master's request.
"""

from __future__ import annotations

import struct

from .modbus import KNOWN_CODES, READ_CODES, WRITE_CODES, ModbusFrame

MODBUS_PORT = 502
PCAP_LABEL = "pcap"


def _require_scapy():
    try:
        from scapy.all import IP, TCP, rdpcap  # noqa: F401

        return rdpcap, IP, TCP
    except ImportError as exc:  # pragma: no cover - exercised only without scapy
        raise ImportError(
            "pcap ingestion needs scapy. Install it with: "
            "pip install 'ics-sentinel[pcap]'  (or: pip install scapy)"
        ) from exc


def _parse_pdu(function_code: int, payload: bytes) -> tuple[int, tuple[int, ...]] | None:
    """Decode (address, values) from a Modbus PDU body (after the func code).

    Returns ``None`` for shapes we don't model. Read *responses* and write
    *requests* are what carry the data values we want; read requests and
    write responses are skipped (their data is redundant once paired).
    """
    try:
        if function_code in (1, 2, 3, 4):
            # Could be a request (addr, qty) or a response (bytecount, data).
            # Heuristic: a response's first byte is a byte count matching the
            # remaining length; otherwise treat as a request (no values yet).
            if payload and payload[0] == len(payload) - 1:
                data = payload[1:]
                if function_code in (3, 4):  # 16-bit registers
                    vals = struct.unpack(f">{len(data) // 2}H", data[: len(data) // 2 * 2])
                else:  # packed coil/discrete bits
                    vals = tuple(
                        (byte >> bit) & 1 for byte in data for bit in range(8)
                    )
                return (0, tuple(vals) or (0,))
            return None  # a read request carries no values
        if function_code in (5, 6):  # write single coil / register
            address, value = struct.unpack(">HH", payload[:4])
            if function_code == 5:  # coil: 0xFF00 = on
                value = 1 if value else 0
            return (address, (value,))
        if function_code == 16:  # write multiple registers
            address, qty, _bytecount = struct.unpack(">HHB", payload[:5])
            data = payload[5 : 5 + qty * 2]
            return (address, struct.unpack(f">{len(data) // 2}H", data))
    except struct.error:
        return None
    return None


def load_pcap(path: str) -> list[ModbusFrame]:
    """Load Modbus TCP transactions from a pcap into ModbusFrame objects."""
    rdpcap, IP, TCP = _require_scapy()
    packets = rdpcap(path)

    # First pass: collect candidate frames keyed for request/response pairing.
    requests: dict[tuple, dict] = {}
    frames: list[ModbusFrame] = []

    for pkt in packets:
        if IP not in pkt or TCP not in pkt:
            continue
        tcp = pkt[TCP]
        if tcp.dport != MODBUS_PORT and tcp.sport != MODBUS_PORT:
            continue
        raw = bytes(tcp.payload)
        if len(raw) < 8:  # MBAP (7) + at least a function code
            continue
        txn_id, _proto, _length, unit_id = struct.unpack(">HHHB", raw[:7])
        function_code = raw[7]
        if function_code not in KNOWN_CODES:
            # Keep malformed frames so the R4 rule can see them.
            frames.append(
                ModbusFrame(
                    transaction_id=txn_id,
                    unit_id=unit_id,
                    function_code=function_code,
                    address=0,
                    values=(0,),
                    src_ip=pkt[IP].src,
                    dst_ip=pkt[IP].dst,
                    timestamp=float(pkt.time),
                    label=PCAP_LABEL,
                )
            )
            continue

        is_to_slave = tcp.dport == MODBUS_PORT
        parsed = _parse_pdu(function_code, raw[8:])

        if function_code in WRITE_CODES and is_to_slave:
            # Write request carries the values — emit directly.
            if parsed:
                addr, vals = parsed
                frames.append(
                    ModbusFrame(
                        transaction_id=txn_id,
                        unit_id=unit_id,
                        function_code=function_code,
                        address=addr,
                        values=vals,
                        src_ip=pkt[IP].src,
                        dst_ip=pkt[IP].dst,
                        timestamp=float(pkt.time),
                        label=PCAP_LABEL,
                    )
                )
        elif function_code in READ_CODES:
            if is_to_slave:
                # Read request: remember it; the response carries the values.
                requests[(pkt[IP].src, pkt[IP].dst, txn_id, unit_id, function_code)] = {
                    "address": parsed[0] if parsed else 0,
                    "src": pkt[IP].src,
                    "dst": pkt[IP].dst,
                    "time": float(pkt.time),
                }
            elif parsed:
                # Read response: pair with the original request (reversed IPs).
                key = (pkt[IP].dst, pkt[IP].src, txn_id, unit_id, function_code)
                req = requests.pop(key, None)
                frames.append(
                    ModbusFrame(
                        transaction_id=txn_id,
                        unit_id=unit_id,
                        function_code=function_code,
                        address=req["address"] if req else parsed[0],
                        values=parsed[1],
                        src_ip=req["src"] if req else pkt[IP].dst,
                        dst_ip=req["dst"] if req else pkt[IP].src,
                        timestamp=req["time"] if req else float(pkt.time),
                        label=PCAP_LABEL,
                    )
                )

    frames.sort(key=lambda f: f.timestamp)
    return frames
