from __future__ import annotations

import os
import shutil
import time
import traceback
from pathlib import Path

from dotenv import load_dotenv

from audio import convert_to_wav
from db import complete_job, connect, fail_job, fetch_next_job, replace_blocks, update_job_metadata, update_job_state
from downloader import download_media
from segmenter import build_blocks
from transcriber import transcribe_audio
from translator import translate_blocks


WORKER_DIR = Path(__file__).resolve().parent


def main() -> None:
    load_dotenv(WORKER_DIR / ".env")

    poll_interval = int(os.getenv("WORKER_POLL_INTERVAL_SECONDS", "5"))
    temp_root = Path(os.getenv("WORKER_TEMP_DIR", ".tmp"))
    if not temp_root.is_absolute():
        temp_root = WORKER_DIR / temp_root
    temp_root.mkdir(parents=True, exist_ok=True)

    print("MyMemo AI worker started.")
    with connect() as conn:
        while True:
            job = fetch_next_job(conn)
            if not job:
                time.sleep(poll_interval)
                continue

            process_job(conn, job, temp_root)


def process_job(conn, job: dict, temp_root: Path) -> None:
    job_id = job["id"]
    job_temp_dir = temp_root / job_id
    max_duration = int(os.getenv("MAX_MEDIA_DURATION_SECONDS", "1800"))

    if job_temp_dir.exists():
        shutil.rmtree(job_temp_dir, ignore_errors=True)
    job_temp_dir.mkdir(parents=True, exist_ok=True)

    try:
        print(f"[{job_id}] downloading")
        media_path, source_title = download_media(job["sourceUrl"], job_temp_dir, max_duration)
        update_job_metadata(conn, job_id, source_title=source_title)

        print(f"[{job_id}] converting")
        update_job_state(conn, job_id, "CONVERTING", 25)
        wav_path = convert_to_wav(media_path, job_temp_dir)

        print(f"[{job_id}] transcribing")
        update_job_state(conn, job_id, "TRANSCRIBING", 45)
        source_language = job.get("sourceLanguage") or "auto"
        segments, detected_language = transcribe_audio(wav_path, source_language)
        update_job_metadata(conn, job_id, detected_language=detected_language)

        print(f"[{job_id}] segmenting")
        update_job_state(conn, job_id, "SEGMENTING", 70)
        blocks = build_blocks(segments)
        if not blocks:
            raise RuntimeError("Whisper did not return transcript blocks for this media.")

        print(f"[{job_id}] translating")
        update_job_state(conn, job_id, "TRANSLATING", 82)
        translated_blocks = translate_blocks(blocks, detected_language or source_language, job.get("targetLanguage") or "pt-BR")

        replace_blocks(conn, job_id, translated_blocks)
        complete_job(conn, job_id)
        print(f"[{job_id}] completed with {len(translated_blocks)} blocks")
    except Exception as exc:
        message = safe_error_message(exc)
        print(f"[{job_id}] failed: {message}")
        traceback.print_exc()
        fail_job(conn, job_id, message)
    finally:
        shutil.rmtree(job_temp_dir, ignore_errors=True)


def safe_error_message(exc: Exception) -> str:
    message = str(exc).strip()
    return message or exc.__class__.__name__


if __name__ == "__main__":
    main()
