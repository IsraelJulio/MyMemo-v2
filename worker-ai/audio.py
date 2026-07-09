from __future__ import annotations

import os
import subprocess
from pathlib import Path


def convert_to_wav(input_path: Path, output_dir: Path) -> Path:
    output_path = output_dir / "audio-16khz.wav"
    command = [
        ffmpeg_binary(),
        "-y",
        "-i",
        str(input_path),
        "-ac",
        "1",
        "-ar",
        "16000",
        "-vn",
        str(output_path),
    ]

    try:
        subprocess.run(command, check=True, capture_output=True, text=True)
    except FileNotFoundError as exc:
        raise RuntimeError(
            "FFmpeg was not found. Install FFmpeg, add it to PATH, or set FFMPEG_BINARY in worker-ai/.env."
        ) from exc
    except subprocess.CalledProcessError as exc:
        details = (exc.stderr or exc.stdout or "").strip()
        raise RuntimeError(f"FFmpeg failed to convert audio: {details[:500]}") from exc

    if not output_path.exists():
        raise RuntimeError("Converted WAV file was not created.")

    return output_path


def ffmpeg_binary() -> str:
    configured = os.getenv("FFMPEG_BINARY", "").strip()
    if not configured:
        return "ffmpeg"

    path = Path(configured).expanduser()
    if not path.exists():
        raise RuntimeError(f"FFMPEG_BINARY points to a file that does not exist: {path}")

    return str(path)
