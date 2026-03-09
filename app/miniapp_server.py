from __future__ import annotations

import asyncio
import base64
import binascii
import hashlib
import hmac
import json
import logging
import re
import threading
import time as time_module
import uuid
from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, parse_qsl, quote, urlparse

import httpx

from app.ai import AIService, EXPENSE_CATEGORY_KEYS, INCOME_CATEGORY_KEYS
from app.bot import _fmt_money, _ru_category_label, t
from app.config import Settings
from app.db import (
    Database,
    FinanceTransaction,
    TRANSFER_CATEGORIES,
    TRANSFER_IN_CATEGORY,
    TRANSFER_OUT_CATEGORY,
)
from app.i18n import DEFAULT_LANGUAGE, normalize_language


logger = logging.getLogger(__name__)
_BOT_USERNAME_CACHE: dict[str, str] = {}

CATEGORY_GROUPS: tuple[tuple[str, str, str], ...] = (
    ("home_", "Жильё и дом", "🏠"),
    ("groceries_", "Продукты и быт", "🛒"),
    ("cafe_", "Кафе и рестораны", "🍽"),
    ("transport_", "Транспорт", "🚗"),
    ("work_", "Работа и бизнес", "💼"),
    ("education_", "Образование", "🎓"),
    ("health_", "Здоровье", "🏥"),
    ("fashion_", "Одежда и уход", "👕"),
    ("kids_", "Дети", "👶"),
    ("leisure_", "Развлечения", "🎉"),
    ("finance_", "Финансы", "💳"),
    ("pets_", "Животные", "🐾"),
)

CATEGORY_GROUP_LABELS: dict[str, dict[str, str]] = {
    "home_": {"ru": "Жильё и дом", "uz": "Uy va ro'zg'or", "en": "Home"},
    "groceries_": {"ru": "Продукты и быт", "uz": "Oziq-ovqat va ro'zg'or", "en": "Groceries & Home"},
    "cafe_": {"ru": "Кафе и рестораны", "uz": "Kafe va restoranlar", "en": "Cafes & Restaurants"},
    "transport_": {"ru": "Транспорт", "uz": "Transport", "en": "Transport"},
    "work_": {"ru": "Работа и бизнес", "uz": "Ish va biznes", "en": "Work & Business"},
    "education_": {"ru": "Образование", "uz": "Ta'lim", "en": "Education"},
    "health_": {"ru": "Здоровье", "uz": "Sog'liq", "en": "Health"},
    "fashion_": {"ru": "Одежда и уход", "uz": "Kiyim va parvarish", "en": "Clothes & Care"},
    "kids_": {"ru": "Дети", "uz": "Bolalar", "en": "Kids"},
    "leisure_": {"ru": "Развлечения", "uz": "Ko'ngilochar", "en": "Leisure"},
    "finance_": {"ru": "Финансы", "uz": "Moliya", "en": "Finance"},
    "pets_": {"ru": "Животные", "uz": "Uy hayvonlari", "en": "Pets"},
}

CATEGORY_EXACT: dict[str, tuple[str, str]] = {
    "expense_other": ("Прочее", "📦"),
    "income_other": ("Прочие доходы", "📦"),
    "transfer_internal_out": ("Перевод (отправлено)", "↔️"),
    "transfer_internal_in": ("Перевод (получено)", "↔️"),
    "salary": ("Зарплата", "💼"),
    "bonus": ("Бонус/премия", "🎁"),
    "windfall": ("Выигрыш/находка", "🏆"),
    "profit": ("Прибыль", "📈"),
    "cashback": ("Кэшбэк", "💸"),
    "gift": ("Подарок", "🎉"),
}

CATEGORY_EXACT_LABELS: dict[str, dict[str, str]] = {
    "expense_other": {"ru": "Прочее", "uz": "Boshqa", "en": "Other"},
    "income_other": {"ru": "Прочие доходы", "uz": "Boshqa daromadlar", "en": "Other income"},
    "transfer_internal_out": {"ru": "Перевод (отправлено)", "uz": "O'tkazma (yuborildi)", "en": "Transfer (sent)"},
    "transfer_internal_in": {"ru": "Перевод (получено)", "uz": "O'tkazma (qabul qilindi)", "en": "Transfer (received)"},
    "salary": {"ru": "Зарплата", "uz": "Maosh", "en": "Salary"},
    "bonus": {"ru": "Бонус/премия", "uz": "Bonus/mukofot", "en": "Bonus"},
    "windfall": {"ru": "Выигрыш/находка", "uz": "Yutuq/topilma", "en": "Windfall"},
    "profit": {"ru": "Прибыль", "uz": "Foyda", "en": "Profit"},
    "cashback": {"ru": "Кэшбэк", "uz": "Keshbek", "en": "Cashback"},
    "gift": {"ru": "Подарок", "uz": "Sovg'a", "en": "Gift"},
}

MONTH_NAMES_RU_GENITIVE = (
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
)

MONTH_NAMES_GENITIVE_BY_LANG: dict[str, tuple[str, ...]] = {
    "ru": MONTH_NAMES_RU_GENITIVE,
    "uz": (
        "yanvar",
        "fevral",
        "mart",
        "aprel",
        "may",
        "iyun",
        "iyul",
        "avgust",
        "sentyabr",
        "oktyabr",
        "noyabr",
        "dekabr",
    ),
    "en": (
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ),
}

DEFAULT_EXPENSE_CATEGORY = "expense_other"
DEFAULT_INCOME_CATEGORY = "income_other"

DATE_TIME_INPUT_RE = re.compile(r"^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}$")
DATA_URL_IMAGE_RE = re.compile(r"^data:(image/[a-zA-Z0-9.+-]+);base64,(.+)$", re.DOTALL)

TELEGRAM_INIT_DATA_MAX_AGE_SECONDS = 15 * 60
WRITE_RATE_LIMIT_PER_MINUTE = 30
AI_RATE_LIMIT_PER_HOUR = 60
IDEMPOTENCY_TTL_HOURS = 24
_LOCALHOST_ORIGIN_HOSTS = {"localhost", "127.0.0.1", "::1"}

_IDEMPOTENT_WRITE_PATHS = frozenset(
    {
        "/miniapp/api/create_transaction",
        "/miniapp/api/create_transfer",
        "/miniapp/api/support",
        "/miniapp/api/review",
        "/api/create_transaction",
        "/api/create_transfer",
        "/api/support",
        "/api/review",
    }
)
_WRITE_RATE_LIMIT_PATHS = _IDEMPOTENT_WRITE_PATHS
_AI_RATE_LIMIT_PATHS = frozenset(
    {
        "/miniapp/api/suggest_category",
        "/miniapp/api/create_transaction",
        "/api/suggest_category",
        "/api/create_transaction",
    }
)


@dataclass(frozen=True)
class VerifiedMiniAppAuth:
    user_id: int
    chat_id: int
    auth_date: int
    start_param: str = ""


