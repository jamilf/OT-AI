# Demo assets (to be captured by you)

Recruiters engage far more with a repo that shows the tool running. Once
Phase 6 is done, capture and drop into this folder:

1. **`demo.gif`** (~60 seconds) — record a terminal running the full
   pipeline: `python -m ics_sentinel.demo`. Show traffic generation, the
   alerts firing, the ranked incident overview table, and scroll to the AI
   triage of the Critical incident. Easiest path:
   ```bash
   asciinema rec -c "python -m ics_sentinel.demo" demo.cast
   agg demo.cast demo.gif          # asciinema's GIF renderer
   ```
   (or [terminalizer](https://terminalizer.com), or a plain screen recording).
   A text snapshot of a full mock-mode run is already saved at
   `sample-report.md` for reference.
2. **`screenshot-report.png`** — the final ranked incident report.
3. **`screenshot-triage.png`** — close-up of one Critical incident's AI
   triage (severity justification + recommended actions).

Then embed them at the top of the main README.
