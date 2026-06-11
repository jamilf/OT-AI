"""One-command demo: ``python -m ics_sentinel.demo``.

Phase 1: generate a benign traffic stream and print it. Later phases extend
this into the full pipeline (detect → ATT&CK map → AI triage → report).
"""

from __future__ import annotations

import argparse
from collections import Counter

from . import config
from .generator import TrafficGenerator
from .modbus import ModbusFrame


def summarize(frames: list[ModbusFrame]) -> str:
    reads = sum(1 for f in frames if f.is_read)
    writes = sum(1 for f in frames if f.is_write)
    sources = Counter(f.src_ip for f in frames)
    src_part = ", ".join(f"{ip} ({n})" for ip, n in sources.most_common())
    duration = frames[-1].timestamp - frames[0].timestamp if frames else 0.0
    return (
        f"{len(frames)} frames over {duration:.1f}s — "
        f"{reads} reads / {writes} writes — sources: {src_part}"
    )


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        prog="python -m ics_sentinel.demo",
        description="ICS Sentinel demo — Phase 1: synthetic benign Modbus TCP traffic.",
    )
    parser.add_argument(
        "--duration",
        type=float,
        default=config.DEFAULT_DURATION_S,
        help=f"seconds of traffic to simulate (default {config.DEFAULT_DURATION_S:g})",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=config.DEFAULT_SEED,
        help=f"RNG seed for reproducible runs (default {config.DEFAULT_SEED})",
    )
    args = parser.parse_args(argv)

    frames = TrafficGenerator(seed=args.seed).generate_benign(args.duration)

    print("ICS Sentinel — synthetic Modbus TCP traffic (benign baseline)")
    print(
        f"HMI master {config.HMI_IP} polling "
        + ", ".join(f"{p.name} ({p.ip}, unit {p.unit_id})" for p in config.PLCS)
        + f"; writes only from EWS {config.EWS_IP}"
    )
    print("-" * 100)
    for frame in frames:
        marker = "  [EWS write]" if frame.is_write else ""
        print(f"{frame}{marker}")
    print("-" * 100)
    print(summarize(frames))


if __name__ == "__main__":
    try:
        main()
    except BrokenPipeError:  # e.g. `python -m ics_sentinel.demo | head`
        pass
