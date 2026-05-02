from __future__ import annotations

from pathlib import Path
from typing import Any

TICKS_PER_QUARTER = 480
STEPS_PER_BAR = 16
TICKS_PER_STEP = TICKS_PER_QUARTER // 4
CHANNEL_10_NOTE_ON = 0x99
CHANNEL_10_NOTE_OFF = 0x89


def _var_len(value: int) -> bytes:
    if value < 0:
        raise ValueError("delta time cannot be negative")
    buffer = value & 0x7F
    value >>= 7
    while value:
        buffer <<= 8
        buffer |= (value & 0x7F) | 0x80
        value >>= 7
    output = bytearray()
    while True:
        output.append(buffer & 0xFF)
        if buffer & 0x80:
            buffer >>= 8
        else:
            break
    return bytes(output)


def _u16(value: int) -> bytes:
    return value.to_bytes(2, "big")


def _u32(value: int) -> bytes:
    return value.to_bytes(4, "big")


def _event_tick(event: dict[str, Any]) -> int:
    return int(event["bar"]) * STEPS_PER_BAR * TICKS_PER_STEP + int(event["step"]) * TICKS_PER_STEP


def write_midi(path: Path, events: list[dict[str, Any]], bpm: int) -> None:
    tempo = int(60_000_000 / bpm)
    midi_events: list[tuple[int, bytes]] = [
        (0, b"\xff\x51\x03" + tempo.to_bytes(3, "big")),
        (0, b"\xff\x58\x04\x04\x02\x18\x08"),
    ]
    for event in events:
        tick = _event_tick(event)
        note = int(event["note"])
        velocity = int(event["velocity"])
        duration = max(1, int(event.get("duration_steps", 1))) * TICKS_PER_STEP
        midi_events.append((tick, bytes([CHANNEL_10_NOTE_ON, note, velocity])))
        midi_events.append((tick + duration, bytes([CHANNEL_10_NOTE_OFF, note, 0])))
    midi_events.sort(key=lambda item: (item[0], item[1][0] == CHANNEL_10_NOTE_OFF))

    track = bytearray()
    last_tick = 0
    for tick, payload in midi_events:
        track.extend(_var_len(tick - last_tick))
        track.extend(payload)
        last_tick = tick
    track.extend(_var_len(0))
    track.extend(b"\xff\x2f\x00")

    header = b"MThd" + _u32(6) + _u16(0) + _u16(1) + _u16(TICKS_PER_QUARTER)
    chunk = b"MTrk" + _u32(len(track)) + bytes(track)
    path.write_bytes(header + chunk)
