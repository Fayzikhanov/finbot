from __future__ import annotations

import asyncio
import base64
import json
import logging
import re
from dataclasses import dataclass

import httpx


MIN_CONFIDENCE = 0.35
logger = logging.getLogger(__name__)

INCOME_CATEGORY_KEYS = {
    "salary",
    "bonus",
    "windfall",
    "profit",
    "cashback",
    "gift",
    "income_other",
}

EXPENSE_CATEGORY_KEYS = {
    "home_rent",
    "home_mortgage",
    "home_utilities",
    "home_electricity",
    "home_gas",
    "home_water",
    "home_heating",
    "home_internet",
    "home_tv",
    "home_repair",
    "home_furniture",
    "home_appliances",
    "home_goods",
    "groceries_products",
    "groceries_household",
    "groceries_water",
    "groceries_delivery",
    "cafe_cafe",
    "cafe_restaurant",
    "cafe_fastfood",
    "cafe_coffee",
    "cafe_streetfood",
    "cafe_delivery",
    "cafe_bar",
    "cafe_hookah",
    "transport_fuel",
    "transport_gas",
    "transport_taxi",
    "transport_metro",
    "transport_bus",
    "transport_parking",
    "transport_fine",
    "transport_repair",
    "transport_insurance",
    "work_subscriptions",
    "work_software",
    "work_ads",
    "work_hosting",
    "work_domain",
    "work_courses",
    "work_taxes",
    "work_tools",
    "education_school",
    "education_kindergarten",
    "education_tutor",
    "education_online_courses",
    "education_books",
    "health_pharmacy",
    "health_doctor",
    "health_tests",
    "health_dentist",
    "health_gym",
    "health_supplements",
    "fashion_clothes",
    "fashion_shoes",
    "fashion_cosmetics",
    "fashion_hairdresser",
    "fashion_manicure",
    "fashion_accessories",
    "kids_toys",
    "kids_clothes",
    "kids_diapers",
    "kids_food",
    "kids_entertainment",
    "leisure_subscriptions",
    "leisure_games",
    "leisure_cinema",
    "leisure_travel",
    "leisure_hotel",
    "leisure_flights",
    "leisure_gifts",
    "leisure_holidays",
    "finance_credit",
    "finance_installment",
    "finance_interest",
    "finance_bank_fees",
    "finance_transfers",
    "finance_investments",
    "finance_savings",
    "finance_debt_given",
    "finance_debt_received",
    "pets_food",
    "pets_vet",
    "expense_other",
}

FAMILY_EXPENSE_CATEGORY_PREFIXES = (
    "home_",
    "groceries_",
    "kids_",
)

FAMILY_EXPENSE_CATEGORY_KEYS = {
    "pets_food",
    "pets_vet",
}

PLACE_CATEGORY_HINTS: tuple[tuple[str, str], ...] = (
    ("evos", "cafe_fastfood"),
    ("эвос", "cafe_fastfood"),
    ("kfc", "cafe_fastfood"),
    ("oqtepa lavash", "cafe_fastfood"),
    ("oqtepa", "cafe_fastfood"),
    ("октепа лаваш", "cafe_fastfood"),
    ("oktepa lavash", "cafe_fastfood"),
    ("les ailes", "cafe_fastfood"),
    ("лес эйлес", "cafe_fastfood"),
    ("feed up", "cafe_fastfood"),
    ("фид ап", "cafe_fastfood"),
    ("bellissimo", "cafe_fastfood"),
    ("белиссимо", "cafe_fastfood"),
    ("safia", "cafe_cafe"),
    ("сафия", "cafe_cafe"),
    ("chaykof", "cafe_coffee"),
    ("чайкоф", "cafe_coffee"),
    ("costa coffee", "cafe_coffee"),
    ("korzinka", "groceries_products"),
    ("корзинка", "groceries_products"),
    ("makro", "groceries_products"),
    ("макро", "groceries_products"),
    ("havas", "groceries_products"),
    ("хавас", "groceries_products"),
    ("carrefour", "groceries_products"),
    ("карфур", "groceries_products"),
    ("bi1", "groceries_products"),
    ("би1", "groceries_products"),
)

ALLOWED_CATEGORIES_FOR_PROMPT = (
    "Expense categories: "
    "home_rent, home_mortgage, home_utilities, home_electricity, home_gas, "
    "home_water, home_heating, home_internet, home_tv, home_repair, home_furniture, "
    "home_appliances, home_goods, groceries_products, groceries_household, "
    "groceries_water, groceries_delivery, cafe_cafe, cafe_restaurant, cafe_fastfood, "
    "cafe_coffee, cafe_streetfood, cafe_delivery, cafe_bar, cafe_hookah, transport_fuel, "
    "transport_gas, transport_taxi, transport_metro, transport_bus, transport_parking, "
    "transport_fine, transport_repair, transport_insurance, work_subscriptions, "
    "work_software, work_ads, work_hosting, work_domain, work_courses, work_taxes, "
    "work_tools, education_school, education_kindergarten, education_tutor, "
    "education_online_courses, education_books, health_pharmacy, health_doctor, "
    "health_tests, health_dentist, health_gym, health_supplements, fashion_clothes, "
    "fashion_shoes, fashion_cosmetics, fashion_hairdresser, fashion_manicure, "
    "fashion_accessories, kids_toys, kids_clothes, kids_diapers, kids_food, "
    "kids_entertainment, leisure_subscriptions, leisure_games, leisure_cinema, "
    "leisure_travel, leisure_hotel, leisure_flights, leisure_gifts, leisure_holidays, "
    "finance_credit, finance_installment, finance_interest, finance_bank_fees, "
    "finance_transfers, finance_investments, finance_savings, finance_debt_given, "
    "finance_debt_received, pets_food, pets_vet, expense_other. "
    "Income categories: salary, bonus, windfall, profit, cashback, gift, income_other."
)


