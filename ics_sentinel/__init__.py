"""ICS Sentinel — AI-augmented anomaly detection & incident triage for Modbus TCP.

Detection engine on the bottom, LLM reasoning layer on top: synthetic (or
captured) Modbus TCP traffic is run through rule-based detections, mapped to
MITRE ATT&CK for ICS, and each alert is triaged by Claude into an
analyst-ready incident report.
"""

__version__ = "0.1.0"
