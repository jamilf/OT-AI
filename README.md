# ICS Sentinel

An AI SOC analyst for industrial networks — detects attacks on
unauthenticated Modbus TCP control traffic, then uses Claude to triage every
alert into plain English, MITRE ATT&CK for ICS context, and concrete
response actions.

## Showcase site

This repo hosts the animated showcase site for ICS Sentinel:
`index.html` (the showcase), `docs.html` (interactive replication guide),
`learn.html` (documentation + ELI5 glossary),
`apprenticeship.html` (Jamil's electrical-apprenticeship candidate page),
`styles.css`, `app.js` — pure static files, zero dependencies, no build step.

View it locally:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

…or just open `index.html` directly in a browser. It also works as-is on
GitHub Pages.

Live site: https://jamilf.github.io/OT-AI/ (deployed from `main` by the
GitHub Pages workflow in `.github/workflows/pages.yml`).

## Author

Built end to end by **Jamil Flores** — Modbus TCP protocol parsing,
physics-coherent plant simulation, detection engineering (0 false positives),
MITRE ATT&CK for ICS mapping, and Claude-powered triage with cost-aware
alert coalescing. [LinkedIn](https://www.linkedin.com/in/jamilflores).
