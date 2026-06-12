"""One-command end-to-end demo: ``python -m ics_sentinel.demo`` (or ``make demo``).

Pipeline: generate traffic (benign + attack scenarios) → detect → map to
MITRE ATT&CK for ICS → AI triage (Claude, or deterministic [MOCK] fallback)
→ ranked incident report.
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter

from . import attack_map, config, report
from .detection import DetectionEngine
from .generator import ATTACK_SCENARIOS, TrafficGenerator
from .modbus import BENIGN_LABEL, ModbusFrame
from .triage import Triager


def print_traffic(frames: list[ModbusFrame]) -> None:
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


def traffic_summary(frames: list[ModbusFrame]) -> str:
    reads = sum(1 for f in frames if f.is_read)
    writes = sum(1 for f in frames if f.is_write)
    other = len(frames) - reads - writes
    sources = Counter(f.src_ip for f in frames)
    parts = (
        f"{len(frames)} frames — {reads} reads / {writes} writes"
        + (f" / {other} illegal" if other else "")
        + " — sources: "
        + ", ".join(f"{ip} ({n})" for ip, n in sources.most_common())
    )
    attacks = Counter(f.label for f in frames if f.label != BENIGN_LABEL)
    if attacks:
        parts += "\n  injected (ground truth): " + ", ".join(
            f"{name} ({n})" for name, n in attacks.most_common()
        )
    return parts


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        prog="python -m ics_sentinel.demo",
        description="ICS Sentinel — full pipeline demo: synthetic Modbus TCP "
        "traffic → detection → ATT&CK mapping → AI triage → report.",
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
        help="attack scenario to inject (repeatable). Default: all. "
        "Choices: " + ", ".join([*ATTACK_SCENARIOS, "all"]),
    )
    parser.add_argument(
        "--benign",
        action="store_true",
        help="run on a clean benign baseline (no attacks injected)",
    )
    parser.add_argument(
        "--show-traffic",
        action="store_true",
        help="also print the raw frame stream before the report",
    )
    parser.add_argument(
        "--plain",
        action="store_true",
        help="force the plain-text report (no rich panels)",
    )
    parser.add_argument(
        "--output",
        metavar="PATH",
        help="also write the report to a file (.md or .json, by extension)",
    )
    args = parser.parse_args(argv)
    if args.output and not args.output.endswith((".md", ".json")):
        parser.error("--output must end in .md or .json")

    if args.benign:
        scenarios: list[str] = []
    elif not args.scenario or "all" in args.scenario:
        scenarios = list(ATTACK_SCENARIOS)
    else:
        scenarios = list(args.scenario)

    # 1. Traffic
    generator = TrafficGenerator(seed=args.seed)
    frames = generator.generate_with_scenarios(args.duration, scenarios)
    print(
        f"[1/4] Generated {args.duration:g}s of Modbus TCP traffic"
        + (f" with scenarios: {', '.join(scenarios)}" if scenarios else " (benign)"),
        file=sys.stderr,
    )
    if args.show_traffic:
        print_traffic(frames)
    print("      " + traffic_summary(frames).replace("\n", "\n      "), file=sys.stderr)

    # 2. Detection
    alerts = DetectionEngine().analyze(frames)
    print(f"[2/4] Detection engine raised {len(alerts)} alert(s)", file=sys.stderr)

    # 3. ATT&CK mapping
    alerts = attack_map.enrich(alerts)
    technique_ids = sorted({t.technique_id for a in alerts for t in a.techniques})
    print(
        f"[3/4] Mapped to MITRE ATT&CK for ICS: {', '.join(technique_ids) or '—'}",
        file=sys.stderr,
    )

    # 4. Triage + report
    triager = Triager()
    print(
        f"[4/4] Triage mode: {triager.mode}"
        + ("" if triager.mode == "AI" else "  (set ANTHROPIC_API_KEY for AI triage)"),
        file=sys.stderr,
    )
    results = triager.triage_all(alerts)
    summary = triager.executive_summary(alerts, results)
    print(file=sys.stderr)
    report.render(alerts, results, summary, triager.mode, force_plain=args.plain)

    if args.output:
        exporter = report.to_json if args.output.endswith(".json") else report.to_markdown
        with open(args.output, "w", encoding="utf-8") as fh:
            fh.write(exporter(alerts, results, summary, triager.mode) + "\n")
        print(f"Report written to {args.output}", file=sys.stderr)


if __name__ == "__main__":
    try:
        main()
    except BrokenPipeError:  # e.g. `python -m ics_sentinel.demo | head`
        pass
