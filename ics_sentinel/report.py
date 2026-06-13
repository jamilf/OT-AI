"""Analyst report rendering and export (incident-level).

Renders triaged incidents ranked Critical-first, each with its member
alerts. Uses ``rich`` for an attractive terminal report when available;
falls back to a plain-text renderer (also reachable via ``force_plain=True``
/ the demo's ``--plain``) so the zero-dependency demo still produces a
readable report. Exporters produce the same ranked content as Markdown or
SIEM-shaped JSON. The AI-vs-MOCK triage mode is labeled prominently
everywhere.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone

from .detection import Alert
from .incidents import Incident
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


def _short_clock(timestamp: float) -> str:
    return datetime.fromtimestamp(timestamp, tz=timezone.utc).strftime("%H:%M:%S")


def _ranked(
    incidents: list[Incident], results: list[TriageResult]
) -> list[tuple[Incident, TriageResult]]:
    return sorted(
        zip(incidents, results), key=lambda p: (p[1].severity_rank, p[0].start)
    )


def _alert_line(alert: Alert) -> str:
    frame = alert.raw_frame
    return (
        f"{frame.function_name} → {alert.dst_ip} [unit {frame.unit_id}] "
        f"addr {frame.address} values {list(frame.values)[:8]}"
        + (f" ×{alert.count}" if alert.count > 1 else "")
    )


def _technique_ids(alert: Alert) -> str:
    return ", ".join(t.technique_id for t in alert.techniques) or "—"


def render(
    incidents: list[Incident],
    results: list[TriageResult],
    summary: str,
    mode: str,
    *,
    force_plain: bool = False,
) -> None:
    if HAS_RICH and not force_plain:
        _render_rich(incidents, results, summary, mode)
    else:
        _render_plain(incidents, results, summary, mode)


# ---------------------------------------------------------------------------
# rich renderer
# ---------------------------------------------------------------------------


def _render_rich(incidents, results, summary, mode) -> None:
    console = Console()
    alert_total = sum(len(i.alerts) for i in incidents)
    badge = (
        "[bold green]\\[AI][/] triage by Claude"
        if mode == "AI"
        else "[bold yellow]\\[MOCK][/] deterministic triage "
        "(set ANTHROPIC_API_KEY for AI analysis)"
    )
    console.print(
        Panel(
            f"[bold]ICS Sentinel — Incident Report[/]\n"
            f"{len(incidents)} incident(s) · {alert_total} alert(s) · "
            f"triage mode: {badge}",
            box=box.DOUBLE,
            style="cyan",
        )
    )
    console.print(
        Panel(summary, title="Executive summary", border_style="cyan", expand=True)
    )
    if not incidents:
        return

    # At-a-glance overview table (the "dashboard" view), ranked.
    overview = Table(title="Incidents (ranked)", box=box.ROUNDED, expand=True)
    overview.add_column("Incident", style="bold")
    overview.add_column("Severity")
    overview.add_column("Actor")
    overview.add_column("Alerts", justify="right")
    overview.add_column("Rules")
    overview.add_column("ATT&CK")
    for incident, result in _ranked(incidents, results):
        sev_style = SEVERITY_COLORS.get(result.severity, "bold")
        technique_ids = sorted(
            {t.technique_id for a in incident.alerts for t in a.techniques}
        )
        overview.add_row(
            incident.id,
            Text(result.severity, style=sev_style),
            incident.src_ip,
            str(len(incident.alerts)),
            Text(", ".join(incident.rule_ids)),
            Text(", ".join(technique_ids)),
        )
    console.print(overview)

    for incident, result in _ranked(incidents, results):
        sev_style = SEVERITY_COLORS.get(result.severity, "bold")

        members = Table(box=box.SIMPLE, pad_edge=False, show_header=True)
        members.add_column("alert", style="dim")
        members.add_column("time")
        members.add_column("rule")
        members.add_column("command")
        members.add_column("ATT&CK")
        for alert in incident.alerts:
            members.add_row(
                alert.id,
                _short_clock(alert.timestamp),
                alert.rule_name,
                Text(_alert_line(alert)),
                _technique_ids(alert),
            )

        body = [
            Text.assemble(
                ("Actor: ", "dim"),
                (incident.src_ip, "bold"),
                ("   Window: ", "dim"),
                (f"{_clock(incident.start)} → {_short_clock(incident.end)}",),
            ),
            members,
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
                f"[bold]{incident.id}[/] — {incident.src_ip} · "
                f"{len(incident.alerts)} alert(s) "
                f"[dim]\\[{result.mode}][/]",
                border_style=sev_style.split()[-1].replace("on ", ""),
            )
        )


# ---------------------------------------------------------------------------
# plain-text fallback (no dependencies)
# ---------------------------------------------------------------------------


def _render_plain(incidents, results, summary, mode) -> None:
    bar = "=" * 78
    alert_total = sum(len(i.alerts) for i in incidents)
    mode_note = (
        "[AI] triage by Claude"
        if mode == "AI"
        else "[MOCK] deterministic triage (set ANTHROPIC_API_KEY for AI analysis)"
    )
    print(bar)
    print(
        f"ICS Sentinel — Incident Report   "
        f"({len(incidents)} incidents / {alert_total} alerts, {mode_note})"
    )
    print(bar)
    print(f"\nEXECUTIVE SUMMARY\n{summary}\n")
    for incident, result in _ranked(incidents, results):
        print("-" * 78)
        print(
            f"[{result.severity.upper()}] {incident.id} — actor {incident.src_ip}, "
            f"{len(incident.alerts)} alert(s) [{result.mode}]"
        )
        print(f"  Window:     {_clock(incident.start)} -> {_short_clock(incident.end)}")
        for alert in incident.alerts:
            print(
                f"  Alert:      {alert.id} {_short_clock(alert.timestamp)} "
                f"{alert.rule_name} — {_alert_line(alert)} "
                f"[{_technique_ids(alert)}]"
            )
            print(f"              {alert.description}")
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


# ---------------------------------------------------------------------------
# Exporters
# ---------------------------------------------------------------------------


def to_markdown(
    incidents: list[Incident],
    results: list[TriageResult],
    summary: str,
    mode: str,
) -> str:
    """The ranked incident report as a Markdown document."""
    alert_total = sum(len(i.alerts) for i in incidents)
    mode_note = (
        "`[AI]` triage by Claude"
        if mode == "AI"
        else "`[MOCK]` deterministic triage (no API key)"
    )
    lines = [
        "# ICS Sentinel — Incident Report",
        "",
        f"{len(incidents)} incident(s) · {alert_total} alert(s) · "
        f"triage mode: {mode_note}",
        "",
        "## Executive summary",
        "",
        summary,
        "",
    ]
    for incident, result in _ranked(incidents, results):
        lines += [
            f"## [{result.severity}] {incident.id} — actor `{incident.src_ip}` "
            f"({len(incident.alerts)} alerts) `[{result.mode}]`",
            "",
            f"**Window:** {_clock(incident.start)} → {_short_clock(incident.end)}",
            "",
            "| Alert | Time | Rule | Command | ATT&CK |",
            "|---|---|---|---|---|",
            *[
                f"| {a.id} | {_short_clock(a.timestamp)} | {a.rule_name} "
                f"| {_alert_line(a)} | "
                + ", ".join(
                    f"[{t.technique_id}]({t.url})" for t in a.techniques
                )
                + " |"
                for a in incident.alerts
            ],
            "",
            f"**Severity:** {result.severity} — {result.severity_justification}",
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
    incidents: list[Incident],
    results: list[TriageResult],
    summary: str,
    mode: str,
) -> str:
    """The ranked report as SIEM-shaped JSON (stable field names, ISO times)."""

    def alert_dict(alert: Alert) -> dict:
        frame = alert.raw_frame
        return {
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
        }

    items = []
    for incident, result in _ranked(incidents, results):
        items.append(
            {
                "id": incident.id,
                "source_ip": incident.src_ip,
                "start_utc": datetime.fromtimestamp(
                    incident.start, tz=timezone.utc
                ).isoformat(timespec="milliseconds"),
                "end_utc": datetime.fromtimestamp(
                    incident.end, tz=timezone.utc
                ).isoformat(timespec="milliseconds"),
                "alerts": [alert_dict(a) for a in incident.alerts],
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
            "incident_count": len(incidents),
            "alert_count": sum(len(i.alerts) for i in incidents),
            "incidents": items,
        },
        indent=2,
    )
