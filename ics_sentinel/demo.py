"""One-command demo: ``python -m ics_sentinel.demo``.

Phase 2: generate benign traffic with optional injected attack scenarios
(``--scenario``). Later phases extend this into the full pipeline
(detect → ATT&CK map → AI triage → report).
"""

from __future__ import annotations

import argparse
from collections import Counter

from . import config
from .generator import ATTACK_SCENARIOS, TrafficGenerator
from .modbus import BENIGN_LABEL, ModbusFrame


def summarize(frames: list[ModbusFrame]) -> str:
    reads = sum(1 for f in frames if f.is_read)
    writes = sum(1 for f in frames if f.is_write)
    other = len(frames) - reads - writes
    sources = Counter(f.src_ip for f in frames)
    src_part = ", ".join(f"{ip} ({n})" for ip, n in sources.most_common())
    duration = frames[-1].timestamp - frames[0].timestamp if frames else 0.0
    lines = [
        f"{len(frames)} frames over {duration:.1f}s — "
        f"{reads} reads / {writes} writes"
        + (f" / {other} illegal" if other else "")
        + f" — sources: {src_part}"
    ]
    attacks = Counter(f.label for f in frames if f.label != BENIGN_LABEL)
    if attacks:
        attack_part = ", ".join(f"{name} ({n})" for name, n in attacks.most_common())
        lines.append(f"injected attack frames (ground truth): {attack_part}")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        prog="python -m ics_sentinel.demo",
        description="ICS Sentinel demo — synthetic Modbus TCP traffic, "
        "optionally with injected attack scenarios.",
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
    parser.add_argument(
        "--scenario",
        action="append",
        default=[],
        choices=[*ATTACK_SCENARIOS, "all"],
        metavar="NAME",
        help="attack scenario to inject (repeatable); one of: "
        + ", ".join([*ATTACK_SCENARIOS, "all"]),
    )
    args = parser.parse_args(argv)

    scenarios = (
        list(ATTACK_SCENARIOS) if "all" in args.scenario else list(args.scenario)
    )
    frames = TrafficGenerator(seed=args.seed).generate_with_scenarios(
        args.duration, scenarios
    )

    print("ICS Sentinel — synthetic Modbus TCP traffic")
    print(
        f"HMI master {config.HMI_IP} polling "
        + ", ".join(f"{p.name} ({p.ip}, unit {p.unit_id})" for p in config.PLCS)
        + f"; writes only from EWS {config.EWS_IP}"
    )
    if scenarios:
        print(f"injected scenarios: {', '.join(scenarios)}")
    print("-" * 100)
    for frame in frames:
        if frame.label != BENIGN_LABEL:
            marker = f"  ⚠ ATTACK[{frame.label}]"
        elif frame.is_write:
            marker = "  [EWS write]"
        else:
            marker = ""
        print(f"{frame}{marker}")
    print("-" * 100)
    print(summarize(frames))


if __name__ == "__main__":
    try:
        main()
    except BrokenPipeError:  # e.g. `python -m ics_sentinel.demo | head`
        pass
