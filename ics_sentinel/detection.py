"""Detection engine: rule-based + statistical detections over a frame stream.

Five detections, each emitting structured :class:`Alert` objects:

==================  =====================================================
``R1-UNAUTH-WRITE``  Write function code from an IP not in the allowlist
``R2-SAFETY``        Write value outside the safe range for that register
``R3-SCAN``          One source touching many distinct points in a window
``R4-MALFORMED``     Unknown function code / structurally invalid frame
``R5-FLOOD``         Write rate exceeding a statistical baseline
==================  =====================================================

All thresholds live in :mod:`ics_sentinel.config`. The engine never reads a
frame's ground-truth ``label`` — alerts must be earned from the traffic.
Repeated identical findings are coalesced (with a ``count``) so a 40-frame
replay flood yields a clean handful of alerts, not 40 duplicates.
"""

from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass, field, replace
from statistics import fmean, pstdev
from typing import TYPE_CHECKING

from . import config
from .modbus import KNOWN_CODES, ModbusFrame

if TYPE_CHECKING:
    from .attack_map import Technique

RULE_UNAUTHORIZED_WRITE = "R1-UNAUTH-WRITE"
RULE_SAFETY = "R2-SAFETY"
RULE_SCAN = "R3-SCAN"
RULE_MALFORMED = "R4-MALFORMED"
RULE_FLOOD = "R5-FLOOD"

RULE_NAMES = {
    RULE_UNAUTHORIZED_WRITE: "Unauthorized write source",
    RULE_SAFETY: "Process safety violation",
    RULE_SCAN: "Reconnaissance / enumeration scan",
    RULE_MALFORMED: "Illegal or malformed frame",
    RULE_FLOOD: "Anomalous command frequency",
}


@dataclass(frozen=True, slots=True)
class Alert:
    """One detection finding, possibly representing several coalesced frames."""

    id: str
    rule_id: str
    rule_name: str
    timestamp: float
    src_ip: str
    dst_ip: str
    function_code: int
    description: str
    raw_frame: ModbusFrame
    count: int = 1  # frames coalesced into this alert
    # MITRE ATT&CK for ICS techniques, attached by attack_map.enrich.
    techniques: tuple["Technique", ...] = field(default=(), compare=False)


@dataclass(slots=True)
class _Finding:
    """A raw per-frame rule hit, before dedup/ID assignment."""

    rule_id: str
    frame: ModbusFrame
    description: str


