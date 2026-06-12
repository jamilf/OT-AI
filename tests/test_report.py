"""Smoke tests for report rendering, exporters, and the demo pipeline."""

from __future__ import annotations

import json

import pytest

from ics_sentinel import attack_map, config, report
from ics_sentinel.demo import main as demo_main
from ics_sentinel.detection import DetectionEngine
from ics_sentinel.generator import ATTACK_SCENARIOS, TrafficGenerator
from ics_sentinel.triage import Triager


@pytest.fixture(autouse=True)
def no_api_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)


def pipeline(scenarios):
    gen = TrafficGenerator(seed=config.DEFAULT_SEED)
    alerts = attack_map.enrich(
        DetectionEngine().analyze(gen.generate_with_scenarios(60.0, scenarios))
    )
    triager = Triager()
    results = triager.triage_all(alerts)
    return alerts, results, triager.executive_summary(alerts, results)


def test_plain_report_renders_ranked_incidents(capsys):
    alerts, results, summary = pipeline(sorted(ATTACK_SCENARIOS))
    report.render(alerts, results, summary, "MOCK", force_plain=True)
    out = capsys.readouterr().out
    assert "ICS Sentinel — Incident Report" in out
    assert "[MOCK]" in out
    # Critical incidents render before lower severities.
    assert out.index("[CRITICAL]") < out.index("[MEDIUM]")
    assert "T0836" in out
    assert "Action 1:" in out


def test_report_handles_empty_alert_list(capsys):
    report.render([], [], "No alerts — clean window.", "MOCK", force_plain=True)
    out = capsys.readouterr().out
    assert "0 alerts" in out
    assert "No alerts" in out


def test_markdown_export_ranked_and_complete():
    alerts, results, summary = pipeline(sorted(ATTACK_SCENARIOS))
    md = report.to_markdown(alerts, results, summary, "MOCK")
    assert md.startswith("# ICS Sentinel — Incident Report")
    assert "## Executive summary" in md
    assert md.index("[Critical]") < md.index("[Medium]")
    assert "https://attack.mitre.org/techniques/T0836/" in md
    assert "**Recommended actions:**" in md


def test_json_export_round_trips_and_is_ranked():
    alerts, results, summary = pipeline(sorted(ATTACK_SCENARIOS))
    payload = json.loads(report.to_json(alerts, results, summary, "MOCK"))
    assert payload["tool"] == "ICS Sentinel"
    assert payload["triage_mode"] == "MOCK"
    assert payload["alert_count"] == len(alerts) == len(payload["alerts"])
    severities = [a["triage"]["severity"] for a in payload["alerts"]]
    assert severities[0] == "Critical"
    first = payload["alerts"][0]
    assert first["attack_techniques"][0]["id"].startswith("T0")
    assert first["time_utc"].startswith("2026-")
    assert isinstance(first["triage"]["recommended_actions"], list)


def test_demo_end_to_end_all_scenarios(capsys):
    demo_main(["--duration", "60", "--plain"])
    captured = capsys.readouterr()
    assert "Incident Report" in captured.out
    assert "[2/4] Detection engine raised" in captured.err


def test_demo_benign_run_reports_no_alerts(capsys):
    demo_main(["--benign", "--plain"])
    captured = capsys.readouterr()
    assert "0 alert" in captured.out
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