@dataclass(frozen=True)
class ParsedEvent:
    kind: str
    amount: float
    currency: str
    category: str
    description: str
    is_family: bool
    confidence: float


class AIService:
    def __init__(
        self,
        api_key: str,
        extraction_model: str,
        transcribe_model: str,
        default_currency: str,
    ) -> None:
        self.api_key = api_key
        self.extraction_model = extraction_model
        self.transcribe_model = transcribe_model
        self.default_currency = default_currency
        self._openai_lock = asyncio.Lock()

    async def transcribe_voice(self, audio_path: str) -> str:
        headers = {"Authorization": f"Bearer {self.api_key}"}
        with open(audio_path, "rb") as audio_file:
            files = {
                "file": (
                    "voice.ogg",
                    audio_file,
                    "audio/ogg",
                )
            }
            data = {"model": self.transcribe_model}

            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    "https://api.openai.com/v1/audio/transcriptions",
                    headers=headers,
                    data=data,
                    files=files,
                )

        response.raise_for_status()
        payload = response.json()
        text = str(payload.get("text", "") or "")
        return text.strip()

    async def parse_finance_events(self, message_text: str) -> list[ParsedEvent]:
        if not message_text.strip():
            return []

        last_exc: Exception | None = None
        for attempt in range(3):
            try:
                events = await self._parse_finance_events_with_openai(message_text)
                if events:
                    return events
                # Safety net: if model returned empty, try deterministic parser.
                return self._parse_finance_events_with_rules(message_text)
            except Exception as exc:
                last_exc = exc
                is_rate_limited = self._is_rate_limited_error(exc)
                if attempt < 2 and is_rate_limited:
                    await asyncio.sleep(
                        self._rate_limit_retry_seconds(
                            exc,
                            default=0.8 * (attempt + 1),
                        )
                    )
                    continue
                break

        if last_exc is not None:
            logger.warning(
                "OpenAI parsing failed, falling back to rule parser: %s", last_exc
            )
        return self._parse_finance_events_with_rules(message_text)

    async def parse_finance_events_from_image(
        self,
        image_bytes: bytes,
        *,
        mime_type: str = "image/jpeg",
        caption_text: str = "",
    ) -> list[ParsedEvent]:
        if not image_bytes:
            return []

        safe_mime_type = (mime_type or "image/jpeg").strip().lower()
        if "/" not in safe_mime_type:
            safe_mime_type = "image/jpeg"

        encoded = base64.b64encode(image_bytes).decode("ascii")
        data_url = f"data:{safe_mime_type};base64,{encoded}"

        user_prompt = (
            "Extract financial events from this image/screenshot/receipt.\n"
            "Use visible text from image and optional caption as context.\n"
            "If there are no explicit financial operations with amount, return {'events': []}.\n\n"
            f"Caption/context: {caption_text or '-'}\n\n"
            f"{self._finance_rules_prompt(message_text=caption_text)}"
        )
        body = {
            "model": self.extraction_model,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": self._finance_extraction_system_prompt()},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": user_prompt},
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ],
                },
            ],
        }

        payload = await self._request_chat_completions(body)
        return self._normalize_events_from_payload(payload, source_text=caption_text)

    @staticmethod
    def clarification_message() -> str:
        return (
            "Не до конца понял запись. Уточните, это доход или расход и какая сумма."
        )

    @staticmethod
    def ai_temporarily_unavailable_message() -> str:
        return (
            "Сейчас ИИ временно недоступен (лимит запросов). "
            "Чтобы не записать категорию с ошибкой, давай попробуем через 20-30 секунд.\n"
            "Лучший вариант записи: «Купил/Оплатил что-то на X сум»."
        )

    @staticmethod
    def _is_rate_limited_error(exc: Exception) -> bool:
        return isinstance(exc, httpx.HTTPStatusError) and (
            getattr(exc.response, "status_code", None) == 429
        )

    @staticmethod
    def _is_uncertain_fallback_event(event: ParsedEvent) -> bool:
        # In fallback mode these categories are often guesses.
        return event.category in {"expense_other", "income_other"}

    @staticmethod
    def guess_place_category(text: str, kind: str = "expense") -> str | None:
        if kind != "expense":
            return None
        text_norm = " ".join((text or "").lower().replace("ё", "е").split())
        if not text_norm:
            return None
        for token, category in PLACE_CATEGORY_HINTS:
            token_norm = " ".join(token.lower().replace("ё", "е").split())
            if not token_norm:
                continue
            if re.search(rf"(?<!\w){re.escape(token_norm)}(?!\w)", text_norm):
                return category
        return None

    @staticmethod
    def _rate_limit_retry_seconds(exc: Exception, default: float = 1.0) -> float:
        if not isinstance(exc, httpx.HTTPStatusError):
            return default
        response = getattr(exc, "response", None)
        if response is None:
            return default
        if getattr(response, "status_code", None) != 429:
            return default

        retry_after_raw = (
            response.headers.get("retry-after")
            or response.headers.get("x-ratelimit-reset-seconds")
            or ""
        )
        retry_after = default
        if retry_after_raw:
            try:
                retry_after = float(retry_after_raw)
            except ValueError:
                retry_after = default
        return max(0.8, min(12.0, retry_after))

    async def parse_finance_with_clarification(
        self, message_text: str
    ) -> tuple[list[ParsedEvent], str | None]:
        raw = message_text.strip()
        if not raw:
            return [], None

        if self._looks_like_report_dump(raw):
            return [], None

        text_l = raw.lower()
        has_math = self._has_arithmetic_expression(raw)
        is_question_like = self._is_question_like(raw, text_l)
        is_clear_finance = self._is_clear_finance_phrasing(text_l)

        if has_math:
            return [], self.clarification_message()
        if is_question_like and not is_clear_finance:
            return [], self.clarification_message()

        openai_error: Exception | None = None
        openai_events: list[ParsedEvent] = []
        for attempt in range(3):
            try:
                openai_events = await self._parse_finance_events_with_openai(raw)
                break
            except Exception as exc:
                openai_error = exc
                if attempt < 2 and self._is_rate_limited_error(exc):
                    await asyncio.sleep(
                        self._rate_limit_retry_seconds(
                            exc,
                            default=0.8 * (attempt + 1),
                        )
                    )
                    continue
                break

        if openai_events:
            return openai_events, None

        fallback_events = self._parse_finance_events_with_rules(raw)
        if fallback_events:
            # When OpenAI is rate-limited, keep working from local rules, but avoid
            # persisting vague "other" categories for unclear free-form text.
            if openai_error is not None and self._is_rate_limited_error(openai_error):
                if all(self._is_uncertain_fallback_event(event) for event in fallback_events):
                    return [], self.clarification_message()
            return fallback_events, None

        if self._has_finance_signal(text_l):
            return [], self.clarification_message()
        return [], None

    async def infer_category(
        self,
        *,
        kind: str,
        description: str,
        amount: float,
        currency: str,
        is_family: bool,
    ) -> str:
        verb = "получил" if kind == "income" else "потратил"
        family_hint = "для семьи" if is_family and kind == "expense" else ""
        probe_text = f"{verb} {int(round(amount))} {currency} {description} {family_hint}".strip()

        try:
            events = await self.parse_finance_events(probe_text)
            if events:
                for event in events:
                    if event.kind == kind:
                        return event.category
                return events[0].category
        except Exception:
            logger.exception("Failed to infer category from AI parser")

        return self._detect_category(description.lower(), kind)

    async def _parse_finance_events_with_openai(
        self, message_text: str
    ) -> list[ParsedEvent]:
        body = {
            "model": self.extraction_model,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": self._finance_extraction_system_prompt()},
                {"role": "user", "content": self._finance_rules_prompt(message_text)},
            ],
        }
        payload = await self._request_chat_completions(body)
        return self._normalize_events_from_payload(payload, source_text=message_text)

    def _finance_extraction_system_prompt(self) -> str:
        return (
            "You extract financial events from user messages. "
            "Return ONLY valid JSON object with key 'events'. "
            "Each event must include: "
            "kind ('income' or 'expense'), amount (number > 0), currency (3-letter code), "
            "category (short), description (short), is_family (bool), confidence (0..1). "
            "Use category keys from the provided allowed list when possible. "
            "If there are no explicit financial operations with an amount, return {'events': []}. "
            "If message has multiple operations, return all of them. "
            "Detect Russian and English naturally. "
            "Critical categorization policy: all edible food/drink/snacks/street-food words "
            "(including unfamiliar dish names) must map to groceries_* or cafe_* categories, "
            "not expense_other. Ready-to-eat meal/snack words (e.g. плов, манты, самса, суши, "
            "роллы, картошка фри, хот-дог, шаурма, бургер, напитки вроде кола) usually map to "
            "cafe_streetfood unless there is explicit supermarket/home-grocery context. "
            "Popular Uzbekistan brands should be recognized too: EVOS, KFC, Oqtepa Lavash, "
            "Les Ailes, Feed Up, Bellissimo -> cafe_*; Korzinka, Makro, Havas, Carrefour -> groceries_products. "
            "Household appliances and furniture (пылесос, стиралка, холодильник, стол, стул, "
            "диван, кровать, шкаф) must map to home_appliances/home_furniture. "
            "Telegram/ChatGPT and similar recurring payments must map to leisure_subscriptions."
        )

    def _finance_rules_prompt(self, message_text: str) -> str:
        return (
            "Message:\n"
            f"{message_text}\n\n"
            "Rules for is_family:\n"
            "- true for household/family/common expenses or explicit shared spending;\n"
            "- false for clearly personal spending/income.\n"
            f"{ALLOWED_CATEGORIES_FOR_PROMPT}\n"
            f"Default currency if not provided: {self.default_currency}."
        )

    async def _request_chat_completions(self, body: dict[str, object]) -> dict[str, object]:
        messages = body.get("messages", [])
        response_body: dict[str, object] = {
            "model": body.get("model", self.extraction_model),
            "input": self._to_responses_input(messages),
        }
        response_format = body.get("response_format")
        if (
            isinstance(response_format, dict)
            and str(response_format.get("type", "")).lower() == "json_object"
        ):
            response_body["text"] = {"format": {"type": "json_object"}}

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        async with self._openai_lock:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    "https://api.openai.com/v1/responses",
                    headers=headers,
                    json=response_body,
                )
        response.raise_for_status()
        payload = response.json()
        return payload if isinstance(payload, dict) else {}

    @staticmethod
    def _to_responses_input(messages: object) -> list[dict[str, object]]:
        if not isinstance(messages, list):
            return []

        normalized: list[dict[str, object]] = []
        for message in messages:
            if not isinstance(message, dict):
                continue
            role = str(message.get("role", "user") or "user")
            content = message.get("content", "")
            if isinstance(content, str):
                normalized.append({"role": role, "content": content})
                continue
            if not isinstance(content, list):
                normalized.append({"role": role, "content": str(content)})
                continue

            parts: list[dict[str, object]] = []
            for item in content:
                if not isinstance(item, dict):
                    continue
                item_type = str(item.get("type", "") or "").lower()
                if item_type == "text":
                    text = str(item.get("text", "") or "").strip()
                    if text:
                        parts.append({"type": "input_text", "text": text})
                    continue
                if item_type == "image_url":
                    image_url = item.get("image_url")
                    if isinstance(image_url, dict):
                        url = str(image_url.get("url", "") or "").strip()
                    else:
                        url = str(image_url or "").strip()
                    if url:
                        parts.append({"type": "input_image", "image_url": url})
                    continue

            if parts:
                normalized.append({"role": role, "content": parts})
            else:
                normalized.append({"role": role, "content": ""})
        return normalized

    def _normalize_events_from_payload(
        self, payload: object, *, source_text: str
    ) -> list[ParsedEvent]:
        content = self._extract_content(payload)
        parsed_payload = self._parse_json_object(content)
        if not parsed_payload:
            return []

        raw_events = parsed_payload.get("events", [])
        if not isinstance(raw_events, list):
            return []

        text_l = (
            source_text.lower()
            .replace("–", "-")
            .replace("—", "-")
            .replace("−", "-")
        )
        explicit_currency = self._detect_explicit_currency(text_l)
        events: list[ParsedEvent] = []
        for item in raw_events:
            normalized = self._normalize_event(item)
            if normalized:
                normalized_category = self._normalize_category_key(
                    kind=normalized.kind,
                    category_raw=normalized.category,
                    text_l=text_l,
                )
                normalized_category = self._fallback_expense_category(
                    text_l=text_l,
                    amount=normalized.amount,
                    kind=normalized.kind,
                    category=normalized_category,
                )
                normalized_is_family = self._resolve_is_family(
                    kind=normalized.kind,
                    category=normalized_category,
                    text_l=text_l,
                    ai_is_family=normalized.is_family,
                )
                normalized = ParsedEvent(
                    kind=normalized.kind,
                    amount=normalized.amount,
                    currency=normalized.currency,
                    category=normalized_category,
                    description=normalized.description,
                    is_family=normalized_is_family,
                    confidence=normalized.confidence,
                )
                if explicit_currency:
                    if normalized.currency != explicit_currency:
                        normalized = ParsedEvent(
                            kind=normalized.kind,
                            amount=normalized.amount,
                            currency=explicit_currency,
                            category=normalized.category,
                            description=normalized.description,
                            is_family=normalized.is_family,
                            confidence=normalized.confidence,
                        )
                elif normalized.currency != self.default_currency:
                    normalized = ParsedEvent(
                        kind=normalized.kind,
                        amount=normalized.amount,
                        currency=self.default_currency,
                        category=normalized.category,
                        description=normalized.description,
                        is_family=normalized.is_family,
                        confidence=normalized.confidence,
                    )
                events.append(normalized)
        return events

    def _parse_finance_events_with_rules(self, message_text: str) -> list[ParsedEvent]:
        text_l = (
            message_text.lower()
            .replace("–", "-")
            .replace("—", "-")
            .replace("−", "-")
            .strip()
        )
        if self._looks_like_report_dump(message_text):
            return []
        if self._looks_like_non_financial_text(text_l):
            return []

        amount = self._extract_first_amount(message_text)
        if amount is None:
            return []

        if not self._has_finance_signal(text_l):
            return []

        kind = self._detect_kind(text_l)
        currency = self._detect_currency(text_l)
        category = self._detect_category(text_l, kind)
        category = self._fallback_expense_category(
            text_l=text_l,
            amount=amount,
            kind=kind,
            category=category,
        )
        is_family = self._resolve_is_family(
            kind=kind,
            category=category,
            text_l=text_l,
            ai_is_family=False,
        )

        event = ParsedEvent(
            kind=kind,
            amount=amount,
            currency=currency,
            category=category,
            description=message_text.strip()[:120],
            is_family=is_family,
            confidence=0.55,
        )
        return [event]

    @staticmethod
    def _looks_like_report_dump(text: str) -> bool:
        text_l = (text or "").lower()
        if not text_l:
            return False
        if "━━━━━━━━" in text:
            return True
        markers = (
            "баланс дня",
            "баланс периода",
            "доходы",
            "расходы",
            "итого",
            "семейные",
            "посмотреть детали",
        )
        hits = sum(1 for marker in markers if marker in text_l)
        return hits >= 3 and bool(re.search(r"\d", text_l))

    @staticmethod
    def _has_arithmetic_expression(message_text: str) -> bool:
        return re.search(r"\d+\s*[\+\-\*/]\s*\d+", message_text) is not None

    @staticmethod
    def _is_question_like(message_text: str, text_l: str) -> bool:
        if "?" in message_text:
            return True

        question_markers = (
            "сколько",
            "будет",
            "посчитай",
            "выходит",
            "равно",
            "what is",
            "how much",
            "calculate",
        )
        return any(marker in text_l for marker in question_markers)

    def _is_clear_finance_phrasing(self, text_l: str) -> bool:
        clear_start = re.search(
            r"^\s*(купил|купила|оплатил|оплатила|заплатил|заплатила|потратил|потратила|"
            r"получил|получила|получили|получено|получил\s+зп|получила\s+зп|"
            r"выиграл|выиграла|победил|победила|нашел|нашёл|нашла|нашли)\b",
            text_l,
        )
        if clear_start:
            return True

        if any(
            marker in text_l
            for marker in ("вышел в прибыль", "вышла в прибыль", "вышли в прибыль", "в прибыли")
        ):
            return True

        if re.search(r"\b(за|на)\s+\d", text_l) and self._has_finance_signal(text_l):
            return True

        if re.search(r"\b\d[\d\s.,]*(сум|so'?m|uzs|руб|₽|\$|usd|eur|€)\b", text_l):
            return True

        return False

    @staticmethod
    def _looks_like_non_financial_text(text_l: str) -> bool:
        if not text_l:
            return True

        math_markers = ("сколько будет", "what is", "=", "+", "-", "*", "/", "^")
        if any(marker in text_l for marker in math_markers):
            # If text contains arithmetic symbols and no obvious finance terms, ignore it.
            finance_hints = (
                "купил",
                "купила",
                "потрат",
                "расход",
                "заплат",
                "оплат",
                "получил",
                "получила",
                "зарп",
                "доход",
                "бонус",
                "выигр",
                "побед",
                "нашел",
                "нашёл",
                "прибыл",
                "кофе",
                "продукт",
                "интернет",
                "интренет",
                "кола",
                "колу",
                "кока",
                "кока-кола",
                "пепси",
                "фанта",
                "спрайт",
                "суш",
                "ролл",
                "плов",
                "мант",
                "самса",
                "хачапур",
                "хот",
                "дог",
                "фри",
                "сум",
                "so'm",
                "руб",
                "usd",
                "eur",
            )
            if not any(h in text_l for h in finance_hints):
                return True
        return False

    def _has_finance_signal(self, text_l: str) -> bool:
        income_markers = (
            "получил",
            "получила",
            "получили",
            "зарплат",
            "зп",
            "аванс",
            "доход",
            "преми",
            "бонус",
            "bonus",
            "начисл",
            "вернули",
            "кэшбек",
            "cashback",
            "income",
            "salary",
            "got paid",
            "earned",
            "выигр",
            "выигрыш",
            "побед",
            "нашел",
            "нашёл",
            "нашла",
            "нашли",
            "прибыл",
            "profit",
            "в плюсе",
            "вышел в прибыль",
            "вышла в прибыль",
            "вышли в прибыль",
        )
        expense_markers = (
            "купил",
            "купила",
            "потрат",
            "расход",
            "заплат",
            "оплат",
            "покупк",
            "за ",
            "expense",
            "spent",
            "paid",
            "аренд",
            "ипотек",
            "коммун",
            "кредит",
            "рассроч",
            "долг дал",
            "дал в долг",
            "одолжил",
        )
        category_markers = (
            "аренд",
            "ипотек",
            "коммун",
            "электрич",
            "газ",
            "вода",
            "отоплен",
            "интернет",
            "интренет",
            "телевид",
            "ремонт",
            "мебел",
            "бытов",
            "товары для дома",
            "продукт",
            "яблок",
            "банан",
            "груш",
            "фрукт",
            "овощ",
            "хлеб",
            "молок",
            "мяс",
            "куриц",
            "рыб",
            "сыр",
            "яйц",
            "картош",
            "помидор",
            "огур",
            "супермаркет",
            "рынок",
            "бытовая хим",
            "хозтовар",
            "доставка продуктов",
            "кафе",
            "ресторан",
            "фастфуд",
            "еда",
            "еду",
            "питани",
            "обед",
            "ужин",
            "завтрак",
            "перекус",
            "кофе",
            "плов",
            "мант",
            "самса",
            "суши",
            "ролл",
            "роллы",
            "кола",
            "колу",
            "кока",
            "кока-кола",
            "пепси",
            "фанта",
            "спрайт",
            "лимонад",
            "фри",
            "картошка фри",
            "картошка-фри",
            "хот дог",
            "хот-дог",
            "хотдог",
            "лагман",
            "шашлык",
            "стритфуд",
            "доставка еды",
            "бар",
            "кальян",
            "такси",
            "метро",
            "бензин",
            "топлив",
            "автобус",
            "парковк",
            "штраф",
            "страховка авто",
            "софт",
            "реклам",
            "хостинг",
            "домен",
            "курс",
            "налог",
            "инструмент",
            "школ",
            "садик",
            "репетитор",
            "книг",
            "аптек",
            "врач",
            "анализ",
            "стоматолог",
            "спортзал",
            "бад",
            "одежд",
            "обув",
            "космет",
            "парикмахер",
            "маникюр",
            "аксессуар",
            "игрушк",
            "подгуз",
            "детское питание",
            "кино",
            "игр",
            "подписк",
            "путешеств",
            "отел",
            "авиабилет",
            "подар",
            "праздник",
            "кредит",
            "рассроч",
            "процент",
            "комисси",
            "перевод",
            "инвестиц",
            "сбережен",
            "долг",
            "корм",
            "ветеринар",
            "прочее",
            "непонятно",
            "evos",
            "эвос",
            "kfc",
            "oqtepa",
            "октепа",
            "les ailes",
            "feed up",
            "bellissimo",
            "safia",
            "сафия",
            "korzinka",
            "корзинка",
            "makro",
            "макро",
            "havas",
            "хавас",
            "carrefour",
            "карфур",
        )

        if any(marker in text_l for marker in income_markers):
            return True
        if any(marker in text_l for marker in expense_markers):
            return True
        if any(marker in text_l for marker in category_markers):
            return True
        if self._detect_explicit_currency(text_l) is not None:
            return True
        if self._looks_like_simple_item_with_amount(text_l):
            return True
        return False

    @staticmethod
    def _is_subscription_context(text_l: str) -> bool:
        markers = (
            "подписк",
            "subscription",
            "chatgpt",
            "tg premium",
            "telegram premium",
            "youtube premium",
            "spotify",
            "netflix",
            "apple one",
            "icloud",
            "yandex plus",
            "яндекс плюс",
        )
        return any(marker in text_l for marker in markers)

    @staticmethod
    def _extract_first_amount(message_text: str) -> float | None:
        # Supports forms like "20000", "20 000", "20000.50", "20,000.50"
        amount_re = re.compile(r"(?<!\d)(\d{1,3}(?:[ \u00A0,]\d{3})+|\d+(?:[.,]\d+)?)")
        match = amount_re.search(message_text)
        if not match:
            return None

        raw = match.group(1).replace(" ", "").replace("\u00A0", "").replace(",", "")
        try:
            amount = float(raw)
        except ValueError:
            return None

        # Supports words like "млн", "миллион", "тыс" after the first numeric token.
        tail = (message_text[match.end() : match.end() + 32] or "").lower().strip()
        multiplier = 1.0
        if re.match(r"^(млн|миллион|миллиона|миллионов)\b", tail):
            multiplier = 1_000_000.0
        elif re.match(r"^(млрд|миллиард|миллиарда|миллиардов)\b", tail):
            multiplier = 1_000_000_000.0
        elif re.match(r"^(тыс|тысяч|тысяча|тысячи|k)\b", tail):
            multiplier = 1_000.0
        amount *= multiplier

        if amount <= 0:
            return None
        return amount

    @staticmethod
    def _looks_like_simple_item_with_amount(text_l: str) -> bool:
        cleaned = " ".join(text_l.split()).strip()
        if not cleaned:
            return False
        if "?" in cleaned or "=" in cleaned:
            return False
        words = cleaned.split()
        if len(words) < 2 or len(words) > 6:
            return False
        if not re.search(r"\d", cleaned):
            return False
        if re.search(r"\d+\s*[\+\-\*/]\s*\d+", cleaned):
            return False
        return (
            re.fullmatch(r"[a-zа-яё0-9\-\u2010-\u2015\u2212\s]+", cleaned) is not None
        )

    @staticmethod
    def _detect_kind(text_l: str) -> str:
        income_markers = (
            "получил",
            "получила",
            "получили",
            "зарплат",
            "зп",
            "аванс",
            "доход",
            "преми",
            "бонус",
            "bonus",
            "начисл",
            "вернули",
            "кэшбек",
            "cashback",
            "income",
            "salary",
            "got paid",
            "earned",
            "выигр",
            "выигрыш",
            "побед",
            "нашел",
            "нашёл",
            "нашла",
            "нашли",
            "прибыл",
            "profit",
            "в плюсе",
            "вышел в прибыль",
            "вышла в прибыль",
            "вышли в прибыль",
            "долг получил",
            "вернули долг",
        )
        expense_markers = (
            "купил",
            "купила",
            "потрат",
            "расход",
            "заплат",
            "оплат",
            "покупк",
            "expense",
            "spent",
            "paid",
        )

        if any(marker in text_l for marker in income_markers):
            return "income"
        if any(marker in text_l for marker in expense_markers):
            return "expense"
        return "expense"

    def _detect_explicit_currency(self, text_l: str) -> str | None:
        if any(
            token in text_l
            for token in ("uzs", "сум", "сўм", "so'm", "so‘m", "sum")
        ):
            return "UZS"
        if any(token in text_l for token in ("usd", "$", "доллар")):
            return "USD"
        if any(token in text_l for token in ("eur", "€", "евро")):
            return "EUR"
        if any(token in text_l for token in ("kzt", "₸", "тенге")):
            return "KZT"
        if any(token in text_l for token in ("kgs", "кгс", "киргиз")):
            return "KGS"
        if any(token in text_l for token in ("rub", "₽", "руб")):
            return "RUB"
        return None

    def _detect_currency(self, text_l: str) -> str:
        explicit = self._detect_explicit_currency(text_l)
        if explicit:
            return explicit
        return self.default_currency

    @staticmethod
    def _detect_category(text_l: str, kind: str) -> str:
        if kind == "income":
            if "зарплат" in text_l or "salary" in text_l or "зп" in text_l:
                return "salary"
            if "бонус" in text_l or "bonus" in text_l or "преми" in text_l:
                return "bonus"
            if any(
                marker in text_l
                for marker in (
                    "прибыл",
                    "profit",
                    "в плюсе",
                    "вышел в прибыль",
                    "вышла в прибыль",
                    "вышли в прибыль",
                )
            ):
                return "profit"
            if any(
                marker in text_l
                for marker in (
                    "выигр",
                    "выигрыш",
                    "побед",
                    "нашел",
                    "нашёл",
                    "нашла",
                    "нашли",
                )
            ):
                return "windfall"
            if any(
                marker in text_l for marker in ("долг получил", "вернули долг", "вернули мне")
            ):
                return "finance_debt_received"
            if "кэшбек" in text_l or "cashback" in text_l:
                return "cashback"
            if "подар" in text_l:
                return "gift"
            return "income_other"

        place_category = AIService.guess_place_category(text_l, kind)
        if place_category is not None:
            return place_category

        kids_ctx = any(
            marker in text_l for marker in ("дет", "ребен", "ребён", "малыш", "сын", "доч")
        )
        work_ctx = any(
            marker in text_l for marker in ("работ", "офис", "бизнес", "клиент", "проект")
        )
        auto_ctx = any(
            marker in text_l
            for marker in (
                "авто",
                "машин",
                "тачк",
                "заправ",
                "шиномонтаж",
                "дорог",
                "осаго",
                "каско",
            )
        )
        utility_ctx = any(
            marker in text_l for marker in ("коммун", "квитан", "счет", "счёт", "жкх")
        )

        if any(marker in text_l for marker in ("долг дал", "дал в долг", "одолжил")):
            return "finance_debt_given"
        if any(marker in text_l for marker in ("долг получил", "вернули долг")):
            return "finance_debt_received"

        if any(
            marker in text_l
            for marker in (
                "плов",
                "мант",
                "самса",
                "суши",
                "ролл",
                "роллы",
                "фри",
                "картошка фри",
                "картошка-фри",
                "хот дог",
                "хот-дог",
                "хотдог",
                "лагман",
                "шашлык",
                "донер",
            )
        ):
            return "cafe_streetfood"
        if any(
            marker in text_l for marker in ("еда", "еду", "питани", "обед", "ужин", "завтрак")
        ):
            return "groceries_products"
        if any(
            marker in text_l
            for marker in (
                "яблок",
                "банан",
                "груш",
                "фрукт",
                "овощ",
                "хлеб",
                "молок",
                "мяс",
                "куриц",
                "рыб",
                "сыр",
                "яйц",
                "картош",
                "помидор",
                "огур",
            )
        ):
            return "groceries_products"

        if "газ" in text_l and auto_ctx:
            return "transport_gas"
        if "газ" in text_l:
            return "home_gas"

        if "вода" in text_l:
            if utility_ctx:
                return "home_water"
            return "groceries_water"

        if any(marker in text_l for marker in ("ремонт авто", "автосервис", "сто")):
            return "transport_repair"
        if "ремонт" in text_l and auto_ctx:
            return "transport_repair"
        if "ремонт" in text_l:
            return "home_repair"

        if AIService._is_subscription_context(text_l):
            return "leisure_subscriptions"
        if "курс" in text_l:
            return "work_courses" if work_ctx else "education_online_courses"

        if kids_ctx and ("одежд" in text_l or "обув" in text_l):
            return "kids_clothes"
        if kids_ctx and ("игрушк" in text_l):
            return "kids_toys"
        if kids_ctx and ("подгуз" in text_l or "памперс" in text_l):
            return "kids_diapers"
        if kids_ctx and ("питани" in text_l or "смесь" in text_l):
            return "kids_food"
        if kids_ctx and ("развлеч" in text_l or "аттракцион" in text_l):
            return "kids_entertainment"
        if "подгуз" in text_l or "памперс" in text_l:
            return "kids_diapers"
        if "детское питание" in text_l or "смесь" in text_l:
            return "kids_food"
        if "прочее" in text_l or "непонятно" in text_l:
            return "expense_other"

        category_map: tuple[tuple[str, tuple[str, ...]], ...] = (
            ("home_rent", ("аренд",)),
            ("home_mortgage", ("ипотек",)),
            ("home_utilities", ("коммун", "квартплат", "жкх", "квитанц")),
            ("home_electricity", ("электрич", "свет")),
            ("home_heating", ("отоплен",)),
            (
                "home_internet",
                ("интернет", "интренет", "wifi", "wi-fi", "вайфай", "тариф"),
            ),
            ("home_tv", ("тв", "телевид")),
            ("home_furniture", ("мебел", "стол", "стул", "диван", "кресл", "кровать", "шкаф")),
            ("home_appliances", ("бытов", "пылесос", "стирал", "холодильн", "микроволнов")),
            ("home_goods", ("товары для дома", "для дома")),
            ("groceries_delivery", ("доставка продуктов",)),
            ("groceries_products", ("продукт", "супермаркет", "рынок", "гипермаркет")),
            ("groceries_household", ("бытовая хим", "хозтовар", "моющ")),
            ("cafe_delivery", ("доставка еды", "готовая еда")),
            ("cafe_fastfood", ("фастфуд", "шаурм", "бургер")),
            ("cafe_restaurant", ("ресторан",)),
            ("cafe_coffee", ("кофе", "кофейн")),
            (
                "cafe_streetfood",
                (
                    "стритфуд",
                    "донер",
                    "самса",
                    "плов",
                    "мант",
                    "лагман",
                    "шашлык",
                    "суши",
                    "ролл",
                    "роллы",
                    "фри",
                    "картошка фри",
                    "картошка-фри",
                    "хот дог",
                    "хот-дог",
                    "хотдог",
                ),
            ),
            ("cafe_bar", ("бар",)),
            ("cafe_hookah", ("кальян", "кальянная")),
            ("cafe_cafe", ("кафе",)),
            ("transport_fuel", ("бензин", "топлив", "заправк")),
            ("transport_taxi", ("такси",)),
            ("transport_metro", ("метро",)),
            ("transport_bus", ("автобус",)),
            ("transport_parking", ("парковк",)),
            ("transport_fine", ("штраф",)),
            ("transport_insurance", ("страховка авто", "осаго", "каско")),
            ("work_software", ("софт", "software", "лиценз")),
            ("work_ads", ("реклам",)),
            ("work_hosting", ("хостинг",)),
            ("work_domain", ("домен",)),
            ("work_taxes", ("налог",)),
            ("work_tools", ("инструмент",)),
            ("education_school", ("школ",)),
            ("education_kindergarten", ("садик", "детсад")),
            ("education_tutor", ("репетитор",)),
            ("education_books", ("книг",)),
            ("health_pharmacy", ("аптек",)),
            ("health_tests", ("анализ",)),
            ("health_dentist", ("стоматолог", "зуб")),
            ("health_gym", ("спортзал", "фитнес")),
            ("health_supplements", ("бад", "витамин")),
            ("health_doctor", ("врач", "доктор", "клиник", "больниц")),
            ("fashion_clothes", ("одежд",)),
            ("fashion_shoes", ("обув",)),
            ("fashion_cosmetics", ("космет",)),
            ("fashion_hairdresser", ("парикмахер", "барбер")),
            ("fashion_manicure", ("маникюр",)),
            ("fashion_accessories", ("аксессуар",)),
            ("leisure_games", ("игр", "мяч", "ракетк", "джойстик", "консоль")),
            ("leisure_cinema", ("кино",)),
            ("leisure_travel", ("путешеств",)),
            ("leisure_hotel", ("отел", "гостиниц")),
            ("leisure_flights", ("авиабилет", "самолет")),
            ("leisure_gifts", ("подар",)),
            ("leisure_holidays", ("праздник",)),
            ("finance_credit", ("кредит",)),
            ("finance_installment", ("рассрочк",)),
            ("finance_interest", ("процент",)),
            ("finance_bank_fees", ("комисси",)),
            ("finance_transfers", ("перевод",)),
            ("finance_investments", ("инвестиц",)),
            ("finance_savings", ("сбережен", "накоплен")),
            ("pets_food", ("корм",)),
            ("pets_vet", ("ветеринар", "ветклиник")),
        )
        for category, tokens in category_map:
            if any(token in text_l for token in tokens):
                return category
        return "expense_other"

    def _normalize_category_key(
        self,
        *,
        kind: str,
        category_raw: str,
        text_l: str,
    ) -> str:
        if kind == "expense" and self._is_subscription_context(text_l):
            return "leisure_subscriptions"

        key = (
            (category_raw or "")
            .strip()
            .lower()
            .replace("-", "_")
            .replace(" ", "_")
        )
        aliases = {
            "other": "expense_other" if kind == "expense" else "income_other",
            "misc": "expense_other" if kind == "expense" else "income_other",
            "miscellaneous": "expense_other" if kind == "expense" else "income_other",
            "food": "groceries_products",
            "shopping": "groceries_products",
            "home": "home_utilities",
            "internet": "home_internet",
            "entertainment": "leisure_games",
            "transport": "transport_taxi",
            "health": "health_doctor",
            "debt_given": "finance_debt_given",
            "debt_received": "finance_debt_received",
            "subscription": "leisure_subscriptions",
            "subscriptions": "leisure_subscriptions",
            "work_subscriptions": "leisure_subscriptions",
        }
        key = aliases.get(key, key)

        if kind == "income":
            if key in INCOME_CATEGORY_KEYS:
                return key
            if key in {"finance_debt_received"}:
                return key
            return self._detect_category(text_l, kind)

        if key in EXPENSE_CATEGORY_KEYS:
            return key
        return self._detect_category(text_l, kind)

    def _fallback_expense_category(
        self,
        *,
        text_l: str,
        amount: float,
        kind: str,
        category: str,
    ) -> str:
        if kind != "expense":
            return category
        if category != "expense_other":
            return category

        place_category = AIService.guess_place_category(text_l, "expense")
        if place_category is not None:
            return place_category

        streetfood_tokens = (
            "плов",
            "мант",
            "самса",
            "суши",
            "ролл",
            "роллы",
            "фри",
            "картошка фри",
            "картошка-фри",
            "хот дог",
            "хот-дог",
            "хотдог",
            "лагман",
            "шашлык",
            "донер",
            "шаурм",
            "хачапур",
            "бургер",
            "кебаб",
            "пицц",
        )
        if any(token in text_l for token in streetfood_tokens):
            return "cafe_streetfood"

        drink_or_food_tokens = (
            "еда",
            "еду",
            "питани",
            "обед",
            "ужин",
            "завтрак",
            "перекус",
            "напит",
            "кола",
            "колу",
            "кока",
            "кока-кола",
            "пепси",
            "фанта",
            "спрайт",
            "сок",
            "лимонад",
            "газиров",
            "чай",
            "кофе",
            "яблок",
            "банан",
            "груш",
            "фрукт",
            "овощ",
            "хлеб",
            "молок",
            "мяс",
            "куриц",
            "рыб",
            "сыр",
            "яйц",
            "картош",
            "помидор",
            "огур",
        )
        if any(token in text_l for token in drink_or_food_tokens):
            return "groceries_products"

        return category

    @staticmethod
    def _is_family_expense(text_l: str, kind: str) -> bool:
        if kind != "expense":
            return False
        family_markers = (
            "семь",
            "семейн",
            "общ",
            "дом",
            "продукт",
            "коммун",
            "аренд",
            "ипотек",
            "ребен",
            "дет",
            "жена",
            "муж",
            "интернет",
            "интренет",
            "wifi",
            "wi-fi",
            "вайфай",
            "пылесос",
            "бытов",
            "техника",
            "family",
            "household",
        )
        return any(marker in text_l for marker in family_markers)

    @staticmethod
    def _is_household_family_category(category: str) -> bool:
        key = (category or "").strip().lower().replace("-", "_").replace(" ", "_")
        if not key:
            return False
        if key.startswith(FAMILY_EXPENSE_CATEGORY_PREFIXES):
            return True
        return key in FAMILY_EXPENSE_CATEGORY_KEYS

    def _resolve_is_family(
        self,
        *,
        kind: str,
        category: str,
        text_l: str,
        ai_is_family: bool,
    ) -> bool:
        if kind != "expense":
            return False
        if ai_is_family:
            return True
        if self._is_family_expense(text_l, kind):
            return True
        return self._is_household_family_category(category)

    @staticmethod
    def _extract_content(payload: object) -> str:
        if not isinstance(payload, dict):
            return ""
        output_text = payload.get("output_text")
        if isinstance(output_text, str) and output_text.strip():
            return output_text
        output = payload.get("output", [])
        if isinstance(output, list):
            chunks: list[str] = []
            for item in output:
                if not isinstance(item, dict):
                    continue
                if str(item.get("type", "")).lower() != "message":
                    continue
                content = item.get("content", [])
                if isinstance(content, str) and content.strip():
                    chunks.append(content)
                    continue
                if not isinstance(content, list):
                    continue
                for part in content:
                    if not isinstance(part, dict):
                        continue
                    part_type = str(part.get("type", "")).lower()
                    if part_type not in {"output_text", "text"}:
                        continue
                    text = str(part.get("text", "") or "").strip()
                    if text:
                        chunks.append(text)
            if chunks:
                return "\n".join(chunks)
        choices = payload.get("choices", [])
        if not isinstance(choices, list) or not choices:
            return ""
        choice = choices[0]
        if not isinstance(choice, dict):
            return ""
        message = choice.get("message", {})
        if not isinstance(message, dict):
            return ""
        return str(message.get("content", "") or "")

    def _normalize_event(self, item: object) -> ParsedEvent | None:
        if not isinstance(item, dict):
            return None

        kind = str(item.get("kind", "")).strip().lower()
        if kind not in {"income", "expense"}:
            return None

        try:
            amount = float(item.get("amount"))
        except (TypeError, ValueError):
            return None
        if amount <= 0:
            return None

        currency_raw = str(item.get("currency", "")).strip().upper()
        currency = currency_raw if 2 <= len(currency_raw) <= 6 else self.default_currency

        category = str(item.get("category", "")).strip() or "other"
        description = str(item.get("description", "")).strip() or category
        is_family = bool(item.get("is_family", False))

        try:
            confidence = float(item.get("confidence", 0.5))
        except (TypeError, ValueError):
            confidence = 0.5
        confidence = max(0.0, min(1.0, confidence))

        if confidence < MIN_CONFIDENCE:
            return None

        return ParsedEvent(
            kind=kind,
            amount=amount,
            currency=currency,
            category=category,
            description=description,
            is_family=is_family,
            confidence=confidence,
        )

    @staticmethod
    def _parse_json_object(content: str) -> dict[str, object] | None:
        content = content.strip()
        if not content:
            return None

        try:
            parsed = json.loads(content)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass

        match = re.search(r"\{.*\}", content, re.DOTALL)
        if not match:
            return None

        try:
            parsed = json.loads(match.group(0))
        except json.JSONDecodeError:
            return None

        if isinstance(parsed, dict):
            return parsed
        return None
