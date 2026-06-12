"""Analyst report rendering and export.

Renders triaged incidents ranked Critical-first. Uses ``rich`` for an
attractive terminal report when available; falls back to a plain-text
renderer (also reachable via ``force_plain=True`` / the demo's ``--plain``)
so the zero-dependency demo still produces a readable report. Exporters
produce the same ranked content as Markdown or SIEM-shaped JSON.
The AI-vs-MOCK triage mode is labeled prominently everywhere.
"""

from __future__ import annotations

import json
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
    *,
    force_plain: bool = False,
) -> None:
    if HAS_RICH and not force_plain:
        _render_rich(alerts, results, summary, mode)
    else:
        _render_plain(alerts, results, summary, mode)


# ---------------------------------------------------------------------------
# Exporters
# ---------------------------------------------------------------------------


def to_markdown(
    alerts: list[Alert],
    results: list[TriageResult],
    summary: str,
    mode: str,
) -> str:
    """The ranked report as a Markdown document."""
    mode_note = (
        "`[AI]` triage by Claude"
        if mode == "AI"
        else "`[MOCK]` deterministic triage (no API key)"
    )
    lines = [
        "# ICS Sentinel — Incident Report",
        "",
        f"{len(alerts)} alert(s) · triage mode: {mode_note}",
        "",
        "## Executive summary",
        "",
        summary,
        "",
    ]
    for alert, result in _ranked(alerts, results):
        frame = alert.raw_frame
        lines += [
            f"## [{result.severity}] {alert.id} — {alert.rule_name} "
            f"`[{result.mode}]`",
            "",
            f"- **When:** {_clock(alert.timestamp)}",
            f"- **Flow:** `{alert.src_ip}` → `{alert.dst_ip}`",
            f"- **Command:** {frame.function_name} · unit {frame.unit_id} · "
            f"addr {frame.address} · values {list(frame.values)[:8]}"
            + (f" · ×{alert.count}" if alert.count > 1 else ""),
            f"- **Detection:** {alert.description}",
            f"- **ATT&CK (ICS):** "
            + (
                ", ".join(f"[{t.technique_id} {t.name}]({t.url})" for t in alert.techniques)
                or "—"
            ),
            f"- **Severity:** {result.severity} — {result.severity_justification}",
            "",
            f"**What happened (operator view):** {result.plain_english_explanation}",
            "",
            f"**Attack narrative:** {result.attack_narrative}",
            "",
            "**Confirmed techniques:**",
            *[f"- {t}" for t in result.confirmed_attack_techniques],
            "",
            "**Recommended actions:**",
            *[
                f"{i}. {action}"
                for i, action in enumerate(result.recommended_actions, 1)
            ],
            "",
            f"*False-positive likelihood: {result.false_positive_likelihood} — "
            f"{result.false_positive_reasoning}*",
            "",
        ]
    return "\n".join(lines)


def to_json(
    alerts: list[Alert],
    results: list[TriageResult],
    summary: str,
    mode: str,
) -> str:
    """The ranked report as SIEM-shaped JSON (stable field names, ISO times)."""
    items = []
    for alert, result in _ranked(alerts, results):
        frame = alert.raw_frame
        items.append(
            {
                "id": alert.id,
                "rule_id": alert.rule_id,
                "rule_name": alert.rule_name,
                "time_utc": datetime.fromtimestamp(
                    alert.timestamp, tz=timezone.utc
                ).isoformat(timespec="milliseconds"),
                "source_ip": alert.src_ip,
                "dest_ip": alert.dst_ip,
                "unit_id": frame.unit_id,
                "function_code": frame.function_code,
                "function": frame.function_name,
                "address": frame.address,
                "values": list(frame.values)[:8],
                "occurrences": alert.count,
                "description": alert.description,
                "attack_techniques": [
                    {
                        "id": t.technique_id,
                        "name": t.name,
                        "tactic": t.tactic,
                        "url": t.url,
                    }
                    for t in alert.techniques
                ],
                "triage": {
                    "mode": result.mode,
                    "severity": result.severity,
                    "severity_justification": result.severity_justification,
                    "plain_english_explanation": result.plain_english_explanation,
                    "attack_narrative": result.attack_narrative,
                    "confirmed_attack_techniques": list(
                        result.confirmed_attack_techniques
                    ),
                    "recommended_actions": list(result.recommended_actions),
                    "false_positive_likelihood": result.false_positive_likelihood,
                    "false_positive_reasoning": result.false_positive_reasoning,
                },
            }
        )
    return json.dumps(
        {
            "tool": "ICS Sentinel",
            "triage_mode": mode,
            "executive_summary": summary,
            "alert_count": len(alerts),
            "alerts": items,
        },
        indent=2,
    )


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
