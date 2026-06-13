"""Round-trip tests for optional pcap ingestion (skipped without scapy)."""

from __future__ import annotations

import struct

import pytest

try:
    import scapy.all as scapy_all
except BaseException as exc:  # scapy's optional crypto backend can hard-crash
    pytest.skip(f"scapy unavailable: {exc}", allow_module_level=True)

from ics_sentinel import config  # noqa: E402
from ics_sentinel.detection import RULE_UNAUTHORIZED_WRITE, DetectionEngine  # noqa: E402
from ics_sentinel.modbus import FunctionCode  # noqa: E402
from ics_sentinel.pcap import PCAP_LABEL, load_pcap  # noqa: E402

Ether = scapy_all.Ether
IP = scapy_all.IP
TCP = scapy_all.TCP
wrpcap = scapy_all.wrpcap


def _mbap(txn: int, unit: int, pdu: bytes) -> bytes:
    return struct.pack(">HHHB", txn, 0, len(pdu) + 1, unit) + pdu


def _pkt(src, dst, sport, dport, payload, t):
    p = Ether() / IP(src=src, dst=dst) / TCP(sport=sport, dport=dport) / payload
    p.time = t
    return p


def _write_pcap(tmp_path, packets):
    path = tmp_path / "capture.pcap"
    wrpcap(str(path), packets)
    return str(path)


def test_pcap_round_trip_read_and_write(tmp_path):
    hmi, plc, ews = config.HMI_IP, config.PLCS[0].ip, config.EWS_IP
    fc_read = int(FunctionCode.READ_HOLDING_REGISTERS)
    fc_write = int(FunctionCode.WRITE_SINGLE_REGISTER)

    packets = [
        # HMI reads tank level: request then response (value 73).
        _pkt(hmi, plc, 5000, 502,
             _mbap(1, 1, struct.pack(">BHH", fc_read, 40001, 1)), 1000.0),
        _pkt(plc, hmi, 502, 5000,
             _mbap(1, 1, struct.pack(">BBH", fc_read, 2, 73)), 1000.1),
        # EWS writes setpoint 55.
        _pkt(ews, plc, 5001, 502,
             _mbap(2, 1, struct.pack(">BHH", fc_write, 40002, 55)), 1001.0),
    ]
    frames = load_pcap(_write_pcap(tmp_path, packets))

    assert all(f.label == PCAP_LABEL for f in frames)
    reads = [f for f in frames if f.is_read]
    writes = [f for f in frames if f.is_write]

    assert reads and reads[0].values == (73,)
    assert reads[0].src_ip == hmi and reads[0].dst_ip == plc  # paired correctly
    assert writes and writes[0].values == (55,)
    assert writes[0].address == 40002


def test_pcap_feeds_detection_engine(tmp_path):
    """A write from an unauthorized host in a pcap fires the same R1 rule."""
    plc = config.PLCS[0].ip
    fc_write = int(FunctionCode.WRITE_SINGLE_REGISTER)
    packets = [
        _pkt(config.ATTACKER_IP, plc, 6000, 502,
             _mbap(9, 1, struct.pack(">BHH", fc_write, 40002, 60)), 2000.0),
    ]
    frames = load_pcap(_write_pcap(tmp_path, packets))
    alerts = DetectionEngine().analyze(frames)
    assert any(a.rule_id == RULE_UNAUTHORIZED_WRITE for a in alerts)


def test_pcap_keeps_illegal_function_codes(tmp_path):
    plc = config.PLCS[0].ip
    packets = [
        _pkt(config.ATTACKER_IP, plc, 6000, 502,
             _mbap(9, 1, struct.pack(">BH", 0x5A, 0)), 3000.0),
    ]
    frames = load_pcap(_write_pcap(tmp_path, packets))
    assert frames and frames[0].function_code == 0x5A
    assert not frames[0].is_valid()
