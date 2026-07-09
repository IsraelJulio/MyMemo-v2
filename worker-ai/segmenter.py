from __future__ import annotations

from typing import Any


MIN_CHARS = 40
MAX_CHARS = 500
MAX_DURATION_SECONDS = 40
FINAL_PUNCTUATION = ".!?;"


def build_blocks(segments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = []
    current: list[dict[str, Any]] = []

    def flush() -> None:
        nonlocal current
        if not current:
            return

        text = " ".join(str(segment["text"]).strip() for segment in current if str(segment.get("text", "")).strip())
        text = " ".join(text.split())
        if not text:
            current = []
            return

        start_ms = seconds_to_ms(current[0].get("start"))
        end_ms = seconds_to_ms(current[-1].get("end"))
        confidence = average_confidence(current)

        for chunk in split_text(text):
            blocks.append(
                {
                    "order": len(blocks) + 1,
                    "startMs": start_ms,
                    "endMs": end_ms,
                    "originalText": chunk,
                    "confidence": confidence,
                }
            )

        current = []

    for segment in segments:
        text = " ".join(str(segment.get("text", "")).split())
        if not text:
            continue

        if current:
            candidate = " ".join([*(str(item.get("text", "")).strip() for item in current), text]).strip()
            duration = float(segment.get("end") or 0) - float(current[0].get("start") or 0)
            if len(candidate) > MAX_CHARS or duration > MAX_DURATION_SECONDS:
                flush()

        current.append({**segment, "text": text})
        block_text = " ".join(str(item.get("text", "")).strip() for item in current).strip()
        duration = float(current[-1].get("end") or 0) - float(current[0].get("start") or 0)

        if (len(block_text) >= MIN_CHARS and block_text[-1:] in FINAL_PUNCTUATION) or len(block_text) >= MAX_CHARS or duration >= MAX_DURATION_SECONDS:
            flush()

    flush()
    return blocks


def split_text(text: str) -> list[str]:
    remaining = text.strip()
    chunks: list[str] = []

    while len(remaining) > MAX_CHARS:
        window = remaining[: MAX_CHARS + 1]
        split_at = best_split_index(window)
        chunks.append(remaining[:split_at].strip())
        remaining = remaining[split_at:].strip()

    if remaining:
        chunks.append(remaining)

    return chunks


def best_split_index(text: str) -> int:
    punctuation_positions = [text.rfind(mark) for mark in ".!?;"]
    punctuation_positions = [position for position in punctuation_positions if position >= MIN_CHARS]
    if punctuation_positions:
        return max(punctuation_positions) + 1

    space_position = text.rfind(" ")
    if space_position >= MIN_CHARS:
        return space_position

    return min(len(text), MAX_CHARS)


def seconds_to_ms(value: Any) -> int | None:
    if value is None:
        return None
    return int(round(float(value) * 1000))


def average_confidence(segments: list[dict[str, Any]]) -> float | None:
    values = [float(segment["confidence"]) for segment in segments if isinstance(segment.get("confidence"), (int, float))]
    if not values:
        return None
    return sum(values) / len(values)