class _FixedWindowRateLimiter:
    """Thread-safe sliding-window limiter for a single-process miniapp server."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._events: dict[tuple[str, int], deque[float]] = defaultdict(deque)

    def allow(self, *, bucket: str, user_id: int, limit: int, window_seconds: int) -> bool:
        now = time_module.time()
        key = (str(bucket), int(user_id))
        cutoff = now - float(window_seconds)
        with self._lock:
            queue = self._events[key]
            while queue and queue[0] <= cutoff:
                queue.popleft()
            if len(queue) >= int(limit):
                return False
            queue.append(now)
            if not queue:
                self._events.pop(key, None)
            return True


def _canonical_json_hash(payload: dict[str, object]) -> str:
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _extract_origin_from_url(raw_url: str) -> str | None:
    value = str(raw_url or "").strip()
    if not value:
        return None
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")


def _is_allowed_localhost_origin(origin: str) -> bool:
    parsed = urlparse(str(origin or "").strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return False
    hostname = (parsed.hostname or "").strip().lower()
    return hostname in _LOCALHOST_ORIGIN_HOSTS


def _verify_telegram_webapp_init_data(*, init_data_raw: str, bot_token: str) -> dict[str, str]:
    init_data = str(init_data_raw or "").strip()
    if not init_data:
        raise ValueError("missing_init_data")

    pairs = parse_qsl(init_data, keep_blank_values=True, strict_parsing=False)
    if not pairs:
        raise ValueError("invalid_init_data")

    data: dict[str, str] = {}
    provided_hash = ""
    for key, value in pairs:
        if key == "hash":
            provided_hash = str(value or "").strip().lower()
            continue
        data[str(key)] = str(value)
    if not provided_hash or not re.fullmatch(r"[0-9a-f]{64}", provided_hash):
        raise ValueError("invalid_hash")

    data_check_string = "\n".join(f"{key}={data[key]}" for key in sorted(data))

    # Telegram Mini App validation uses the WebAppData HMAC-derived secret.
    secret_key = hmac.new(b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256).digest()
    calculated_hash = hmac.new(
        secret_key,
        data_check_string.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    # Backward-compatible fallback for environments/tests that still use the legacy SHA256(bot_token) key derivation.
    if not hmac.compare_digest(calculated_hash, provided_hash):
        legacy_secret_key = hashlib.sha256(bot_token.encode("utf-8")).digest()
        legacy_hash = hmac.new(
            legacy_secret_key,
            data_check_string.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(legacy_hash, provided_hash):
            raise ValueError("invalid_hash")

    auth_date_raw = str(data.get("auth_date") or "").strip()
    try:
        auth_date = int(auth_date_raw)
    except ValueError as exc:
        raise ValueError("invalid_auth_date") from exc
    now_ts = int(time_module.time())
    if auth_date <= 0 or (now_ts - auth_date) > TELEGRAM_INIT_DATA_MAX_AGE_SECONDS:
        raise ValueError("auth_date_expired")

    return data


def _extract_verified_auth_context(fields: dict[str, str]) -> VerifiedMiniAppAuth:
    user_payload_raw = str(fields.get("user") or "").strip()
    chat_payload_raw = str(fields.get("chat") or "").strip()
    try:
        user_payload = json.loads(user_payload_raw) if user_payload_raw else {}
    except json.JSONDecodeError as exc:
        raise ValueError("invalid_user_payload") from exc
    try:
        chat_payload = json.loads(chat_payload_raw) if chat_payload_raw else {}
    except json.JSONDecodeError as exc:
        raise ValueError("invalid_chat_payload") from exc

    if not isinstance(user_payload, dict):
        raise ValueError("invalid_user_payload")
    if chat_payload and not isinstance(chat_payload, dict):
        raise ValueError("invalid_chat_payload")

    try:
        user_id = int(user_payload.get("id") or 0)
    except (TypeError, ValueError) as exc:
        raise ValueError("invalid_user_id") from exc
    try:
        chat_id = int(chat_payload.get("id") or 0) if isinstance(chat_payload, dict) else 0
    except (TypeError, ValueError) as exc:
        raise ValueError("invalid_chat_id") from exc
    try:
        auth_date = int(fields.get("auth_date") or 0)
    except (TypeError, ValueError) as exc:
        raise ValueError("invalid_auth_date") from exc

    if user_id <= 0:
        raise ValueError("invalid_user_id")

    start_param = str(fields.get("start_param") or "").strip()
    return VerifiedMiniAppAuth(
        user_id=user_id,
        chat_id=chat_id,
        auth_date=auth_date,
        start_param=start_param,
    )


def _parse_start_param_chat_id(raw: str) -> int:
    value = str(raw or "").strip()
    if not value:
        return 0
    try:
        direct = int(value)
    except (TypeError, ValueError):
        direct = 0
    if direct != 0:
        return int(direct)
    match = re.fullmatch(r"chat_(-?\d+)", value)
    if not match:
        return 0
    try:
        return int(match.group(1))
    except (TypeError, ValueError):
        return 0


def _normalize_category_key(raw: str, kind: str) -> str:
    key = str(raw or "").strip().lower().replace("-", "_").replace(" ", "_")
    if kind == "income":
        return key if key in INCOME_CATEGORY_KEYS else DEFAULT_INCOME_CATEGORY
    return key if key in EXPENSE_CATEGORY_KEYS else DEFAULT_EXPENSE_CATEGORY


def _categories_payload(lang: str = DEFAULT_LANGUAGE) -> dict[str, list[dict[str, str]]]:
    expense_keys = sorted(EXPENSE_CATEGORY_KEYS)
    income_keys = sorted(INCOME_CATEGORY_KEYS)
    return {
        "expense": [
            {"key": key, "label": _ru_category_label(key, "expense")}
            for key in expense_keys
            if not key.startswith("transfer_internal_")
        ],
        "income": [
            {"key": key, "label": _ru_category_label(key, "income")}
            for key in income_keys
        ],
    }


@dataclass(frozen=True)
class RunningMiniAppServer:
    httpd: ThreadingHTTPServer
    thread: threading.Thread


def _local_tzinfo():
    return datetime.now().astimezone().tzinfo or timezone.utc


def _to_utc_bounds(start_d: date, end_d: date) -> tuple[datetime, datetime]:
    tzinfo = _local_tzinfo()
    start_local = datetime.combine(start_d, time.min, tzinfo=tzinfo)
    end_local_exclusive = datetime.combine(end_d + timedelta(days=1), time.min, tzinfo=tzinfo)
    return (
        start_local.astimezone(timezone.utc).replace(tzinfo=None),
        end_local_exclusive.astimezone(timezone.utc).replace(tzinfo=None),
    )


def _parse_date_token(token: str) -> date | None:
    raw = (token or "").strip()
    if not raw:
        return None
    for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


def _category_group(category: str, lang: str = DEFAULT_LANGUAGE) -> tuple[str, str]:
    ui_lang = normalize_language(lang)
    key = (category or "").strip().lower()
    if key in CATEGORY_EXACT:
        label_ru, emoji = CATEGORY_EXACT[key]
        label = CATEGORY_EXACT_LABELS.get(key, {}).get(ui_lang, label_ru)
        return (label, emoji)
    for prefix, label, emoji in CATEGORY_GROUPS:
        if key.startswith(prefix):
            translated = CATEGORY_GROUP_LABELS.get(prefix, {}).get(ui_lang, label)
            return (translated, emoji)
    fallback = {
        "ru": "Прочее",
        "uz": "Boshqa",
        "en": "Other",
    }.get(ui_lang, "Other")
    return (fallback, "📦")


def _human_period_label(start_d: date, end_d: date, lang: str = DEFAULT_LANGUAGE) -> str:
    ui_lang = normalize_language(lang)
    month_names = MONTH_NAMES_GENITIVE_BY_LANG.get(ui_lang, MONTH_NAMES_GENITIVE_BY_LANG["ru"])
    if start_d == end_d:
        if ui_lang == "en":
            return f"{month_names[start_d.month - 1]} {start_d.day}, {start_d.year}"
        return f"{start_d.day} {month_names[start_d.month - 1]} {start_d.year}"
    if ui_lang == "en":
        return (
            f"{month_names[start_d.month - 1]} {start_d.day}, {start_d.year}"
            f" - {month_names[end_d.month - 1]} {end_d.day}, {end_d.year}"
        )
    return (
        f"{start_d.day} {month_names[start_d.month - 1]} {start_d.year}"
        f" - {end_d.day} {month_names[end_d.month - 1]} {end_d.year}"
    )


def _db_timestamp_to_local_iso(raw: str) -> str:
    utc_dt = datetime.strptime(raw, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
    return utc_dt.astimezone(_local_tzinfo()).isoformat()


def _parse_local_datetime_input(raw: str) -> datetime | None:
    value = (raw or "").strip()
    if not value:
        return None
    if not DATE_TIME_INPUT_RE.match(value):
        return None
    value = value.replace(" ", "T")
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=_local_tzinfo())
    return parsed.astimezone(_local_tzinfo())


def _local_dt_to_utc_naive(value: datetime) -> datetime:
    local_dt = value.astimezone(_local_tzinfo())
    return local_dt.astimezone(timezone.utc).replace(tzinfo=None)


def _format_date_time_lines(local_dt: datetime) -> tuple[str, str]:
    date_line = local_dt.strftime("%d.%m.%Y")
    time_line = local_dt.strftime("%H:%M")
    return date_line, time_line


def _build_saved_transaction_message(
    *,
    kind: str,
    member_name: str,
    amount: float,
    currency: str,
    category: str,
    description: str,
    is_family: bool,
    local_dt: datetime,
    lang: str = DEFAULT_LANGUAGE,
) -> str:
    ui_lang = normalize_language(lang)
    if ui_lang == "uz":
        title = "Daromadingiz muvaffaqiyatli qo'shildi ✅" if kind == "income" else "Xarajatingiz muvaffaqiyatli qo'shildi ✅"
        actor_label = "🙋 Qo'shdi"
        amount_label = "💰 Summa"
        category_label = "🏷 Kategoriya"
        description_label = "🧾 Izoh"
        context_line = "👨‍👩‍👧 Kontekst: oilaviy" if is_family else "👤 Kontekst: shaxsiy"
        added_via = "ℹ️ Miniapp orqali qo'shildi"
        date_label = "📅 Sana"
        time_label = "🕔 Vaqt"
        actor_fallback = "Ishtirokchi"
    elif ui_lang == "en":
        title = "Income added successfully ✅" if kind == "income" else "Expense added successfully ✅"
        actor_label = "🙋 Added by"
        amount_label = "💰 Amount"
        category_label = "🏷 Category"
        description_label = "🧾 Description"
        context_line = "👨‍👩‍👧 Context: family" if is_family else "👤 Context: personal"
        added_via = "ℹ️ Added via miniapp"
        date_label = "📅 Date"
        time_label = "🕔 Time"
        actor_fallback = "Member"
    else:
        title = "Ваш доход успешно добавлен ✅" if kind == "income" else "Ваш расход успешно добавлен ✅"
        actor_label = "🙋 Добавил(а)"
        amount_label = "💰 Сумма"
        category_label = "🏷 Категория"
        description_label = "🧾 Описание"
        context_line = "👨‍👩‍👧 Контекст: семейное" if is_family else "👤 Контекст: личное"
        added_via = "ℹ️ Добавлен с миниапп"
        date_label = "📅 Дата"
        time_label = "🕔 Время"
        actor_fallback = "Участник"

    actor = (member_name or "").strip() or actor_fallback
    date_line, time_line = _format_date_time_lines(local_dt)
    return (
        f"{title}\n\n"
        f"{actor_label}: {actor}\n"
        f"{amount_label}: {_fmt_money(amount, currency)}\n"
        f"{category_label}: {_ru_category_label(category, kind)}\n"
        f"{description_label}: {description}\n\n"
        f"{context_line}\n"
        f"{added_via}\n"
        f"{date_label}: {date_line}\n"
        f"{time_label}: {time_line}"
    )


def _build_saved_transfer_message(
    *,
    amount: float,
    currency: str,
    sender_name: str,
    recipient_name: str,
    local_dt: datetime,
    description: str,
    lang: str = DEFAULT_LANGUAGE,
) -> str:
    ui_lang = normalize_language(lang)
    date_line, time_line = _format_date_time_lines(local_dt)
    comment_line = ""
    note = (description or "").strip()
    if note:
        if ui_lang == "uz":
            comment_line = f"\n🧾 Izoh: {note}"
        elif ui_lang == "en":
            comment_line = f"\n🧾 Comment: {note}"
        else:
            comment_line = f"\n🧾 Комментарий: {note}"
    if ui_lang == "uz":
        text = (
            f"✅ O'tkazma saqlandi: {_fmt_money(amount, currency)} {sender_name} → {recipient_name}.\n"
            "(Oilaviy balansga ta'sir qilmaydi)\n"
            f"{comment_line}\n"
            "ℹ️ Miniapp orqali qo'shildi\n"
            f"📅 Sana: {date_line}\n"
            f"🕔 Vaqt: {time_line}"
        )
    elif ui_lang == "en":
        text = (
            f"✅ Transfer recorded: {_fmt_money(amount, currency)} from {sender_name} → {recipient_name}.\n"
            "(Does not affect family balance)\n"
            f"{comment_line}\n"
            "ℹ️ Added via miniapp\n"
            f"📅 Date: {date_line}\n"
            f"🕔 Time: {time_line}"
        )
    else:
        text = (
            f"✅ Перевод записан: {_fmt_money(amount, currency)} от {sender_name} → {recipient_name}.\n"
            "(На семейный баланс не влияет)\n"
            f"{comment_line}\n"
            "ℹ️ Добавлен с миниапп\n"
            f"📅 Дата: {date_line}\n"
            f"🕔 Время: {time_line}"
        )
    return text.replace("\n\n\n", "\n\n").strip()


def _ai_probe_text(*, kind: str, amount: float, currency: str, description: str) -> str:
    verb = "получил" if kind == "income" else "потратил"
    amount_txt = int(round(max(amount, 1.0)))
    base = f"{verb} {amount_txt} {currency} {description}".strip()
    return re.sub(r"\s+", " ", base)


def _infer_category_and_family(
    *,
    ai_service: AIService,
    kind: str,
    amount: float,
    currency: str,
    description: str,
) -> tuple[str, bool]:
    fallback_key = DEFAULT_INCOME_CATEGORY if kind == "income" else DEFAULT_EXPENSE_CATEGORY
    probe_text = _ai_probe_text(kind=kind, amount=amount, currency=currency, description=description)

    try:
        events = asyncio.run(ai_service.parse_finance_events(probe_text))
    except Exception:
        logger.exception("MiniApp parse_finance_events failed while inferring context/category")
        events = []

    if events:
        matching = next((event for event in events if event.kind == kind), events[0])
        category_key = _normalize_category_key(matching.category, kind)
        return category_key, bool(matching.is_family)

    try:
        category_key = asyncio.run(
            ai_service.infer_category(
                kind=kind,
                description=description,
                amount=amount,
                currency=currency,
                is_family=False,
            )
        )
    except Exception:
        logger.exception("MiniApp infer_category fallback failed")
        category_key = fallback_key

    return _normalize_category_key(category_key, kind), False


def _send_telegram_message(
    *,
    bot_token: str,
    chat_id: int,
    text: str,
    reply_markup: dict[str, object] | None = None,
) -> int:
    token = bot_token.strip()
    if not token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN не настроен")
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        payload: dict[str, object] = {"chat_id": chat_id, "text": text}
        if reply_markup:
            payload["reply_markup"] = reply_markup
        response = httpx.post(url, json=payload, timeout=10.0)
    except httpx.HTTPError as exc:
        raise RuntimeError(f"Не удалось подключиться к Telegram API: {exc}") from exc

    raw = response.text
    if response.status_code >= 400:
        raise RuntimeError(f"Telegram API вернул HTTP {response.status_code}: {raw[:600]}")

    try:
        parsed = response.json()
    except Exception as exc:
        raise RuntimeError("Некорректный JSON-ответ Telegram API") from exc

    if not isinstance(parsed, dict):
        raise RuntimeError("Некорректный формат ответа Telegram API")

    if not parsed.get("ok"):
        description = str(parsed.get("description") or "неизвестная ошибка")
        error_code = parsed.get("error_code")
        if error_code is not None:
            raise RuntimeError(f"Telegram API error {error_code}: {description}")
        raise RuntimeError(f"Telegram API error: {description}")

    result = parsed.get("result")
    if not isinstance(result, dict):
        raise RuntimeError("Telegram API не вернул объект result")
    message_id = int(result.get("message_id") or 0)
    if message_id <= 0:
        raise RuntimeError("Telegram API не вернул message_id")
    return message_id


def _telegram_get_me_username(bot_token: str) -> str | None:
    token = (bot_token or "").strip()
    if not token:
        return None
    cached = _BOT_USERNAME_CACHE.get(token)
    if cached:
        return cached
    url = f"https://api.telegram.org/bot{token}/getMe"
    try:
        resp = httpx.get(url, timeout=10.0)
        resp.raise_for_status()
        data = resp.json()
        if not isinstance(data, dict) or not data.get("ok") or not isinstance(data.get("result"), dict):
            return None
        username = str(data["result"].get("username") or "").strip()
        if not username:
            return None
        _BOT_USERNAME_CACHE[token] = username
        return username
    except Exception:
        logger.exception("MiniApp getMe failed while building refreshed app button")
        return None


def _encode_app_start_payload(chat_id: int) -> str:
    sign = "m" if chat_id < 0 else "p"
    return f"app_{sign}{abs(int(chat_id))}"


def _group_main_reply_keyboard_payload(lang: str) -> dict[str, object]:
    ui_lang = normalize_language(lang)
    return {
        "keyboard": [
            [
                {"text": t("main_menu_reports", ui_lang)},
                {"text": t("main_menu_settings", ui_lang)},
            ],
            [
                {"text": t("main_menu_app", ui_lang)},
            ],
        ],
        "resize_keyboard": True,
    }


def _miniapp_open_inline_payload(
    bot_token: str,
    chat_id: int,
    lang: str,
    *,
    app_short_name: str = "",
) -> dict[str, object] | None:
    username = _telegram_get_me_username(bot_token)
    if not username:
        return None
    normalized_short_name = str(app_short_name or "").strip()
    if int(chat_id) < 0:
        start_param = quote(f"chat_{int(chat_id)}", safe="")
        if normalized_short_name:
            url = f"https://t.me/{username}/{quote(normalized_short_name, safe='')}?startapp={start_param}"
        else:
            url = f"https://t.me/{username}?startapp={start_param}"
    else:
        url = f"https://t.me/{username}?start={_encode_app_start_payload(chat_id)}"
    label = {
        "ru": "📱 Открыть Mini App",
        "uz": "📱 Mini App'ni ochish",
        "en": "📱 Open Mini App",
    }.get(normalize_language(lang), "📱 Open Mini App")
    return {
        "inline_keyboard": [
            [
                {
                    "text": label,
                    "url": url,
                }
            ]
        ]
    }


def _safe_telegram_caption(text: str, *, limit: int = 1024) -> str:
    normalized = (text or "").strip()
    if len(normalized) <= limit:
        return normalized
    return normalized[: limit - 1].rstrip() + "…"


def _send_telegram_photo(
    *,
    bot_token: str,
    chat_id: int,
    photo_bytes: bytes,
    filename: str,
    caption: str | None = None,
    mime_type: str = "image/jpeg",
) -> int:
    token = bot_token.strip()
    if not token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN не настроен")
    if not photo_bytes:
        raise RuntimeError("Пустое изображение")
    url = f"https://api.telegram.org/bot{token}/sendPhoto"
    data: dict[str, object] = {"chat_id": chat_id}
    caption_safe = _safe_telegram_caption(caption or "")
    if caption_safe:
        data["caption"] = caption_safe
    try:
        response = httpx.post(
            url,
            data=data,
            files={"photo": (filename or "bug-report.jpg", photo_bytes, mime_type or "image/jpeg")},
            timeout=20.0,
        )
    except httpx.HTTPError as exc:
        raise RuntimeError(f"Не удалось подключиться к Telegram API: {exc}") from exc

    raw = response.text
    if response.status_code >= 400:
        raise RuntimeError(f"Telegram API вернул HTTP {response.status_code}: {raw[:600]}")
    try:
        parsed = response.json()
    except Exception as exc:
        raise RuntimeError("Некорректный JSON-ответ Telegram API") from exc
    if not isinstance(parsed, dict) or not parsed.get("ok"):
        description = str((parsed or {}).get("description") if isinstance(parsed, dict) else "" or "неизвестная ошибка")
        error_code = parsed.get("error_code") if isinstance(parsed, dict) else None
        if error_code is not None:
            raise RuntimeError(f"Telegram API error {error_code}: {description}")
        raise RuntimeError(f"Telegram API error: {description}")
    result = parsed.get("result")
    if not isinstance(result, dict):
        raise RuntimeError("Telegram API не вернул объект result")
    message_id = int(result.get("message_id") or 0)
    if message_id <= 0:
        raise RuntimeError("Telegram API не вернул message_id")
    return message_id


def _decode_data_url_image(raw: str) -> tuple[bytes, str]:
    value = str(raw or "").strip()
    if not value:
        return b"", ""
    match = DATA_URL_IMAGE_RE.match(value)
    if not match:
        raise ValueError("invalid image payload")
    mime_type = str(match.group(1) or "").strip().lower()
    b64_payload = str(match.group(2) or "").strip()
    try:
        photo_bytes = base64.b64decode(b64_payload, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("invalid image base64") from exc
    if not photo_bytes:
        raise ValueError("empty image")
    return photo_bytes, mime_type


def _parse_period(query: dict[str, list[str]]) -> tuple[str, date, date]:
    today = datetime.now(_local_tzinfo()).date()
    mode = ((query.get("period") or ["today"])[0] or "today").strip().lower()
    if mode == "week":
        return ("week", today - timedelta(days=6), today)
    if mode == "month":
        return ("month", today.replace(day=1), today)
    if mode == "year":
        return ("year", date(today.year, 1, 1), today)
    if mode == "custom":
        start_raw = ((query.get("start") or [""])[0] or "").strip()
        end_raw = ((query.get("end") or [""])[0] or "").strip()
        start_d = _parse_date_token(start_raw)
        end_d = _parse_date_token(end_raw)
        if start_d and end_d:
            if start_d <= end_d:
                return ("custom", start_d, end_d)
            return ("custom", end_d, start_d)
    return ("today", today, today)


def _filter_transactions_by_scope(
    rows: list[dict[str, object]],
    *,
    scope: str,
    include_transfers: bool = False,
) -> list[dict[str, object]]:
    filtered: list[dict[str, object]] = []
    for row in rows:
        category = str(row.get("category") or "")
        is_transfer = category in TRANSFER_CATEGORIES
        if is_transfer and not include_transfers:
            continue
        if scope == "family":
            # "Family expenses" scope intentionally excludes internal transfers and incomes.
            if is_transfer:
                continue
            if str(row.get("kind") or "") != "expense":
                continue
        filtered.append(row)
    return filtered


def _build_scope_options(
    members: list[dict[str, object]],
    *,
    lang: str = DEFAULT_LANGUAGE,
) -> list[dict[str, str]]:
    ui_lang = normalize_language(lang)
    items: list[dict[str, str]] = []
    for member in members:
        user_id = int(member.get("telegram_user_id") or 0)
        if user_id <= 0:
            continue
        fallback_user = {
            "ru": f"Пользователь {user_id}",
            "uz": f"Foydalanuvchi {user_id}",
            "en": f"User {user_id}",
        }.get(ui_lang, f"User {user_id}")
        name = str(member.get("custom_name") or member.get("full_name") or fallback_user)
        items.append({"key": f"user:{user_id}", "label": name})
    items.append(
        {
            "key": "family",
            "label": {
                "ru": "Семейные расходы",
                "uz": "Oilaviy xarajatlar",
                "en": "Family expenses",
            }.get(ui_lang, "Family expenses"),
        }
    )
    items.append(
        {
            "key": "all",
            "label": {
                "ru": "Общие расходы",
                "uz": "Umumiy xarajatlar",
                "en": "All expenses",
            }.get(ui_lang, "All expenses"),
        }
    )
    return items


def _resolve_scope(
    scope_raw: str,
    scope_options: list[dict[str, str]],
) -> tuple[str, int | None]:
    allowed = {item["key"] for item in scope_options}
    scope = (scope_raw or "all").strip().lower()
    if scope not in allowed:
        scope = "all" if "all" in allowed else (next(iter(allowed), "all"))
    if scope.startswith("user:"):
        try:
            return scope, int(scope.split(":", 1)[1])
        except ValueError:
            return "all", None
    return scope, None


def _aggregate_chart(
    rows: list[dict[str, object]],
    *,
    lang: str = DEFAULT_LANGUAGE,
) -> tuple[list[dict[str, object]], int]:
    by_group: dict[str, dict[str, object]] = {}
    total_expense = 0.0
    for row in rows:
        if str(row.get("kind") or "") != "expense":
            continue
        amount = float(row.get("amount") or 0.0)
        if amount <= 0:
            continue
        category = str(row.get("category") or "")
        label, emoji = _category_group(category, lang)
        bucket = by_group.setdefault(label, {"label": label, "emoji": emoji, "total": 0.0})
        bucket["total"] = float(bucket.get("total") or 0.0) + amount
        total_expense += amount

    items = sorted(by_group.values(), key=lambda x: float(x.get("total") or 0.0), reverse=True)
    result: list[dict[str, object]] = []
    for item in items:
        amount = int(round(float(item.get("total") or 0.0)))
        percent = int(round((amount / total_expense) * 100)) if total_expense > 0 else 0
        result.append(
            {
                "label": str(
                    item.get("label")
                    or {
                        "ru": "Прочее",
                        "uz": "Boshqa",
                        "en": "Other",
                    }.get(normalize_language(lang), "Other")
                ),
                "emoji": str(item.get("emoji") or "📦"),
                "amount": amount,
                "percent": percent,
            }
        )
    return result, int(round(total_expense))


def _build_overview_payload(
    *,
    db: Database,
    workspace_id: int,
    scope: str,
    scope_user_id: int | None,
    period_mode: str,
    start_d: date,
    end_d: date,
    lang: str = DEFAULT_LANGUAGE,
) -> dict[str, object]:
    period_start_utc, period_end_utc = _to_utc_bounds(start_d, end_d)
    if scope_user_id is not None:
        rows = db.get_period_transactions(
            chat_id=0,
            workspace_id=workspace_id,
            period_start=period_start_utc,
            period_end=period_end_utc,
            telegram_user_id=scope_user_id,
        )
    elif scope == "family":
        rows = db.get_period_transactions(
            chat_id=0,
            workspace_id=workspace_id,
            period_start=period_start_utc,
            period_end=period_end_utc,
            is_family=True,
        )
    else:
        rows = db.get_period_transactions(
            chat_id=0,
            workspace_id=workspace_id,
            period_start=period_start_utc,
            period_end=period_end_utc,
        )

    # Transfers are hidden from expenses/income breakdown, but we expose a separate
    # summary metric for the home dashboard card.
    if scope_user_id is not None:
        transfer_source_rows = rows
    else:
        transfer_source_rows = db.get_period_transactions(
            chat_id=0,
            workspace_id=workspace_id,
            period_start=period_start_utc,
            period_end=period_end_utc,
        )

    tx_rows = _filter_transactions_by_scope(rows, scope=scope)

    income = 0.0
    expense = 0.0
    for row in tx_rows:
        amount = float(row.get("amount") or 0.0)
        if str(row.get("kind") or "") == "income":
            income += amount
        else:
            expense += amount

    transfer_total = 0.0
    for row in transfer_source_rows:
        category = str(row.get("category") or "")
        amount = float(row.get("amount") or 0.0)
        if amount <= 0:
            continue
        if scope_user_id is not None:
            if category in TRANSFER_CATEGORIES:
                transfer_total += amount
        else:
            if category == TRANSFER_OUT_CATEGORY:
                transfer_total += amount

    chart_items, total_expense_chart = _aggregate_chart(tx_rows, lang=lang)

    tx_rows_sorted = sorted(
        tx_rows,
        key=lambda x: str(x.get("created_at") or ""),
        reverse=True,
    )
    recent_expenses: list[dict[str, object]] = []
    for row in tx_rows_sorted:
        if str(row.get("kind") or "") != "expense":
            continue
        label, emoji = _category_group(str(row.get("category") or ""), lang)
        recent_expenses.append(
            {
                "id": int(row.get("id") or 0),
                "kind": str(row.get("kind") or "expense"),
                "amount": int(round(float(row.get("amount") or 0.0))),
                "currency": str(row.get("currency") or "UZS"),
                "category_label": label,
                "category_emoji": emoji,
                "description": str(row.get("description") or ""),
                "created_at_iso": _db_timestamp_to_local_iso(str(row.get("created_at") or "")),
            }
        )
        if len(recent_expenses) >= 3:
            break

    return {
        "period": {
            "mode": period_mode,
            "start": start_d.isoformat(),
            "end": end_d.isoformat(),
            "label": _human_period_label(start_d, end_d, lang),
        },
        "summary": {
            "income": int(round(income)),
            "expense": int(round(expense)),
            "balance": int(round(income - expense)),
            "transfer_total": int(round(transfer_total)),
            "currency": "UZS",
        },
        "chart": {
            "total_expense": total_expense_chart,
            "items": chart_items,
        },
        "recent_expenses": recent_expenses,
        "transactions_count": len(tx_rows),
    }


def _build_transactions_payload(
    *,
    db: Database,
    workspace_id: int,
    scope: str,
    scope_user_id: int | None,
    start_d: date,
    end_d: date,
    lang: str = DEFAULT_LANGUAGE,
    include_transfers: bool = False,
) -> dict[str, object]:
    period_start_utc, period_end_utc = _to_utc_bounds(start_d, end_d)
    if scope_user_id is not None:
        rows = db.get_period_transactions(
            chat_id=0,
            workspace_id=workspace_id,
            period_start=period_start_utc,
            period_end=period_end_utc,
            telegram_user_id=scope_user_id,
        )
    elif scope == "family":
        rows = db.get_period_transactions(
            chat_id=0,
            workspace_id=workspace_id,
            period_start=period_start_utc,
            period_end=period_end_utc,
            is_family=True,
        )
    else:
        rows = db.get_period_transactions(
            chat_id=0,
            workspace_id=workspace_id,
            period_start=period_start_utc,
            period_end=period_end_utc,
        )

    tx_rows = _filter_transactions_by_scope(rows, scope=scope, include_transfers=include_transfers)
    tx_rows_sorted = sorted(
        tx_rows,
        key=lambda x: str(x.get("created_at") or ""),
        reverse=True,
    )
    items: list[dict[str, object]] = []
    for row in tx_rows_sorted:
        label, emoji = _category_group(str(row.get("category") or ""), lang)
        items.append(
            {
                "id": int(row.get("id") or 0),
                "kind": str(row.get("kind") or ""),
                "amount": int(round(float(row.get("amount") or 0.0))),
                "currency": str(row.get("currency") or "UZS"),
                "category": str(row.get("category") or ""),
                "category_label": label,
                "category_emoji": emoji,
                "description": str(row.get("description") or ""),
                "created_at_iso": _db_timestamp_to_local_iso(str(row.get("created_at") or "")),
            }
        )
    return {"items": items}


def _build_handler(
    *,
    static_dir: Path,
    database_path: Path,
    ai_service: AIService,
    bot_token: str,
    default_currency: str,
    support_chat_id: int,
    miniapp_base_url: str,
):
    allowed_exact_origins: set[str] = set()
    configured_origin = _extract_origin_from_url(miniapp_base_url)
    if configured_origin:
        allowed_exact_origins.add(configured_origin)
    rate_limiter = _FixedWindowRateLimiter()

    class MiniAppHandler(BaseHTTPRequestHandler):
        def _read_json_body(self) -> dict[str, object] | None:
            length_raw = self.headers.get("Content-Length", "0")
            try:
                length = int(length_raw)
            except ValueError:
                return None
            if length <= 0:
                return None
            raw = self.rfile.read(length)
            try:
                payload = json.loads(raw.decode("utf-8"))
            except Exception:
                return None
            if not isinstance(payload, dict):
                return None
            return payload

        @staticmethod
        def _coerce_bool(value: object) -> bool:
            if isinstance(value, bool):
                return value
            if isinstance(value, (int, float)):
                return bool(value)
            if isinstance(value, str):
                lowered = value.strip().lower()
                return lowered in {"1", "true", "yes", "on", "да"}
            return False

        @staticmethod
        def _coerce_int(value: object, default: int = 0) -> int:
            try:
                return int(value)
            except (TypeError, ValueError):
                return int(default)

        def _requested_chat_context(
            self,
            *,
            query: dict[str, list[str]],
            auth_ctx: VerifiedMiniAppAuth,
        ) -> tuple[int, str]:
            raw_values = query.get("chat_id") or []
            raw_chat_id = raw_values[0] if raw_values else auth_ctx.chat_id
            requested_chat_id = self._coerce_int(raw_chat_id, int(auth_ctx.chat_id))
            if requested_chat_id == 0:
                # Fallback to signed auth chat_id for backward compatibility.
                requested_chat_id = int(auth_ctx.chat_id)
            if requested_chat_id == 0:
                # Group direct-link launches may expose the target via `start_param`
                # while omitting `chat` from initData in some Telegram clients.
                requested_chat_id = _parse_start_param_chat_id(auth_ctx.start_param)
            if requested_chat_id == 0 and int(auth_ctx.user_id) > 0:
                # Some Telegram private launches may omit the `chat` field in initData.
                # In personal mode the workspace is bound to the user's private chat id,
                # which equals telegram user id.
                requested_chat_id = int(auth_ctx.user_id)
            chat_type = "private" if requested_chat_id > 0 else "supergroup"
            return requested_chat_id, chat_type

        def _resolve_workspace_or_error(
            self,
            *,
            db: Database,
            user_id: int,
            chat_id: int,
            chat_type: str,
            require_member: bool = True,
        ) -> dict[str, object] | None:
            if int(chat_id) == 0:
                self._send_json(
                    {
                        "error": "workspace chat_id is required",
                        "hint": "Open Mini App from the bot button in the target chat.",
                    },
                    status=400,
                )
                return None
            resolved = db.resolve_workspace(user_id=int(user_id), chat_id=int(chat_id), chat_type=chat_type)
            if resolved is None:
                self._send_json(
                    {
                        "error": "workspace not found for this chat",
                        "hint": "Run /start in this chat to create or bind a workspace.",
                    },
                    status=404,
                )
                return None
            if require_member and not bool(resolved.get("is_member")):
                self._send_json({"error": "user is not a member of this workspace"}, status=403)
                return None
            return resolved

        def _request_origin(self) -> str:
            return str(self.headers.get("Origin") or "").strip()

        def _is_origin_allowed(self, origin: str) -> bool:
            candidate = str(origin or "").strip()
            if not candidate:
                return True
            if candidate in allowed_exact_origins:
                return True
            return _is_allowed_localhost_origin(candidate)

        def _is_api_path(self, path: str | None = None) -> bool:
            raw_path = path if path is not None else urlparse(self.path).path
            return raw_path.startswith("/api/") or raw_path.startswith("/miniapp/api/")

        def _reject_invalid_origin_if_needed(self, *, path: str | None = None) -> bool:
            origin = self._request_origin()
            if not origin or self._is_origin_allowed(origin):
                return False
            if self._is_api_path(path):
                self._send_error_json(
                    "forbidden_origin",
                    "Origin is not allowed",
                    status=HTTPStatus.FORBIDDEN,
                )
                return True
            self.send_response(HTTPStatus.FORBIDDEN)
            self.send_header("Vary", "Origin")
            self.end_headers()
            return True

        def _set_common_headers(self) -> None:
            origin = self._request_origin()
            if origin and self._is_origin_allowed(origin):
                self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header(
                "Access-Control-Allow-Headers",
                "Content-Type, X-Telegram-Init-Data, Idempotency-Key",
            )

        def _send_error_json(self, error: str, message: str, *, status: int) -> None:
            self._send_json({"error": error, "message": message}, status=status)

        def _send_json_bytes(self, raw: bytes, *, status: int = 200) -> None:
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Cache-Control", "no-store")
            self._set_common_headers()
            self.end_headers()
            self.wfile.write(raw)

        def _maybe_store_idempotent_response(self, *, status: int, raw_json: str) -> None:
            ctx = getattr(self, "_idempotency_ctx", None)
            if not isinstance(ctx, dict) or ctx.get("stored"):
                return
            try:
                Database(database_path).finalize_api_idempotency_key(
                    idempotency_key=str(ctx.get("idempotency_key") or ""),
                    response_code=int(status),
                    response_body=raw_json,
                )
                ctx["stored"] = True
                self._idempotency_ctx = ctx
            except Exception:
                logger.exception(
                    "MiniApp failed to persist idempotency response: endpoint=%s user_id=%s",
                    ctx.get("endpoint"),
                    ctx.get("user_id"),
                )

        def _send_json(self, payload: dict[str, object], *, status: int = 200) -> None:
            raw_text = json.dumps(payload, ensure_ascii=False)
            self._maybe_store_idempotent_response(status=int(status), raw_json=raw_text)
            self._send_json_bytes(raw_text.encode("utf-8"), status=int(status))

        def _require_verified_auth(self) -> VerifiedMiniAppAuth | None:
            cached = getattr(self, "_verified_auth_ctx", None)
            if isinstance(cached, VerifiedMiniAppAuth):
                return cached
            init_data_header = str(self.headers.get("X-Telegram-Init-Data") or "").strip()
            try:
                fields = _verify_telegram_webapp_init_data(
                    init_data_raw=init_data_header,
                    bot_token=bot_token,
                )
                auth_ctx = _extract_verified_auth_context(fields)
            except ValueError as exc:
                reason = str(exc)
                if reason == "auth_date_expired":
                    self._send_error_json(
                        "auth_expired",
                        "Authentication failed",
                        status=HTTPStatus.UNAUTHORIZED,
                    )
                    return None
                self._send_error_json(
                    "invalid_auth",
                    "Authentication failed",
                    status=HTTPStatus.UNAUTHORIZED,
                )
                return None
            self._verified_auth_ctx = auth_ctx
            return auth_ctx

        def _enforce_rate_limit_for_path(self, *, path: str, user_id: int) -> bool:
            if path in _WRITE_RATE_LIMIT_PATHS:
                if not rate_limiter.allow(
                    bucket="write",
                    user_id=user_id,
                    limit=WRITE_RATE_LIMIT_PER_MINUTE,
                    window_seconds=60,
                ):
                    self._send_error_json(
                        "rate_limit_exceeded",
                        "Rate limit exceeded",
                        status=HTTPStatus.TOO_MANY_REQUESTS,
                    )
                    return False
            if path in _AI_RATE_LIMIT_PATHS:
                if not rate_limiter.allow(
                    bucket="ai",
                    user_id=user_id,
                    limit=AI_RATE_LIMIT_PER_HOUR,
                    window_seconds=3600,
                ):
                    self._send_error_json(
                        "rate_limit_exceeded",
                        "Rate limit exceeded",
                        status=HTTPStatus.TOO_MANY_REQUESTS,
                    )
                    return False
            return True

        def _begin_idempotent_request(
            self,
            *,
            endpoint: str,
            user_id: int,
            payload: dict[str, object],
        ) -> bool:
            raw_key = str(self.headers.get("Idempotency-Key") or "").strip()
            if not raw_key:
                self._send_error_json(
                    "missing_idempotency_key",
                    "Idempotency-Key header is required",
                    status=HTTPStatus.BAD_REQUEST,
                )
                return False
            try:
                normalized_key = str(uuid.UUID(raw_key))
            except (ValueError, AttributeError):
                self._send_error_json(
                    "invalid_idempotency_key",
                    "Idempotency-Key must be a valid UUID",
                    status=HTTPStatus.BAD_REQUEST,
                )
                return False

            request_hash = _canonical_json_hash(payload)
            try:
                inserted, record = Database(database_path).reserve_api_idempotency_key(
                    idempotency_key=normalized_key,
                    endpoint=endpoint,
                    user_id=int(user_id),
                    request_hash=request_hash,
                    ttl_hours=IDEMPOTENCY_TTL_HOURS,
                )
            except Exception:
                logger.exception(
                    "MiniApp failed to reserve idempotency key: endpoint=%s user_id=%s",
                    endpoint,
                    user_id,
                )
                self._send_json({"error": "internal_error"}, status=500)
                return False

            if inserted:
                self._idempotency_ctx = {
                    "idempotency_key": normalized_key,
                    "endpoint": endpoint,
                    "user_id": int(user_id),
                    "request_hash": request_hash,
                    "stored": False,
                }
                return True

            if str(record.get("endpoint") or "") != str(endpoint) or int(record.get("user_id") or 0) != int(user_id):
                self._send_json(
                    {
                        "error": "idempotency_conflict",
                        "message": "Idempotency key was already used for another request",
                    },
                    status=HTTPStatus.CONFLICT,
                )
                return False
            if str(record.get("request_hash") or "") != request_hash:
                self._send_json(
                    {
                        "error": "idempotency_conflict",
                        "message": "Idempotency key was reused with a different payload",
                    },
                    status=HTTPStatus.CONFLICT,
                )
                return False

            response_code = record.get("response_code")
            response_body = record.get("response_body")
            if isinstance(response_code, int) and isinstance(response_body, str) and response_body:
                self._send_json_bytes(response_body.encode("utf-8"), status=int(response_code))
                return False

            self._send_json(
                {
                    "error": "idempotency_in_progress",
                    "message": "Request with this Idempotency-Key is already being processed",
                },
                status=HTTPStatus.CONFLICT,
            )
            return False

        def _send_file(self, path: Path, content_type: str) -> None:
            if not path.exists() or not path.is_file():
                self.send_error(HTTPStatus.NOT_FOUND)
                return
            raw = path.read_bytes()
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Cache-Control", "no-store")
            self._set_common_headers()
            self.end_headers()
            self.wfile.write(raw)

        def do_OPTIONS(self) -> None:
            if self._reject_invalid_origin_if_needed():
                return
            self.send_response(HTTPStatus.NO_CONTENT)
            self._set_common_headers()
            self.end_headers()

        def do_HEAD(self) -> None:
            parsed = urlparse(self.path)
            if self._reject_invalid_origin_if_needed(path=parsed.path):
                return
            if parsed.path in {
                "/",
                "/miniapp",
                "/miniapp/",
                "/styles.css",
                "/miniapp/styles.css",
                "/miniapp/static/styles.css",
                "/utils/analytics.js",
                "/miniapp/utils/analytics.js",
                "/miniapp/static/utils/analytics.js",
                "/app.js",
                "/miniapp/app.js",
                "/miniapp/static/app.js",
                "/miniapp/api/overview",
                "/miniapp/api/transactions",
                "/miniapp/api/categories",
                "/miniapp/api/profile",
                "/miniapp/api/support",
                "/miniapp/api/review",
                "/miniapp/api/suggest_category",
                "/miniapp/api/create_transaction",
                "/miniapp/api/create_transfer",
                "/api/overview",
                "/api/transactions",
                "/api/categories",
                "/api/profile",
                "/api/support",
                "/api/review",
                "/api/suggest_category",
                "/api/create_transaction",
                "/api/create_transfer",
            }:
                self.send_response(HTTPStatus.OK)
                self._set_common_headers()
                self.end_headers()
                return
            self.send_error(HTTPStatus.NOT_FOUND)

        def do_GET(self) -> None:
            parsed = urlparse(self.path)
            if self._reject_invalid_origin_if_needed(path=parsed.path):
                return
            if parsed.path in {"/", "/miniapp", "/miniapp/"}:
                self._send_file(static_dir / "index.html", "text/html; charset=utf-8")
                return
            if parsed.path in {"/styles.css", "/miniapp/styles.css", "/miniapp/static/styles.css"}:
                self._send_file(static_dir / "styles.css", "text/css; charset=utf-8")
                return
            if parsed.path in {
                "/utils/analytics.js",
                "/miniapp/utils/analytics.js",
                "/miniapp/static/utils/analytics.js",
            }:
                self._send_file(static_dir / "utils" / "analytics.js", "application/javascript; charset=utf-8")
                return
            if parsed.path in {"/app.js", "/miniapp/app.js", "/miniapp/static/app.js"}:
                self._send_file(static_dir / "app.js", "application/javascript; charset=utf-8")
                return

            if parsed.path not in {
                "/miniapp/api/overview",
                "/miniapp/api/transactions",
                "/miniapp/api/categories",
                "/miniapp/api/profile",
                "/api/overview",
                "/api/transactions",
                "/api/categories",
                "/api/profile",
            }:
                self.send_error(HTTPStatus.NOT_FOUND)
                return

            auth_ctx = self._require_verified_auth()
            if auth_ctx is None:
                return
            query = parse_qs(parsed.query)
            current_user_id = int(auth_ctx.user_id)
            auth_chat_id = int(auth_ctx.chat_id)
            requested_chat_id, requested_chat_type = self._requested_chat_context(
                query=query,
                auth_ctx=auth_ctx,
            )
            db = Database(database_path)
            resolved_workspace = self._resolve_workspace_or_error(
                db=db,
                user_id=current_user_id,
                chat_id=requested_chat_id,
                chat_type=requested_chat_type,
                require_member=True,
            )
            if resolved_workspace is None:
                return
            workspace_id = int(resolved_workspace.get("workspace_id") or 0)
            user_lang = DEFAULT_LANGUAGE
            if current_user_id > 0:
                try:
                    user_lang = normalize_language(
                        db.get_effective_workspace_language(
                            workspace_id=workspace_id,
                            telegram_user_id=current_user_id,
                        )
                    )
                except Exception:
                    logger.exception(
                        "MiniApp failed to read workspace language for GET payload: user_id=%s workspace_id=%s",
                        current_user_id,
                        workspace_id,
                    )

            if parsed.path in {"/miniapp/api/categories", "/api/categories"}:
                self._send_json({"categories": _categories_payload(user_lang)})
                return

            if parsed.path in {"/miniapp/api/profile", "/api/profile"}:
                profile = db.get_user_profile(current_user_id)
                profile = dict(profile)
                profile["language"] = user_lang
                completed, total = db.calculate_profile_completion(current_user_id)
                latest_review = None
                try:
                    latest_review = db.get_latest_bot_review(current_user_id, workspace_id=workspace_id)
                except Exception:
                    logger.exception("MiniApp profile get latest review failed: user_id=%s", current_user_id)
                member_name = None
                if workspace_id:
                    try:
                        member_name = db.get_member_display_name(
                            requested_chat_id,
                            current_user_id,
                            workspace_id=workspace_id,
                        )
                    except Exception:
                        logger.exception(
                            "MiniApp profile get member display name failed: chat_id=%s workspace_id=%s user_id=%s",
                            requested_chat_id,
                            workspace_id,
                            current_user_id,
                        )
                self._send_json(
                    {
                        "ok": True,
                        "workspace": {
                            "id": workspace_id,
                            "type": str(resolved_workspace.get("type") or ""),
                            "chat_id": requested_chat_id,
                        },
                        "profile": profile,
                        "member_name": member_name,
                        "latest_review": latest_review,
                        "completion": {"completed": completed, "total": total},
                    }
                )
                return
            members = db.list_members(requested_chat_id, workspace_id=workspace_id)
            scope_options = _build_scope_options(members, lang=user_lang)
            scope_raw = ((query.get("scope") or ["all"])[0] or "all").strip()
            scope, scope_user_id = _resolve_scope(scope_raw, scope_options)
            period_mode, start_d, end_d = _parse_period(query)
            include_transfers = self._coerce_bool(((query.get("include_transfers") or [""])[0] or ""))

            if parsed.path in {"/miniapp/api/overview", "/api/overview"}:
                payload = _build_overview_payload(
                    db=db,
                    workspace_id=workspace_id,
                    scope=scope,
                    scope_user_id=scope_user_id,
                    period_mode=period_mode,
                    start_d=start_d,
                    end_d=end_d,
                    lang=user_lang,
                )
                payload["scope"] = {
                    "selected": scope,
                    "options": scope_options,
                }
                payload["workspace_type"] = str(resolved_workspace.get("type") or "")
                self._send_json(payload)
                return

            payload = _build_transactions_payload(
                db=db,
                workspace_id=workspace_id,
                scope=scope,
                scope_user_id=scope_user_id,
                start_d=start_d,
                end_d=end_d,
                lang=user_lang,
                include_transfers=include_transfers,
            )
            self._send_json(payload)

        def do_POST(self) -> None:
            parsed = urlparse(self.path)
            if self._reject_invalid_origin_if_needed(path=parsed.path):
                return
            if parsed.path not in {
                "/miniapp/api/suggest_category",
                "/miniapp/api/create_transaction",
                "/miniapp/api/create_transfer",
                "/miniapp/api/profile",
                "/miniapp/api/support",
                "/miniapp/api/review",
                "/api/suggest_category",
                "/api/create_transaction",
                "/api/create_transfer",
                "/api/profile",
                "/api/support",
                "/api/review",
            }:
                self.send_error(HTTPStatus.NOT_FOUND)
                return

            auth_ctx = self._require_verified_auth()
            if auth_ctx is None:
                return
            query = parse_qs(parsed.query)
            auth_chat_id = int(auth_ctx.chat_id)
            requested_chat_id, requested_chat_type = self._requested_chat_context(
                query=query,
                auth_ctx=auth_ctx,
            )
            current_user_id = int(auth_ctx.user_id)
            self._idempotency_ctx = None
            user_lang = DEFAULT_LANGUAGE
            try:
                user_lang = normalize_language(Database(database_path).get_user_profile(current_user_id).get("language"))
            except Exception:
                logger.exception("MiniApp failed to read user language for POST: user_id=%s", current_user_id)

            if parsed.path in {"/miniapp/api/profile", "/api/profile"}:
                payload = self._read_json_body()
                if payload is None:
                    self._send_json({"error": "invalid json body"}, status=400)
                    return

                db = Database(database_path)
                resolved_workspace = self._resolve_workspace_or_error(
                    db=db,
                    user_id=current_user_id,
                    chat_id=requested_chat_id,
                    chat_type=requested_chat_type,
                    require_member=True,
                )
                if resolved_workspace is None:
                    return
                workspace_id = int(resolved_workspace.get("workspace_id") or 0)
                try:
                    user_lang = normalize_language(
                        db.get_effective_workspace_language(
                            workspace_id=workspace_id,
                            telegram_user_id=current_user_id,
                        )
                    )
                except Exception:
                    logger.exception(
                        "MiniApp failed to read workspace language for profile POST: user_id=%s workspace_id=%s",
                        current_user_id,
                        workspace_id,
                    )
                def _update_profile_field_safe(field_name: str, field_value: str | None) -> None:
                    try:
                        db.update_user_profile_field(current_user_id, field_name, field_value)
                    except ValueError as exc:
                        if "User not found" not in str(exc):
                            raise
                        db.register_user(current_user_id, None, None, None)
                        db.update_user_profile_field(current_user_id, field_name, field_value)

                updated_fields: list[str] = []
                language_changed_to: str | None = None
                if "display_name" in payload:
                    display_name = str(payload.get("display_name") or "").strip()
                    if len(display_name) > 64:
                        self._send_json({"error": "display_name too long"}, status=400)
                        return
                    _update_profile_field_safe("display_name", display_name or None)
                    updated_fields.append("display_name")

                if "phone" in payload:
                    phone = str(payload.get("phone") or "").strip()
                    if len(phone) > 32:
                        self._send_json({"error": "phone too long"}, status=400)
                        return
                    _update_profile_field_safe("phone", phone or None)
                    updated_fields.append("phone")

                if "email" in payload:
                    email = str(payload.get("email") or "").strip()
                    if email and (len(email) > 120 or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email)):
                        self._send_json({"error": "invalid email"}, status=400)
                        return
                    _update_profile_field_safe("email", email or None)
                    updated_fields.append("email")

                if "birth_date" in payload:
                    birth_date = str(payload.get("birth_date") or "").strip()
                    if birth_date:
                        normalized_birth = birth_date
                        match_birth = re.fullmatch(r"(\d{2})[-/.](\d{2})[-/.](\d{4})", birth_date)
                        if match_birth:
                            dd, mm, yyyy = match_birth.groups()
                            normalized_birth = f"{yyyy}-{mm}-{dd}"
                        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", normalized_birth):
                            self._send_json({"error": "invalid birth_date"}, status=400)
                            return
                        try:
                            date.fromisoformat(normalized_birth)
                        except ValueError:
                            self._send_json({"error": "invalid birth_date"}, status=400)
                            return
                        birth_date = normalized_birth
                    _update_profile_field_safe("birth_date", birth_date or None)
                    updated_fields.append("birth_date")

                if "language" in payload:
                    language = str(payload.get("language") or "").strip().lower()
                    if language and language not in {"ru", "uz", "en"}:
                        self._send_json({"error": "invalid language"}, status=400)
                        return
                    if not language:
                        language = "ru"
                    try:
                        previous_workspace_lang = normalize_language(
                            db.get_effective_workspace_language(
                                workspace_id=workspace_id,
                                telegram_user_id=current_user_id,
                            )
                        )
                    except ValueError as exc:
                        previous_workspace_lang = normalize_language(user_lang)
                    try:
                        db.set_workspace_member_language(
                            workspace_id=workspace_id,
                            telegram_user_id=current_user_id,
                            language=language,
                        )
                    except ValueError:
                        # Membership should exist because `_resolve_workspace_or_error` passed.
                        logger.exception(
                            "MiniApp failed to save workspace language: workspace_id=%s user_id=%s",
                            workspace_id,
                            current_user_id,
                        )
                        self._send_json({"error": "workspace member not found"}, status=500)
                        return
                    updated_fields.append("language")
                    if previous_workspace_lang != normalize_language(language):
                        language_changed_to = normalize_language(language)
                        user_lang = language_changed_to

                if "currency" in payload:
                    currency = str(payload.get("currency") or "").strip().upper()
                    if currency and not re.fullmatch(r"[A-Z]{3,8}", currency):
                        self._send_json({"error": "invalid currency"}, status=400)
                        return
                    if not currency:
                        currency = "UZS"
                    _update_profile_field_safe("currency", currency)
                    updated_fields.append("currency")

                profile = db.get_user_profile(current_user_id)
                profile = dict(profile)
                profile["language"] = normalize_language(
                    db.get_effective_workspace_language(
                        workspace_id=workspace_id,
                        telegram_user_id=current_user_id,
                    )
                )
                completed, total = db.calculate_profile_completion(current_user_id)
                latest_review = db.get_latest_bot_review(current_user_id, workspace_id=workspace_id)
                member_name = None
                if workspace_id:
                    try:
                        member_name = db.get_member_display_name(
                            requested_chat_id,
                            current_user_id,
                            workspace_id=workspace_id,
                        )
                    except Exception:
                        logger.exception(
                            "MiniApp profile post get member display name failed: chat_id=%s workspace_id=%s user_id=%s",
                            requested_chat_id,
                            workspace_id,
                            current_user_id,
                        )
                self._send_json(
                    {
                        "ok": True,
                        "updated_fields": updated_fields,
                        "profile": profile,
                        "member_name": member_name,
                        "latest_review": latest_review,
                        "completion": {"completed": completed, "total": total},
                    }
                )
                if language_changed_to and requested_chat_id:
                    try:
                        ui_lang = normalize_language(language_changed_to)
                        if int(requested_chat_id) < 0:
                            _send_telegram_message(
                                bot_token=bot_token,
                                chat_id=int(requested_chat_id),
                                text={
                                    "ru": "Язык меню обновлён. Быстрые кнопки ниже переключены.",
                                    "uz": "Menyu tili yangilandi. Pastdagi tezkor tugmalar almashtirildi.",
                                    "en": "Menu language updated. Quick buttons below were refreshed.",
                                }.get(ui_lang, "Menu language updated."),
                                reply_markup=_group_main_reply_keyboard_payload(ui_lang),
                            )
                            app_inline_markup = _miniapp_open_inline_payload(
                                bot_token=bot_token,
                                chat_id=int(requested_chat_id),
                                lang=ui_lang,
                                app_short_name=str(getattr(settings, "telegram_miniapp_short_name", "") or ""),
                            )
                            if app_inline_markup:
                                _send_telegram_message(
                                    bot_token=bot_token,
                                    chat_id=int(requested_chat_id),
                                    text={
                                        "ru": "Кнопка Mini App обновлена на выбранный язык.",
                                        "uz": "Mini App tugmasi tanlangan tilga yangilandi.",
                                        "en": "Mini App button was refreshed to the selected language.",
                                    }.get(ui_lang, "Mini App button refreshed."),
                                    reply_markup=app_inline_markup,
                                )
                    except Exception:
                        logger.exception(
                            "MiniApp failed to send bot UI refresh after language change: chat_id=%s user_id=%s lang=%s",
                            requested_chat_id,
                            current_user_id,
                            language_changed_to,
                        )
                return

            if parsed.path in {"/miniapp/api/support", "/api/support"}:
                payload = self._read_json_body()
                if payload is None:
                    self._send_json({"error": "invalid json body"}, status=400)
                    return
                if not self._begin_idempotent_request(
                    endpoint=parsed.path,
                    user_id=current_user_id,
                    payload=payload,
                ):
                    return
                if not self._enforce_rate_limit_for_path(path=parsed.path, user_id=current_user_id):
                    return

                kind = str(payload.get("kind") or "message").strip().lower()
                if kind not in {"message", "bug"}:
                    self._send_json({"error": "kind must be message or bug"}, status=400)
                    return
                message_text = str(payload.get("message") or "").strip()
                if len(message_text) > 2000:
                    self._send_json({"error": "message too long"}, status=400)
                    return
                if support_chat_id == 0:
                    self._send_json({"error": "support chat is not configured"}, status=503)
                    return
                max_bug_photos = 3
                max_bug_photo_size = 4 * 1024 * 1024
                raw_photo_items = payload.get("photos")
                photo_items: list[dict[str, str]] = []
                if raw_photo_items is not None:
                    if not isinstance(raw_photo_items, list):
                        self._send_json({"error": "photos must be an array"}, status=400)
                        return
                    if len(raw_photo_items) > max_bug_photos:
                        self._send_json({"error": f"too many images (max {max_bug_photos})"}, status=400)
                        return
                    for raw_item in raw_photo_items:
                        if not isinstance(raw_item, dict):
                            self._send_json({"error": "invalid photo item"}, status=400)
                            return
                        photo_data_url = str(raw_item.get("photo_base64") or "").strip()
                        if not photo_data_url:
                            continue
                        photo_items.append(
                            {
                                "photo_base64": photo_data_url,
                                "photo_name": str(raw_item.get("photo_name") or "").strip() or "bug-report.jpg",
                                "photo_mime": str(raw_item.get("photo_mime") or "").strip().lower() or "image/jpeg",
                            }
                        )
                if not photo_items:
                    photo_data_url = str(payload.get("photo_base64") or "").strip()
                    if photo_data_url:
                        photo_items.append(
                            {
                                "photo_base64": photo_data_url,
                                "photo_name": str(payload.get("photo_name") or "").strip() or "bug-report.jpg",
                                "photo_mime": str(payload.get("photo_mime") or "").strip().lower() or "image/jpeg",
                            }
                        )
                if len(photo_items) > max_bug_photos:
                    self._send_json({"error": f"too many images (max {max_bug_photos})"}, status=400)
                    return
                has_photo = bool(photo_items)
                if kind != "bug" and has_photo:
                    self._send_json({"error": "photo is only supported for bug reports"}, status=400)
                    return
                if kind == "message" and not message_text:
                    self._send_json({"error": "message is required"}, status=400)
                    return
                decoded_photos: list[dict[str, object]] = []
                if has_photo:
                    for photo_item in photo_items:
                        try:
                            photo_bytes, decoded_mime = _decode_data_url_image(str(photo_item.get("photo_base64") or ""))
                        except ValueError as exc:
                            self._send_json({"error": str(exc)}, status=400)
                            return
                        if len(photo_bytes) > max_bug_photo_size:
                            self._send_json({"error": "image too large (max 4MB)"}, status=400)
                            return
                        mime_type = str(photo_item.get("photo_mime") or "").strip().lower() or "image/jpeg"
                        if decoded_mime:
                            mime_type = decoded_mime
                        decoded_photos.append(
                            {
                                "bytes": photo_bytes,
                                "name": str(photo_item.get("photo_name") or "bug-report.jpg"),
                                "mime": mime_type,
                            }
                        )
                if kind == "bug" and not message_text:
                    message_text = "Фото без описания" if has_photo else ""
                if kind == "bug" and not message_text:
                    self._send_json({"error": "message or photo is required"}, status=400)
                    return

                db = Database(database_path)
                resolved_workspace = self._resolve_workspace_or_error(
                    db=db,
                    user_id=current_user_id,
                    chat_id=requested_chat_id,
                    chat_type=requested_chat_type,
                    require_member=True,
                )
                if resolved_workspace is None:
                    return
                workspace_id = int(resolved_workspace.get("workspace_id") or 0)
                profile = db.get_user_profile(current_user_id)
                member_name = None
                if workspace_id:
                    try:
                        member_name = db.get_member_display_name(
                            requested_chat_id,
                            current_user_id,
                            workspace_id=workspace_id,
                        )
                    except Exception:
                        logger.exception(
                            "MiniApp support get member display name failed: chat_id=%s workspace_id=%s user_id=%s",
                            requested_chat_id,
                            workspace_id,
                            current_user_id,
                        )
                display_name = str(profile.get("display_name") or "").strip() or (member_name or "")
                if kind == "bug":
                    text = (
                        "#error\n"
                        "🐞 Новый баг-репорт (MiniApp)\n\n"
                        f"👤 Имя: {display_name or '-'}\n"
                        f"🆔 ID: {current_user_id}\n"
                        f"🏠 Chat ID: {requested_chat_id or '-'}\n"
                        f"🧩 Workspace ID: {workspace_id or '-'}\n"
                        "💬 Описание:\n"
                        f"{message_text}"
                    )
                else:
                    text = (
                        "#dev\n"
                        "📩 Новое сообщение от пользователя (MiniApp)\n\n"
                        f"👤 Имя: {display_name or '-'}\n"
                        f"🆔 ID: {current_user_id}\n"
                        f"🏠 Chat ID: {requested_chat_id or '-'}\n"
                        f"🧩 Workspace ID: {workspace_id or '-'}\n"
                        "💬 Текст:\n"
                        f"{message_text}"
                    )
                try:
                    photo_message_ids: list[int] = []
                    if kind == "bug" and decoded_photos:
                        if len(decoded_photos) == 1:
                            first_photo = decoded_photos[0]
                            telegram_message_id = _send_telegram_photo(
                                bot_token=bot_token,
                                chat_id=support_chat_id,
                                photo_bytes=bytes(first_photo["bytes"]),
                                filename=str(first_photo["name"]),
                                caption=text,
                                mime_type=str(first_photo["mime"]),
                            )
                            photo_message_ids.append(telegram_message_id)
                        else:
                            telegram_message_id = _send_telegram_message(
                                bot_token=bot_token,
                                chat_id=support_chat_id,
                                text=text,
                            )
                            for index, photo in enumerate(decoded_photos, start=1):
                                photo_caption = f"📎 Скриншот {index}/{len(decoded_photos)}"
                                photo_message_ids.append(
                                    _send_telegram_photo(
                                        bot_token=bot_token,
                                        chat_id=support_chat_id,
                                        photo_bytes=bytes(photo["bytes"]),
                                        filename=str(photo["name"]),
                                        caption=photo_caption,
                                        mime_type=str(photo["mime"]),
                                    )
                                )
                    else:
                        telegram_message_id = _send_telegram_message(
                            bot_token=bot_token,
                            chat_id=support_chat_id,
                            text=text,
                        )
                except Exception as exc:
                    logger.exception(
                        "MiniApp support send failed: user_id=%s chat_id=%s kind=%s",
                        current_user_id,
                        requested_chat_id,
                        kind,
                    )
                    self._send_json({"error": str(exc)}, status=502)
                    return
                response_payload: dict[str, object] = {"ok": True, "telegram_message_id": telegram_message_id}
                if kind == "bug" and has_photo:
                    response_payload["telegram_photo_message_ids"] = photo_message_ids
                self._send_json(response_payload)
                return

            if parsed.path in {"/miniapp/api/review", "/api/review"}:
                payload = self._read_json_body()
                if payload is None:
                    self._send_json({"error": "invalid json body"}, status=400)
                    return
                if not self._begin_idempotent_request(
                    endpoint=parsed.path,
                    user_id=current_user_id,
                    payload=payload,
                ):
                    return
                if not self._enforce_rate_limit_for_path(path=parsed.path, user_id=current_user_id):
                    return

                try:
                    rating = int(payload.get("rating") or 0)
                except (TypeError, ValueError):
                    rating = 0
                comment = str(payload.get("comment") or "").strip()
                if rating < 1 or rating > 5:
                    self._send_json({"error": "rating must be 1..5"}, status=400)
                    return
                if len(comment) > 1000:
                    self._send_json({"error": "comment too long"}, status=400)
                    return

                db = Database(database_path)
                resolved_workspace = self._resolve_workspace_or_error(
                    db=db,
                    user_id=current_user_id,
                    chat_id=requested_chat_id,
                    chat_type=requested_chat_type,
                    require_member=True,
                )
                if resolved_workspace is None:
                    return
                workspace_id = int(resolved_workspace.get("workspace_id") or 0)
                previous_review = None
                try:
                    previous_review = db.get_latest_bot_review(current_user_id, workspace_id=workspace_id)
                except Exception:
                    logger.exception("MiniApp review get latest failed: user_id=%s", current_user_id)
                effective_chat_id = requested_chat_id

                try:
                    review = db.add_bot_review(
                        workspace_id=workspace_id,
                        chat_id=effective_chat_id,
                        telegram_user_id=current_user_id,
                        rating=rating,
                        comment=comment or None,
                    )
                except Exception:
                    logger.exception(
                        "MiniApp review save failed: user_id=%s chat_id=%s workspace_id=%s",
                        current_user_id,
                        requested_chat_id,
                        workspace_id,
                    )
                    self._send_json({"error": "failed to save review"}, status=500)
                    return

                if support_chat_id != 0:
                    try:
                        review_text = (
                            "⭐ Отзыв о боте (MiniApp)\n"
                            f"👤 user_id: {current_user_id}\n"
                            f"🏠 chat_id: {effective_chat_id}\n"
                            f"🧩 workspace_id: {workspace_id}\n"
                            + (
                                f"↔ Предыдущая оценка: {int(previous_review.get('rating') or 0)}/5\n"
                                if isinstance(previous_review, dict) and previous_review.get("rating")
                                else ""
                            )
                            + f"⭐ Оценка: {rating}/5\n"
                            + f"💬 Комментарий: {comment or '(без комментария)'}"
                        )
                        _send_telegram_message(
                            bot_token=bot_token,
                            chat_id=support_chat_id,
                            text=review_text,
                        )
                    except Exception:
                        logger.exception(
                            "MiniApp review admin notification failed: user_id=%s chat_id=%s workspace_id=%s",
                            current_user_id,
                            effective_chat_id,
                            workspace_id,
                        )

                self._send_json({"ok": True, "review": review})
                return

            payload = self._read_json_body()
            if payload is None:
                self._send_json({"error": "invalid json body"}, status=400)
                return

            requested_user_id = int(payload.get("telegram_user_id") or current_user_id)
            if requested_user_id != current_user_id:
                self._send_json({"error": "cannot create transaction for another user"}, status=403)
                return

            if parsed.path in _IDEMPOTENT_WRITE_PATHS:
                if not self._begin_idempotent_request(
                    endpoint=parsed.path,
                    user_id=current_user_id,
                    payload=payload,
                ):
                    return
                if not self._enforce_rate_limit_for_path(path=parsed.path, user_id=current_user_id):
                    return

            db = Database(database_path)
            resolved_workspace = self._resolve_workspace_or_error(
                db=db,
                user_id=current_user_id,
                chat_id=requested_chat_id,
                chat_type=requested_chat_type,
                require_member=True,
            )
            if resolved_workspace is None:
                return
            workspace_id = int(resolved_workspace.get("workspace_id") or 0)

            description = str(payload.get("description") or "").strip()
            amount_raw = payload.get("amount")
            try:
                amount = float(amount_raw)
            except (TypeError, ValueError):
                amount = 0.0

            if parsed.path in {"/miniapp/api/suggest_category", "/api/suggest_category"}:
                kind = str(payload.get("kind") or "expense").strip().lower()
                if kind not in {"income", "expense"}:
                    self._send_json({"error": "kind must be income or expense"}, status=400)
                    return
                if not description:
                    self._send_json({"error": "description is required"}, status=400)
                    return
                if amount <= 0:
                    amount = 1.0
                is_family = self._coerce_bool(payload.get("is_family")) if "is_family" in payload else False
                if not self._enforce_rate_limit_for_path(path=parsed.path, user_id=current_user_id):
                    return
                try:
                    category_key, inferred_is_family = _infer_category_and_family(
                        ai_service=ai_service,
                        kind=kind,
                        amount=amount,
                        currency=str(payload.get("currency") or default_currency or "UZS"),
                        description=description,
                    )
                except Exception:
                    logger.exception("MiniApp category inference failed")
                    category_key = DEFAULT_INCOME_CATEGORY if kind == "income" else DEFAULT_EXPENSE_CATEGORY
                    inferred_is_family = False
                category_key = _normalize_category_key(category_key, kind)
                self._send_json(
                    {
                        "category": {
                            "key": category_key,
                            "label": _ru_category_label(category_key, kind),
                        },
                        "is_family": bool(inferred_is_family),
                    }
                )
                return

            date_time_raw = str(payload.get("datetime_local") or "").strip()
            local_dt = _parse_local_datetime_input(date_time_raw)
            if local_dt is None:
                local_dt = datetime.now(_local_tzinfo())

            now_local = datetime.now(_local_tzinfo())
            if local_dt > now_local:
                self._send_json({"error": "future datetime is not allowed"}, status=400)
                return

            currency = str(payload.get("currency") or default_currency or "UZS").strip().upper() or "UZS"
            member_name = (
                db.get_member_display_name(
                    requested_chat_id,
                    current_user_id,
                    workspace_id=workspace_id,
                )
                or f"User {current_user_id}"
            )

            if parsed.path in {"/miniapp/api/create_transfer", "/api/create_transfer"}:
                if amount <= 0:
                    self._send_json({"error": "amount must be > 0"}, status=400)
                    return

                try:
                    recipient_user_id = int(payload.get("recipient_user_id") or 0)
                except (TypeError, ValueError):
                    recipient_user_id = 0

                if recipient_user_id <= 0:
                    self._send_json({"error": "recipient_user_id is required"}, status=400)
                    return
                if recipient_user_id == current_user_id:
                    self._send_json({"error": "cannot transfer to yourself"}, status=400)
                    return

                members = db.list_members(requested_chat_id, workspace_id=workspace_id)
                member_ids = {int(item.get("telegram_user_id") or 0) for item in members}
                if recipient_user_id not in member_ids:
                    self._send_json({"error": "recipient is not a member of this family group"}, status=400)
                    return

                recipient_name = (
                    db.get_member_display_name(
                        requested_chat_id,
                        recipient_user_id,
                        workspace_id=workspace_id,
                    )
                    or f"User {recipient_user_id}"
                )
                note = description
                source_text = note or "Перевод внутри семьи"
                sender_desc = f"Перевод {recipient_name}" + (f" ({note})" if note else "")
                recipient_desc = f"Перевод от {member_name}" + (f" ({note})" if note else "")

                transfer_out = FinanceTransaction(
                    workspace_id=workspace_id,
                    chat_id=requested_chat_id,
                    telegram_user_id=current_user_id,
                    member_name=member_name,
                    kind="expense",
                    amount=amount,
                    currency=currency,
                    category=TRANSFER_OUT_CATEGORY,
                    description=sender_desc,
                    is_family=False,
                    source_type="text",
                    original_text=source_text,
                    message_id=0,
                    transcript=None,
                )
                transfer_in = FinanceTransaction(
                    workspace_id=workspace_id,
                    chat_id=requested_chat_id,
                    telegram_user_id=recipient_user_id,
                    member_name=recipient_name,
                    kind="income",
                    amount=amount,
                    currency=currency,
                    category=TRANSFER_IN_CATEGORY,
                    description=recipient_desc,
                    is_family=False,
                    source_type="text",
                    original_text=source_text,
                    message_id=0,
                    transcript=None,
                )

                tx_out_id = db.add_transaction_at(transfer_out, created_at_utc=_local_dt_to_utc_naive(local_dt))
                tx_in_id = db.add_transaction_at(transfer_in, created_at_utc=_local_dt_to_utc_naive(local_dt))

                transfer_message = _build_saved_transfer_message(
                    amount=amount,
                    currency=currency,
                    sender_name=member_name,
                    recipient_name=recipient_name,
                    local_dt=local_dt,
                    description=note,
                    lang=user_lang,
                )
                try:
                    telegram_message_id = _send_telegram_message(
                        bot_token=bot_token,
                        chat_id=requested_chat_id,
                        text=transfer_message,
                    )
                except Exception as exc:
                    logger.exception(
                        "MiniApp failed to send transfer message: chat_id=%s sender=%s recipient=%s tx_out=%s tx_in=%s",
                        requested_chat_id,
                        current_user_id,
                        recipient_user_id,
                        tx_out_id,
                        tx_in_id,
                    )
                    db.delete_transaction(chat_id=requested_chat_id, transaction_id=tx_out_id, workspace_id=workspace_id)
                    db.delete_transaction(chat_id=requested_chat_id, transaction_id=tx_in_id, workspace_id=workspace_id)
                    self._send_json(
                        {
                            "error": (
                                "Не удалось отправить подтверждение перевода в семейную группу. "
                                "Перевод не сохранён, попробуйте ещё раз."
                            ),
                            "details": str(exc),
                        },
                        status=502,
                    )
                    return

                self._send_json(
                    {
                        "ok": True,
                        "transfer_out_id": tx_out_id,
                        "transfer_in_id": tx_in_id,
                        "telegram_message_id": telegram_message_id,
                        "message": transfer_message,
                    }
                )
                if tx_out_id:
                    try:
                        db.mark_user_activated(current_user_id)
                    except Exception:
                        logger.exception(
                            "MiniApp failed to mark sender as activated after transfer: user_id=%s tx_out=%s",
                            current_user_id,
                            tx_out_id,
                        )
                return

            kind = str(payload.get("kind") or "expense").strip().lower()
            if kind not in {"income", "expense"}:
                self._send_json({"error": "kind must be income or expense"}, status=400)
                return

            if amount <= 0:
                self._send_json({"error": "amount must be > 0"}, status=400)
                return
            if not description:
                self._send_json({"error": "description is required"}, status=400)
                return

            is_family_from_payload = "is_family" in payload
            is_family = self._coerce_bool(payload.get("is_family")) if is_family_from_payload else False
            category_key_raw = str(payload.get("category") or "").strip()
            inferred_category, inferred_is_family = _infer_category_and_family(
                ai_service=ai_service,
                kind=kind,
                amount=amount,
                currency=currency,
                description=description,
            )
            if category_key_raw:
                category_key = _normalize_category_key(category_key_raw, kind)
            else:
                category_key = inferred_category

            if not is_family_from_payload:
                is_family = inferred_is_family

            tx = FinanceTransaction(
                workspace_id=workspace_id,
                chat_id=requested_chat_id,
                telegram_user_id=current_user_id,
                member_name=member_name,
                kind=kind,
                amount=amount,
                currency=currency,
                category=category_key,
                description=description,
                is_family=is_family,
                source_type="text",
                original_text=description,
                message_id=0,
                transcript=None,
            )
            tx_id = db.add_transaction_at(tx, created_at_utc=_local_dt_to_utc_naive(local_dt))

            result_message = _build_saved_transaction_message(
                kind=kind,
                member_name=member_name,
                amount=amount,
                currency=currency,
                category=category_key,
                description=description,
                is_family=is_family,
                local_dt=local_dt,
                lang=user_lang,
            )
            try:
                telegram_message_id = _send_telegram_message(
                    bot_token=bot_token,
                    chat_id=requested_chat_id,
                    text=result_message,
                )
            except Exception as exc:
                logger.exception(
                    "MiniApp failed to send transaction message: chat_id=%s user_id=%s tx_id=%s",
                    requested_chat_id,
                    current_user_id,
                    tx_id,
                )
                rollback_ok = db.delete_transaction(
                    chat_id=requested_chat_id,
                    transaction_id=tx_id,
                    workspace_id=workspace_id,
                )
                if not rollback_ok:
                    logger.error(
                        "MiniApp rollback failed after Telegram send error: chat_id=%s tx_id=%s",
                        requested_chat_id,
                        tx_id,
                    )
                self._send_json(
                    {
                        "error": (
                            "Не удалось отправить подтверждение в семейную группу. "
                            "Транзакция не сохранена, попробуйте ещё раз."
                        ),
                        "details": str(exc),
                    },
                    status=502,
                )
                return

            self._send_json(
                {
                    "ok": True,
                    "transaction_id": tx_id,
                    "telegram_message_id": telegram_message_id,
                    "category": {
                        "key": category_key,
                        "label": _ru_category_label(category_key, kind),
                    },
                    "message": result_message,
                }
            )
            if tx_id:
                try:
                    db.mark_user_activated(current_user_id)
                except Exception:
                    logger.exception(
                        "MiniApp failed to mark user as activated after transaction: user_id=%s tx_id=%s",
                        current_user_id,
                        tx_id,
                    )

        def log_message(self, format: str, *args) -> None:
            logger.info("MiniApp %s - %s", self.address_string(), format % args)

    return MiniAppHandler


def start_miniapp_server(settings: Settings) -> RunningMiniAppServer | None:
    static_dir = Path(__file__).resolve().parent / "miniapp_web"
    if not static_dir.exists():
        logger.warning("Mini App static directory is missing: %s", static_dir)
        return None

    ai_service = AIService(
        api_key=settings.openai_api_key,
        extraction_model=settings.openai_model,
        transcribe_model=settings.openai_transcribe_model,
        default_currency=settings.default_currency,
    )

    handler_cls = _build_handler(
        static_dir=static_dir,
        database_path=settings.database_path,
        ai_service=ai_service,
        bot_token=settings.telegram_bot_token,
        default_currency=settings.default_currency,
        support_chat_id=int(getattr(settings, "admin_chat_id", 0) or getattr(settings, "admin_telegram_id", 0) or 0),
        miniapp_base_url=settings.miniapp_base_url,
    )
    try:
        httpd = ThreadingHTTPServer((settings.miniapp_bind_host, settings.miniapp_port), handler_cls)
    except OSError:
        logger.exception(
            "Failed to start Mini App server on %s:%s",
            settings.miniapp_bind_host,
            settings.miniapp_port,
        )
        return None

    thread = threading.Thread(
        target=httpd.serve_forever,
        name="miniapp-server",
        daemon=True,
    )
    thread.start()
    logger.info(
        "Mini App server started: http://%s:%s/miniapp",
        settings.miniapp_bind_host,
        settings.miniapp_port,
    )
    return RunningMiniAppServer(httpd=httpd, thread=thread)


def stop_miniapp_server(server: RunningMiniAppServer | None) -> None:
    if server is None:
        return
    try:
        server.httpd.shutdown()
        server.httpd.server_close()
    except Exception:
        logger.exception("Failed to stop Mini App server cleanly")
