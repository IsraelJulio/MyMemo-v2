from __future__ import annotations

import os
import ssl
from pathlib import Path
from typing import Any

WORKER_DIR = Path(__file__).resolve().parent


def translate_blocks(blocks: list[dict[str, Any]], source_language: str | None, target_language: str | None) -> list[dict[str, Any]]:
    configure_argos_ssl()

    source_code = normalize_argos_code(source_language or os.getenv("ARGOS_SOURCE_LANGUAGE", "en"))
    target_code = normalize_argos_code(target_language or os.getenv("ARGOS_TARGET_LANGUAGE", "pt"))

    if source_code == "auto":
        source_code = normalize_argos_code(os.getenv("ARGOS_SOURCE_LANGUAGE", "en"))
    if target_code == "auto":
        target_code = normalize_argos_code(os.getenv("ARGOS_TARGET_LANGUAGE", "pt"))
    if source_code == target_code:
        return [{**block, "translatedText": block["originalText"]} for block in blocks]

    try:
        import argostranslate.translate as argos_translate
    except ImportError as exc:
        raise RuntimeError("argostranslate is not installed. Run: python -m pip install -r worker-ai/requirements.txt") from exc

    installed_languages = argos_translate.get_installed_languages()
    source = next((language for language in installed_languages if language.code == source_code), None)
    target = next((language for language in installed_languages if language.code == target_code), None)

    if source is None or target is None:
        raise RuntimeError(
            "Argos language package is not installed. "
            f"Install the {source_code} -> {target_code} package with: npm run worker:argos:install"
        )

    try:
        translation = source.get_translation(target)
    except Exception as exc:
        raise RuntimeError(
            "Argos language package is not installed. "
            f"Install the {source_code} -> {target_code} package with: npm run worker:argos:install"
        ) from exc

    translated = []
    try:
        for block in blocks:
            translated.append({**block, "translatedText": translation.translate(block["originalText"])})
    except Exception as exc:
        if is_ssl_error(exc):
            raise RuntimeError(
                "Argos/Stanza failed SSL validation while downloading tokenizer data. "
                "Configure ARGOS_CA_CERTS or HF_CA_CERTS with your corporate root CA, "
                "or set ARGOS_NO_CHECK_CERTIFICATE=true for local development."
            ) from exc
        raise

    return translated


def configure_argos_ssl() -> None:
    if env_bool("ARGOS_NO_CHECK_CERTIFICATE") or env_bool("HF_NO_CHECK_CERTIFICATE"):
        ssl._create_default_https_context = ssl._create_unverified_context
        configure_requests_verify(False)
        return

    custom_ca = normalized_path_env("ARGOS_CA_CERTS") or normalized_path_env("HF_CA_CERTS")
    if custom_ca:
        if not custom_ca.exists():
            raise RuntimeError(f"Configured CA certificate file does not exist: {custom_ca}")
        set_certificate_env_vars(custom_ca, overwrite=True)
        configure_requests_verify(str(custom_ca))
        ssl._create_default_https_context = certificate_context_factory(custom_ca)
        return

    try:
        import certifi
    except ImportError:
        return

    certifi_path = Path(certifi.where())
    set_certificate_env_vars(certifi_path)
    configure_requests_verify(str(certifi_path))
    ssl._create_default_https_context = certificate_context_factory(certifi_path)


def certificate_context_factory(cafile: Path):
    def create_context(*args, **kwargs):
        kwargs.setdefault("cafile", str(cafile))
        return ssl.create_default_context(*args, **kwargs)

    return create_context


def configure_requests_verify(verify: str | bool) -> None:
    try:
        import requests
        import urllib3
    except ImportError:
        return

    if getattr(requests.sessions.Session.request, "_mymemo_tls_configured", None) == verify:
        return

    original_request = getattr(requests.sessions.Session.request, "_mymemo_original_request", requests.sessions.Session.request)

    def request_with_default_verify(self, method, url, **kwargs):
        kwargs.setdefault("verify", verify)
        return original_request(self, method, url, **kwargs)

    request_with_default_verify._mymemo_original_request = original_request
    request_with_default_verify._mymemo_tls_configured = verify
    requests.sessions.Session.request = request_with_default_verify

    if verify is False:
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


def set_certificate_env_vars(path: Path, overwrite: bool = False) -> None:
    if overwrite:
        os.environ["SSL_CERT_FILE"] = str(path)
        os.environ["REQUESTS_CA_BUNDLE"] = str(path)
        return

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


def is_ssl_error(exc: Exception) -> bool:
    text = str(exc)
    return "CERTIFICATE_VERIFY_FAILED" in text or "SSLError" in text


def normalize_argos_code(language: str) -> str:
    value = language.strip().lower()
    if value in {"pt-br", "pt_br"}:
        return "pt"
    if "-" in value:
        return value.split("-", 1)[0]
    if "_" in value:
        return value.split("_", 1)[0]
    return value
