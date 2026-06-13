"""Smoke tests for report rendering, exporters, and the demo pipeline."""

from __future__ import annotations

import json

import pytest

from ics_sentinel import attack_map, config, report
from ics_sentinel.demo import main as demo_main
from ics_sentinel.detection import DetectionEngine
from ics_sentinel.generator import ATTACK_SCENARIOS, TrafficGenerator
from ics_sentinel.incidents import correlate
from ics_sentinel.triage import Triager


@pytest.fixture(autouse=True)
def no_api_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)


def pipeline(scenarios):
    gen = TrafficGenerator(seed=config.DEFAULT_SEED)
    alerts = attack_map.enrich(
        DetectionEngine().analyze(gen.generate_with_scenarios(60.0, scenarios))
    )
    incidents = correlate(alerts)
    triager = Triager()
    results = triager.triage_incidents(incidents)
    return incidents, results, triager.executive_summary(incidents, results)


def test_plain_report_renders_ranked_incidents(capsys):
    incidents, results, summary = pipeline(sorted(ATTACK_SCENARIOS))
    report.render(incidents, results, summary, "MOCK", force_plain=True)
    out = capsys.readouterr().out
    assert "ICS Sentinel — Incident Report" in out
    assert "[MOCK]" in out
    # Critical incidents render before lower severities.
    assert out.index("[CRITICAL]") < out.index("[HIGH]")
    assert "T0836" in out
    assert "Action 1:" in out
    assert "INC-" in out


def test_report_handles_empty_incident_list(capsys):
    report.render([], [], "No alerts — clean window.", "MOCK", force_plain=True)
    out = capsys.readouterr().out
    assert "0 incidents" in out
    assert "No alerts" in out


def test_markdown_export_ranked_and_complete():
    incidents, results, summary = pipeline(sorted(ATTACK_SCENARIOS))
    md = report.to_markdown(incidents, results, summary, "MOCK")
    assert md.startswith("# ICS Sentinel — Incident Report")
    assert "## Executive summary" in md
    assert md.index("[Critical]") < md.index("[High]")
    assert "https://attack.mitre.org/techniques/T0836/" in md
    assert "**Recommended actions:**" in md


def test_json_export_round_trips_and_is_ranked():
    incidents, results, summary = pipeline(sorted(ATTACK_SCENARIOS))
    payload = json.loads(report.to_json(incidents, results, summary, "MOCK"))
    assert payload["tool"] == "ICS Sentinel"
    assert payload["triage_mode"] == "MOCK"
    assert payload["incident_count"] == len(incidents) == len(payload["incidents"])
    assert payload["alert_count"] == sum(len(i.alerts) for i in incidents)
    severities = [i["triage"]["severity"] for i in payload["incidents"]]
    assert severities[0] == "Critical"
    first_alert = payload["incidents"][0]["alerts"][0]
    assert first_alert["attack_techniques"][0]["id"].startswith("T0")
    assert first_alert["time_utc"].startswith("2026-")


def test_demo_end_to_end_all_scenarios(capsys):
    demo_main(["--duration", "60", "--plain"])
    captured = capsys.readouterr()
    assert "Incident Report" in captured.out
    assert "[2/5] Detection engine raised" in captured.err
    assert "[4/5] Correlated into" in captured.err


def test_demo_benign_run_reports_no_alerts(capsys):
    demo_main(["--benign", "--plain"])
    captured = capsys.readouterr()
    assert "0 incident" in captured.out
    assert "raised 0 alert" in captured.err


def test_demo_output_flag_writes_files(tmp_path, capsys):
    md_path = tmp_path / "report.md"
    json_path = tmp_path / "report.json"
    demo_main(["--plain", "--output", str(md_path)])
    demo_main(["--plain", "--output", str(json_path)])
    capsys.readouterr()
    assert md_path.read_text().startswith("# ICS Sentinel")
    assert json.loads(json_path.read_text())["alert_count"] > 0


def test_demo_output_rejects_unknown_extension(capsys):
    with pytest.raises(SystemExit):
        demo_main(["--plain", "--output", "report.pdf"])


def test_demo_baseline_flag_runs(capsys):
    demo_main(["--benign", "--baseline", "--plain"])
    captured = capsys.readouterr()
    assert "learned baseline" in captured.err
