from __future__ import annotations

import os
import ssl
from pathlib import Path

from dotenv import load_dotenv


WORKER_DIR = Path(__file__).resolve().parent


def main() -> None:
    load_dotenv(WORKER_DIR / ".env")
    configure_ssl()

    source_code = normalize_argos_code(os.getenv("ARGOS_SOURCE_LANGUAGE", "en"))
    target_code = normalize_argos_code(os.getenv("ARGOS_TARGET_LANGUAGE", "pt"))

    import argostranslate.package as argos_package
    import argostranslate.translate as argos_translate

    installed = translation_installed(argos_translate, source_code, target_code)
    if installed:
        print(f"Argos package {source_code} -> {target_code} is already installed.")
        return

    print("Updating Argos package index...")
    argos_package.update_package_index()

    available = argos_package.get_available_packages()
    package = next(
        (
            item
            for item in available
            if item.from_code == source_code and item.to_code == target_code
        ),
        None,
    )

    if package is None:
        raise RuntimeError(f"Argos package {source_code} -> {target_code} was not found in the package index.")

    print(f"Downloading and installing Argos package {source_code} -> {target_code}...")
    download_path = package.download()
    argos_package.install_from_path(download_path)
    print(f"Installed Argos package {source_code} -> {target_code}.")


def configure_ssl() -> None:
    if env_bool("ARGOS_NO_CHECK_CERTIFICATE") or env_bool("HF_NO_CHECK_CERTIFICATE") or env_bool("YTDLP_NO_CHECK_CERTIFICATE"):
        ssl._create_default_https_context = ssl._create_unverified_context
        return

    ca_path = normalized_path_env("ARGOS_CA_CERTS") or normalized_path_env("HF_CA_CERTS") or normalized_path_env("YTDLP_CA_CERTS")
    if ca_path:
        if not ca_path.exists():
            raise RuntimeError(f"Configured CA certificate file does not exist: {ca_path}")
        ssl._create_default_https_context = lambda: ssl.create_default_context(cafile=str(ca_path))
        return

    try:
        import certifi
    except ImportError:
        return

    certifi_path = certifi.where()
    os.environ.setdefault("SSL_CERT_FILE", certifi_path)
    ssl._create_default_https_context = lambda: ssl.create_default_context(cafile=certifi_path)


def translation_installed(argos_translate, source_code: str, target_code: str) -> bool:
    installed_languages = argos_translate.get_installed_languages()
    source = next((language for language in installed_languages if language.code == source_code), None)
    target = next((language for language in installed_languages if language.code == target_code), None)
    if source is None or target is None:
        return False

    try:
        source.get_translation(target)
        return True
    except Exception:
        return False


def normalize_argos_code(language: str) -> str:
    value = language.strip().lower()
    if value in {"pt-br", "pt_br"}:
        return "pt"
    if "-" in value:
        return value.split("-", 1)[0]
    if "_" in value:
        return value.split("_", 1)[0]
    return value


def normalized_path_env(name: str) -> Path | None:
    value = os.getenv(name, "").strip()
    if not value:
        return None
    path = Path(value).expanduser()
    return path if path.is_absolute() else WORKER_DIR / path


def env_bool(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}


if __name__ == "__main__":
    main()
