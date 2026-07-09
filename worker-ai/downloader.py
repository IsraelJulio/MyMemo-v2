from __future__ import annotations

import ipaddress
import os
from pathlib import Path
from urllib.parse import urlparse

from yt_dlp import YoutubeDL
from yt_dlp.utils import DownloadError

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/126.0 Safari/537.36"
)
DEFAULT_YOUTUBE_PLAYER_CLIENTS = ["android", "mweb", "web_safari"]


def download_media(url: str, output_dir: Path, max_duration_seconds: int) -> tuple[Path, str | None]:
    validate_public_media_url(url)
    output_dir.mkdir(parents=True, exist_ok=True)

    options = {
        "format": "bestaudio/best",
        "noplaylist": True,
        "outtmpl": str(output_dir / "%(id)s.%(ext)s"),
        "quiet": True,
        "no_warnings": True,
        "socket_timeout": 30,
        "retries": 2,
        "http_headers": {
            "User-Agent": os.getenv("YTDLP_USER_AGENT", DEFAULT_USER_AGENT),
            "Accept-Language": os.getenv("YTDLP_ACCEPT_LANGUAGE", "en-US,en;q=0.9"),
        },
        "extractor_args": _extractor_args(),
    }
    options.update(_tls_options())

    try:
        with YoutubeDL(options) as ydl:
            info = ydl.extract_info(url, download=False)
            if not isinstance(info, dict):
                raise RuntimeError("Could not read media metadata.")
            if "entries" in info:
                raise RuntimeError("Playlists are not supported in this first version.")

            duration = info.get("duration")
            if duration and float(duration) > max_duration_seconds:
                raise RuntimeError(f"Media is longer than the {max_duration_seconds} second limit.")

            downloaded = ydl.extract_info(url, download=True)
            if not isinstance(downloaded, dict):
                raise RuntimeError("Could not download media.")

            path = _downloaded_path(ydl, downloaded)
            if not path.exists():
                raise RuntimeError("Downloaded media file was not found.")

            title = downloaded.get("title") if isinstance(downloaded.get("title"), str) else None
            return path, title
    except DownloadError as exc:
        message = str(exc)
        if "HTTP Error 403" in message:
            raise RuntimeError(
                "yt-dlp recebeu HTTP 403 do provedor ao baixar a midia. "
                "Atualize o yt-dlp e tente clientes publicos alternativos em "
                "YTDLP_YOUTUBE_PLAYER_CLIENTS, por exemplo: android,mweb,web_safari,tv. "
                "O worker nao usa cookies/login para conteudo privado."
            ) from exc
        raise


def validate_public_media_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise RuntimeError("Only http and https URLs are allowed.")
    if parsed.username or parsed.password:
        raise RuntimeError("URLs with credentials are not allowed.")

    hostname = (parsed.hostname or "").strip("[]").lower()
    if not hostname or hostname == "localhost" or hostname.endswith(".localhost"):
        raise RuntimeError("Local URLs are not allowed.")

    try:
        address = ipaddress.ip_address(hostname)
    except ValueError:
        return

    if address.is_private or address.is_loopback or address.is_link_local or address.is_multicast or address.is_reserved:
        raise RuntimeError("Private or local IP URLs are not allowed.")


def _downloaded_path(ydl: YoutubeDL, info: dict) -> Path:
    requested = info.get("requested_downloads")
    if isinstance(requested, list) and requested:
        filepath = requested[0].get("filepath")
        if isinstance(filepath, str):
            return Path(filepath)

    return Path(ydl.prepare_filename(info))


def _tls_options() -> dict:
    if _env_bool("YTDLP_NO_CHECK_CERTIFICATE"):
        return {"nocheckcertificate": True}

    custom_ca = os.getenv("YTDLP_CA_CERTS", "").strip()
    if custom_ca:
        ca_path = Path(custom_ca).expanduser()
        if not ca_path.exists():
            raise RuntimeError(f"YTDLP_CA_CERTS points to a file that does not exist: {ca_path}")
        return {"ca_certs": str(ca_path)}

    try:
        import certifi
    except ImportError:
        return {}

    return {"ca_certs": certifi.where()}


def _extractor_args() -> dict:
    clients = _csv_env("YTDLP_YOUTUBE_PLAYER_CLIENTS", DEFAULT_YOUTUBE_PLAYER_CLIENTS)
    return {"youtube": {"player_client": clients}}


def _csv_env(name: str, fallback: list[str]) -> list[str]:
    value = os.getenv(name, "").strip()
    if not value:
        return fallback
    parsed = [item.strip() for item in value.split(",") if item.strip()]
    return parsed or fallback


def _env_bool(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}
