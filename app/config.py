from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    telegram_bot_token: str
    telegram_miniapp_short_name: str
    admin_telegram_id: int
    admin_chat_id: int
    openai_api_key: str
    openai_model: str
    openai_transcribe_model: str
    default_currency: str
    database_path: Path
    miniapp_base_url: str
    miniapp_api_base_url: str
    miniapp_bind_host: str
    miniapp_port: int


def load_settings() -> Settings:
    telegram_bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    telegram_miniapp_short_name = os.getenv("TELEGRAM_MINIAPP_SHORT_NAME", "").strip()
    admin_telegram_id_raw = os.getenv("ADMIN_TELEGRAM_ID", "0").strip()
    admin_chat_id_raw = os.getenv("ADMIN_CHAT_ID", "0").strip()
    openai_api_key = os.getenv("OPENAI_API_KEY", "").strip()

    if not telegram_bot_token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is not set.")
    if not openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is not set.")

    try:
        admin_telegram_id = int(admin_telegram_id_raw or "0")
    except ValueError as exc:
        raise RuntimeError("ADMIN_TELEGRAM_ID must be a valid integer.") from exc
    try:
        admin_chat_id = int(admin_chat_id_raw or "0")
    except ValueError as exc:
        raise RuntimeError("ADMIN_CHAT_ID must be a valid integer.") from exc

    openai_model = os.getenv("OPENAI_MODEL", "gpt-5-mini").strip()
    openai_transcribe_model = os.getenv(
        "OPENAI_TRANSCRIBE_MODEL", "gpt-4o-mini-transcribe"
    ).strip()
    default_currency = os.getenv("DEFAULT_CURRENCY", "RUB").strip().upper() or "RUB"

    database_path_raw = os.getenv("DATABASE_PATH", "data/family_finance.db").strip()
    database_path = Path(database_path_raw)
    database_path.parent.mkdir(parents=True, exist_ok=True)

    miniapp_base_url = os.getenv("MINIAPP_BASE_URL", "").strip()
    miniapp_api_base_url = os.getenv("MINIAPP_API_BASE_URL", "").strip()
    miniapp_bind_host = os.getenv("MINIAPP_BIND_HOST", "127.0.0.1").strip() or "127.0.0.1"
    miniapp_port_raw = os.getenv("MINIAPP_PORT", "8080").strip()
    try:
        miniapp_port = int(miniapp_port_raw)
    except ValueError as exc:
        raise RuntimeError("MINIAPP_PORT must be a valid integer.") from exc

    return Settings(
        telegram_bot_token=telegram_bot_token,
        telegram_miniapp_short_name=telegram_miniapp_short_name,
        admin_telegram_id=admin_telegram_id,
        admin_chat_id=admin_chat_id,
        openai_api_key=openai_api_key,
        openai_model=openai_model,
        openai_transcribe_model=openai_transcribe_model,
        default_currency=default_currency,
        database_path=database_path,
        miniapp_base_url=miniapp_base_url,
        miniapp_api_base_url=miniapp_api_base_url,
        miniapp_bind_host=miniapp_bind_host,
        miniapp_port=miniapp_port,
    )