class DetectionEngine:
    """Offline batch analysis of a timestamp-ordered frame stream."""

    def analyze(self, frames: list[ModbusFrame]) -> list[Alert]:
        frames = sorted(frames, key=lambda f: f.timestamp)
        findings = self._per_frame_rules(frames) + self._detect_scans(frames)
        alerts = self._coalesce(findings) + self._detect_floods(frames)
        alerts.sort(key=lambda a: a.timestamp)
        return [replace(a, id=f"ALT-{i:03d}") for i, a in enumerate(alerts, 1)]

    # ------------------------------------------------------------------
    # Stateless per-frame rules: R1, R2, R4
    # ------------------------------------------------------------------

    def _per_frame_rules(self, frames: list[ModbusFrame]) -> list[_Finding]:
        findings: list[_Finding] = []
        for f in frames:
            if not f.is_valid():
                if f.function_code not in KNOWN_CODES:
                    detail = f"illegal function code 0x{f.function_code:02X}"
                else:
                    detail = (
                        f"malformed PDU ({f.function_name} carrying "
                        f"{len(f.values)} values)"
                    )
                findings.append(
                    _Finding(
                        RULE_MALFORMED,
                        f,
                        f"Structurally invalid Modbus frame from {f.src_ip}: "
                        f"{detail}. Healthy traffic never contains this; "
                        "indicates fuzzing, exploit tooling, or protocol abuse.",
                    )
                )
            if f.is_write and f.src_ip not in config.AUTHORIZED_WRITE_SOURCES:
                findings.append(
                    _Finding(
                        RULE_UNAUTHORIZED_WRITE,
                        f,
                        f"{f.function_name} to {f.dst_ip} [unit {f.unit_id}] "
                        f"addr {f.address} from {f.src_ip}, which is not an "
                        f"authorized control source "
                        f"(allowlist: {', '.join(sorted(config.AUTHORIZED_WRITE_SOURCES))}).",
                    )
                )
            if f.is_write and f.address in config.SAFE_REGISTER_RANGES:
                lo, hi = config.SAFE_REGISTER_RANGES[f.address]
                bad = [v for v in f.values if not lo <= v <= hi]
                if bad:
                    findings.append(
                        _Finding(
                            RULE_SAFETY,
                            f,
                            f"Write of {bad[0]} to register {f.address} on "
                            f"{f.dst_ip} [unit {f.unit_id}] is outside the "
                            f"safe operating range {lo}–{hi}. A controller "
                            "chasing this value can drive the physical "
                            "process into an unsafe state.",
                        )
                    )
        return findings

    # ------------------------------------------------------------------
    # R3: scan detection (sliding window of distinct points per source)
    # ------------------------------------------------------------------

    def _detect_scans(self, frames: list[ModbusFrame]) -> list[_Finding]:
        findings: list[_Finding] = []
        windows: dict[str, deque] = defaultdict(deque)
        fired: set[str] = set()  # one alert per source per stream
        for f in frames:
            if f.src_ip in fired:
                continue
            window = windows[f.src_ip]
            window.append((f.timestamp, (f.dst_ip, f.unit_id, f.address)))
            while window and f.timestamp - window[0][0] > config.SCAN_WINDOW_S:
                window.popleft()
            distinct = {point for _, point in window}
            if len(distinct) > config.SCAN_DISTINCT_POINTS:
                span = f.timestamp - window[0][0]
                findings.append(
                    _Finding(
                        RULE_SCAN,
                        f,
                        f"{f.src_ip} read {len(distinct)} distinct "
                        f"PLC/unit/register points in {span:.1f}s "
                        f"(threshold: {config.SCAN_DISTINCT_POINTS} per "
                        f"{config.SCAN_WINDOW_S:g}s; benign polling touches 6). "
                        "Consistent with Modbus address-space enumeration.",
                    )
                )
                fired.add(f.src_ip)
        return findings

    # ------------------------------------------------------------------
    # R5: anomalous write frequency (statistical baseline over buckets)
    # ------------------------------------------------------------------

    def _detect_floods(self, frames: list[ModbusFrame]) -> list[Alert]:
        buckets: dict[tuple[str, int], list[ModbusFrame]] = defaultdict(list)
        for f in frames:
            if f.is_write:
                idx = int(
                    (f.timestamp - config.SIMULATION_START_EPOCH)
                    // config.FREQ_WINDOW_S
                )
                buckets[(f.src_ip, idx)].append(f)

        counts = {key: len(group) for key, group in buckets.items()}
        flagged: dict[tuple[str, int], float] = {}
        for key, n in counts.items():
            # Leave-one-out baseline: the candidate bucket must not be
            # allowed to inflate its own threshold.
            others = [c for k, c in counts.items() if k != key]
            if others:
                threshold = max(
                    fmean(others) + config.FREQ_SIGMA * pstdev(others),
                    float(config.FREQ_MIN_BURST),
                )
            else:
                threshold = float(config.FREQ_MIN_BURST)
            if n > threshold:
                flagged[key] = threshold

        # A burst spanning bucket boundaries is one event: coalesce
        # consecutive flagged buckets per source into a single alert.
        by_src: dict[str, list[int]] = defaultdict(list)
        for src, idx in flagged:
            by_src[src].append(idx)

        alerts: list[Alert] = []
        for src, idxs in sorted(by_src.items()):
            idxs.sort()
            runs: list[list[int]] = [[idxs[0]]]
            for idx in idxs[1:]:
                if idx == runs[-1][-1] + 1:
                    runs[-1].append(idx)
                else:
                    runs.append([idx])
            for run in runs:
                run_frames = sorted(
                    (f for idx in run for f in buckets[(src, idx)]),
                    key=lambda f: f.timestamp,
                )
                first = run_frames[0]
                span = len(run) * config.FREQ_WINDOW_S
                rate = len(run_frames) / span
                alerts.append(
                    Alert(
                        id="",
                        rule_id=RULE_FLOOD,
                        rule_name=RULE_NAMES[RULE_FLOOD],
                        timestamp=first.timestamp,
                        src_ip=src,
                        dst_ip=first.dst_ip,
                        function_code=first.function_code,
                        description=(
                            f"{len(run_frames)} write commands from {src} in "
                            f"{span:g}s (~{rate:.0f}/s) — exceeds the "
                            f"statistical baseline of per-{config.FREQ_WINDOW_S:g}s "
                            f"write counts (mean + {config.FREQ_SIGMA:g}σ ≈ "
                            f"{flagged[(src, run[0])]:.1f}). Benign writes "
                            "arrive minutes apart; this is control flooding "
                            "or a replay burst.",
                        ),
                        raw_frame=first,
                        count=len(run_frames),
                    )
                )
        return alerts

    # ------------------------------------------------------------------
    # Coalescing: repeated identical findings → one alert with a count
    # ------------------------------------------------------------------

    def _coalesce(self, findings: list[_Finding]) -> list[Alert]:
        groups: dict[tuple, list[_Finding]] = defaultdict(list)
        for finding in findings:
            f = finding.frame
            key = (finding.rule_id, f.src_ip, f.dst_ip, f.function_code, f.address)
            groups[key].append(finding)

        alerts: list[Alert] = []
        for group in groups.values():
            group.sort(key=lambda fi: fi.frame.timestamp)
            batch = [group[0]]
            for finding in group[1:]:
                if (
                    finding.frame.timestamp - batch[-1].frame.timestamp
                    <= config.DEDUP_WINDOW_S
                ):
                    batch.append(finding)
                else:
                    alerts.append(self._merge(batch))
                    batch = [finding]
            alerts.append(self._merge(batch))
        return alerts

    @staticmethod
    def _merge(batch: list[_Finding]) -> Alert:
        first = batch[0]
        f = first.frame
        description = first.description
        if len(batch) > 1:
            description += f" Repeated {len(batch)}× within the dedup window."
        return Alert(
            id="",
            rule_id=first.rule_id,
            rule_name=RULE_NAMES[first.rule_id],
            timestamp=f.timestamp,
            src_ip=f.src_ip,
            dst_ip=f.dst_ip,
            function_code=f.function_code,
            description=description,
            raw_frame=f,
            count=len(batch),
        )
