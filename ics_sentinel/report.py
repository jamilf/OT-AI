"""Analyst report rendering.

Renders triaged incidents ranked Critical-first. Uses ``rich`` for an
attractive terminal report when available; falls back to a plain-text
renderer so the zero-dependency demo still produces a readable report.
The AI-vs-MOCK triage mode is labeled prominently in both renderers.
"""

from __future__ import annotations

from datetime import datetime, timezone

from .detection import Alert
from .triage import TriageResult

try:
    from rich import box
    from rich.console import Console, Group
    from rich.panel import Panel
    from rich.table import Table
    from rich.text import Text

    HAS_RICH = True
except ImportError:  # zero-dependency fallback
    HAS_RICH = False

SEVERITY_COLORS = {
    "Critical": "bold white on red",
    "High": "bold red",
    "Medium": "bold yellow",
    "Low": "bold green",
}


def _clock(timestamp: float) -> str:
    return datetime.fromtimestamp(timestamp, tz=timezone.utc).strftime(
        "%Y-%m-%d %H:%M:%S UTC"
    )


def _ranked(
    alerts: list[Alert], results: list[TriageResult]
) -> list[tuple[Alert, TriageResult]]:
    return sorted(
        zip(alerts, results), key=lambda p: (p[1].severity_rank, p[0].timestamp)
    )


def render(
    alerts: list[Alert],
    results: list[TriageResult],
    summary: str,
    mode: str,
) -> None:
    if HAS_RICH:
        _render_rich(alerts, results, summary, mode)
    else:
        _render_plain(alerts, results, summary, mode)


# ---------------------------------------------------------------------------
# rich renderer
# ---------------------------------------------------------------------------


def _render_rich(alerts, results, summary, mode) -> None:
    console = Console()
    badge = (
        "[bold green]\\[AI][/] triage by Claude"
        if mode == "AI"
        else "[bold yellow]\\[MOCK][/] deterministic triage "
        "(set ANTHROPIC_API_KEY for AI analysis)"
    )
    console.print(
        Panel(
            f"[bold]ICS Sentinel — Incident Report[/]\n"
            f"{len(alerts)} alert(s) · triage mode: {badge}",
            box=box.DOUBLE,
            style="cyan",
        )
    )
    console.print(
        Panel(summary, title="Executive summary", border_style="cyan", expand=True)
    )
    if not alerts:
        return

    for alert, result in _ranked(alerts, results):
        sev_style = SEVERITY_COLORS.get(result.severity, "bold")
        details = Table(show_header=False, box=box.SIMPLE, pad_edge=False)
        details.add_column(style="dim", width=14)
        details.add_column()
        # Text() cells: frame/technique strings contain literal brackets
        # ("[unit 2]") that rich would otherwise parse as markup.
        details.add_row("When", _clock(alert.timestamp))
        details.add_row("Flow", f"{alert.src_ip} → {alert.dst_ip}")
        frame = alert.raw_frame
        details.add_row(
            "Command",
            Text(
                f"{frame.function_name} · unit {frame.unit_id} · "
                f"addr {frame.address} · values {list(frame.values)[:8]}"
                + (f" · ×{alert.count}" if alert.count > 1 else "")
            ),
        )
        details.add_row("Detection", Text(alert.description))
        details.add_row(
            "ATT&CK (ICS)",
            Text("\n".join(str(t) for t in alert.techniques) or "—"),
        )

        body = [
            details,
            Text.assemble(("Severity: ", "dim"), (result.severity, sev_style)),
            Text(result.severity_justification, style="italic"),
            Text(""),
            Text("What happened (operator view)", style="bold"),
            Text(result.plain_english_explanation),
            Text(""),
            Text("Attack narrative", style="bold"),
            Text(result.attack_narrative),
            Text(""),
            Text("Confirmed techniques", style="bold"),
            *[Text(f"  • {t}") for t in result.confirmed_attack_techniques],
            Text(""),
            Text("Recommended actions", style="bold"),
            *[
                Text(f"  {i}. {action}")
                for i, action in enumerate(result.recommended_actions, 1)
            ],
            Text(""),
            Text(
                f"False-positive likelihood: {result.false_positive_likelihood} — "
                f"{result.false_positive_reasoning}",
                style="dim",
            ),
        ]
        console.print(
            Panel(
                Group(*body),
                title=f"[{sev_style}] {result.severity} [/] "
                f"[bold]{alert.id}[/] — {alert.rule_name} "
                f"[dim]\\[{result.mode}][/]",
                border_style=sev_style.split()[-1].replace("on ", ""),
            )
        )


# ---------------------------------------------------------------------------
# plain-text fallback (no dependencies)
# ---------------------------------------------------------------------------


def _render_plain(alerts, results, summary, mode) -> None:
    bar = "=" * 78
    mode_note = (
        "[AI] triage by Claude"
        if mode == "AI"
        else "[MOCK] deterministic triage (set ANTHROPIC_API_KEY for AI analysis)"
    )
    print(bar)
    print(f"ICS Sentinel — Incident Report   ({len(alerts)} alerts, {mode_note})")
    print(bar)
    print(f"\nEXECUTIVE SUMMARY\n{summary}\n")
    for alert, result in _ranked(alerts, results):
        frame = alert.raw_frame
        print("-" * 78)
        print(f"[{result.severity.upper()}] {alert.id} — {alert.rule_name} "
              f"[{result.mode}]")
        print(f"  When:       {_clock(alert.timestamp)}")
        print(f"  Flow:       {alert.src_ip} -> {alert.dst_ip}")
        print(
            f"  Command:    {frame.function_name} unit {frame.unit_id} "
            f"addr {frame.address} values {list(frame.values)[:8]}"
            + (f" x{alert.count}" if alert.count > 1 else "")
        )
        print(f"  Detection:  {alert.description}")
        for technique in alert.techniques:
            print(f"  ATT&CK:     {technique}")
        print(f"  Severity:   {result.severity} — {result.severity_justification}")
        print(f"  Operator:   {result.plain_english_explanation}")
        print(f"  Narrative:  {result.attack_narrative}")
        for t in result.confirmed_attack_techniques:
            print(f"  Technique:  {t}")
        for i, action in enumerate(result.recommended_actions, 1):
            print(f"  Action {i}:   {action}")
        print(
            f"  FP risk:    {result.false_positive_likelihood} — "
            f"{result.false_positive_reasoning}"
        )
    print("-" * 78)
