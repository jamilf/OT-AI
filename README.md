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
- `feeder-monitor.html` — headline trade project: an extra-low-voltage
  "distribution feeder monitor" build, documented to AS/NZS standards
  (single-line diagram, safe-isolation method, risk assessment)
- `project.html` — the ICS Sentinel software project (secondary, self-driven learning)
- `docs.html` — interactive replication guide for ICS Sentinel
- `learn.html` — documentation + ELI5 glossary
- `study.html` — a study tool for the NSW network aptitude prep, with two modes:
  **Knowledge** (spaced-repetition SM-2, a 1000+ card deck: an authored core of
  standard fundamentals plus deterministically computed cards; new-cards-per-day
  control and a fast, searchable, lazy browse) and **Aptitude** (numeracy,
  number/letter sequences, **visual abstract reasoning**, **spatial**, mechanical
  reasoning with diagrams, data-table numeracy, reading, **verbal
  (true/false/cannot-say)** and safety — generated answers correct by
  construction; adaptive difficulty, interleaved drills, per-question timing, a
  "beat the clock" speeded mode, a timed mock, an optional **estimated-IQ
  reasoning test** (a banded, capped, heavily-caveated indicative estimate —
  explicitly *not* a clinical IQ), and focus-here diagnostics).
  Progress saved in the browser with JSON export/import. **Works offline and is
  installable (PWA)**; figures carry text alternatives for screen readers, and a
  warning shows if the device can't save progress.
- `apprenticeship.html` — redirect to `index.html` (legacy URL)
- `styles.css`, `app.js`
- `sw.js`, `manifest.webmanifest`, `icon.svg` — service worker (offline cache),
  web manifest, app icon. `robots.txt`, `sitemap.xml`, `.nojekyll` for SEO/Pages.
  Every page carries a Content-Security-Policy, canonical and robots meta.
- `study.js`, `study-data.js`, `knowledge-gen.js` — Knowledge engine, its
  authored verified card core, and the deterministic computed-card generator
- `aptitude.js`, `aptitude-data.js` — Aptitude engine (generators, adaptive
  difficulty, timing/diagnostics, speeded mode, mock) and its verified authored
  reading/verbal/safety items

View it locally:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

…or just open `index.html` directly in a browser. It also works as-is on
GitHub Pages.

Live site: https://jamilf.github.io/Apprenticeship/ (deployed from `main` by the
GitHub Pages workflow in `.github/workflows/pages.yml`).

## Author

Built end to end by **Jamil Flores** — Modbus TCP protocol parsing,
physics-coherent plant simulation, detection engineering (0 false positives),
MITRE ATT&CK for ICS mapping, and Claude-powered triage with cost-aware
alert coalescing. [LinkedIn](https://www.linkedin.com/in/jamilflores).
