# ICS Sentinel

An AI SOC analyst for industrial networks — detects attacks on
unauthenticated Modbus TCP control traffic, then uses Claude to triage every
alert into plain English, MITRE ATT&CK for ICS context, and concrete
response actions.

## Showcase site

This repo hosts the animated one-page showcase site for ICS Sentinel:
`index.html`, `styles.css`, `app.js` — pure static files, zero dependencies,
no build step.

View it locally:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

…or just open `index.html` directly in a browser. It also works as-is on
GitHub Pages.
