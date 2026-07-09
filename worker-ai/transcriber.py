from __future__ import annotations

import math
import os
from pathlib import Path
from typing import Any

WORKER_DIR = Path(__file__).resolve().parent


def transcribe_audio(audio_path: Path, source_language: str | None) -> tuple[list[dict[str, Any]], str | None]:
    configure_huggingface_hub()

    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise RuntimeError("faster-whisper is not installed. Run: python -m pip install -r worker-ai/requirements.txt") from exc

    model_name = os.getenv("WHISPER_MODEL", "base")
    device = os.getenv("WHISPER_DEVICE", "cpu")
    compute_type = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
    download_root = normalized_path_env("WHISPER_DOWNLOAD_ROOT")
    local_files_only = env_bool("WHISPER_LOCAL_FILES_ONLY")
    language = None if not source_language or source_language == "auto" else source_language

    try:
        model = WhisperModel(
            model_name,
            device=device,
            compute_type=compute_type,
            download_root=str(download_root) if download_root else None,
            local_files_only=local_files_only,
        )
    except Exception as exc:
        if "CERTIFICATE_VERIFY_FAILED" in str(exc):
            raise RuntimeError(
                "Hugging Face Hub failed SSL validation while downloading the Whisper model. "
                "Configure HF_CA_CERTS with your corporate root CA, or set HF_NO_CHECK_CERTIFICATE=true for local development. "
                "You can also pre-download the model and set WHISPER_LOCAL_FILES_ONLY=true."
            ) from exc
        raise

    segments, info = model.transcribe(str(audio_path), language=language, vad_filter=True)

    rows: list[dict[str, Any]] = []
    for segment in segments:
        text = " ".join((segment.text or "").split())
        if not text:
            continue

        avg_logprob = getattr(segment, "avg_logprob", None)
        confidence = None
        if isinstance(avg_logprob, (int, float)):
            confidence = max(0.0, min(1.0, math.exp(float(avg_logprob))))

        rows.append(
            {
                "start": float(segment.start),
                "end": float(segment.end),
                "text": text,
                "confidence": confidence,
                "avg_logprob": avg_logprob,
            }
        )

    detected_language = getattr(info, "language", None)
    return rows, detected_language


def configure_huggingface_hub() -> None:
    verify = huggingface_verify_option()
    if verify is None:
        return

    try:
        import httpx
        from huggingface_hub import set_client_factory
    except ImportError:
        return

    def client_factory() -> httpx.Client:
        return httpx.Client(follow_redirects=True, timeout=None, verify=verify)

    set_client_factory(client_factory)


def huggingface_verify_option() -> str | bool | None:
    if env_bool("HF_NO_CHECK_CERTIFICATE"):
        return False

    custom_ca = normalized_path_env("HF_CA_CERTS")
    if custom_ca:
        if not custom_ca.exists():
            raise RuntimeError(f"HF_CA_CERTS points to a file that does not exist: {custom_ca}")
        set_certificate_env_vars(custom_ca)
        return str(custom_ca)

    try:
        import certifi
    except ImportError:
        return None

    certifi_path = Path(certifi.where())
    set_certificate_env_vars(certifi_path)
    return str(certifi_path)


def set_certificate_env_vars(path: Path) -> None:
    os.environ.setdefault("SSL_CERT_FILE", str(path))
    os.environ.setdefault("REQUESTS_CA_BUNDLE", str(path))


def normalized_path_env(name: str) -> Path | None:
    value = os.getenv(name, "").strip()
    if not value:
        return None
    path = Path(value).expanduser()
    return path if path.is_absolute() else WORKER_DIR / path


def env_bool(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}
