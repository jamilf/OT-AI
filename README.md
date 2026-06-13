# Jamil Flores — apprenticeship-first portfolio

An apprenticeship-first portfolio for **Jamil Flores**, a mature-age
career-changer moving from about eight years in IT operations into the
electrical trade, applying to the NSW networks (Ausgrid, Endeavour Energy,
Essential Energy, Transgrid, Transport for NSW). The **ICS Sentinel** project
— a self-built program that watches an industrial control network and flags
trouble — is included as evidence of how he learns and finishes what he
starts, not as the day job.

## Site structure

Pure static files, zero dependencies, no build step:
- `index.html` — apprenticeship-first homepage (the pitch recruiters land on)
- `project.html` — the ICS Sentinel showcase (the technical proof)
- `docs.html` — interactive replication guide
- `learn.html` — documentation + ELI5 glossary
- `apprenticeship.html` — redirect to `index.html` (legacy URL)
- `styles.css`, `app.js`

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
