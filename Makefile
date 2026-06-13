.PHONY: demo demo-benign sample test install

# Full pipeline: traffic -> detection -> ATT&CK -> correlate -> triage -> report
demo:
	python -m ics_sentinel.demo

# Prove the false-positive discipline: clean baseline, zero alerts
demo-benign:
	python -m ics_sentinel.demo --benign

# Regenerate the committed sample report artifact
sample:
	python -m ics_sentinel.demo --output demo/sample-report.md

test:
	python -m pytest

# Optional: rich report + real AI triage need these
install:
	pip install -e ".[dev]"
