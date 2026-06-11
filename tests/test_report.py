"""Smoke tests for report rendering and the end-to-end demo pipeline."""

from __future__ import annotations

import pytest

from ics_sentinel import attack_map, config, report
from ics_sentinel.demo import main as demo_main
from ics_sentinel.detection import DetectionEngine
from ics_sentinel.generator import ATTACK_SCENARIOS, TrafficGenerator
from ics_sentinel.triage import Triager


@pytest.fixture(autouse=True)
def no_api_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    # rich's terminal control codes don't survive pytest's output capture;
    # exercise the dependency-free renderer here (rich path is demo-verified).
    monkeypatch.setattr(report, "HAS_RICH", False)


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
    report._render_plain(alerts, results, summary, "MOCK")
    out = capsys.readouterr().out
    assert "ICS Sentinel — Incident Report" in out
    assert "[MOCK]" in out
    # Critical incidents render before lower severities.
    assert out.index("[CRITICAL]") < out.index("[MEDIUM]")
    assert "T0836" in out
    assert "Action 1:" in out


def test_report_handles_empty_alert_list(capsys):
    report._render_plain([], [], "No alerts — clean window.", "MOCK")
    out = capsys.readouterr().out
    assert "0 alerts" in out
    assert "No alerts" in out


def test_demo_end_to_end_all_scenarios(capsys):
    demo_main(["--duration", "60"])
    captured = capsys.readouterr()
    assert "Incident Report" in captured.out
    assert "[2/4] Detection engine raised" in captured.err


def test_demo_benign_run_reports_no_alerts(capsys):
    demo_main(["--benign"])
    captured = capsys.readouterr()
    assert "0 alert" in captured.out or "0 alerts" in captured.out
    assert "raised 0 alert" in captured.err
