.PHONY: demo demo-benign test install

# Full pipeline: traffic -> detection -> ATT&CK -> triage -> report
demo:
	python -m ics_sentinel.demo

# Prove the false-positive discipline: clean baseline, zero alerts
demo-benign:
	python -m ics_sentinel.demo --benign

test:
	python -m pytest

# Optional: rich report + real AI triage need these
install:
	pip install -e ".[dev]"
