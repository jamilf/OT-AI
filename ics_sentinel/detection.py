"""Detection engine — Phase 3.

Will consume a stream of :class:`~ics_sentinel.modbus.ModbusFrame` and emit
structured Alert objects from rule-based and statistical detections:
unauthorized write source, process safety violation, scan detection,
illegal/malformed frame, anomalous command frequency.
"""
