# ICS Sentinel

An AI SOC analyst for industrial networks — detects attacks on
unauthenticated Modbus TCP control traffic, then uses Claude to triage every
alert into plain English, MITRE ATT&CK for ICS context, and concrete
response actions.

## Showcase site

This repo hosts the animated showcase site for ICS Sentinel:
`index.html` (the showcase), `docs.html` (interactive replication guide +
documentation), `styles.css`, `app.js` — pure static files, zero
dependencies, no build step.

View it locally:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

…or just open `index.html` directly in a browser. It also works as-is on
GitHub Pages.

## Author

A portfolio project by **Jamil Flores** —
[LinkedIn](https://www.linkedin.com/in/jamilflores).
