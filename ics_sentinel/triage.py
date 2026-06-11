"""AI triage layer — Phase 5.

Will send each alert (plus ATT&CK context and process state) to Claude for
structured JSON triage: severity, plain-English explanation, attack
narrative, recommended actions, false-positive likelihood. Falls back to a
deterministic [MOCK] triage when ANTHROPIC_API_KEY is absent so the demo
always runs.
"""
