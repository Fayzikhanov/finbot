from __future__ import annotations

from typing import Final

SUPPORTED_LANGUAGES: Final[tuple[str, str, str]] = ("ru", "uz", "en")
DEFAULT_LANGUAGE: Final[str] = "ru"

LANGUAGE_NATIVE_LABELS: Final[dict[str, str]] = {
    "ru": "Русский",
    "uz": "O'zbek tili",
    "en": "English",
}

LANGUAGE_SHORT_LABELS: Final[dict[str, str]] = {
    "ru": "Русский",
    "uz": "O'zbek",
    "en": "English",
}

LANGUAGE_FLAG_LABELS: Final[dict[str, str]] = {
    "ru": "🇷🇺 Русский",
    "uz": "🇺🇿 O'zbek tili",
    "en": "🇬🇧 English",
}

LOCALE_BY_LANGUAGE: Final[dict[str, str]] = {
    "ru": "ru-RU",
    "uz": "uz-UZ",
    "en": "en-US",
}

TEXTS: Final[dict[str, dict[str, str]]] = {
    "language_prompt_combined": {
        "ru": "Выберите язык:\nTilni tanlang:\nLanguage:",
        "uz": "Tilni tanlang:\nВыберите язык:\nLanguage:",
        "en": "Language:\nВыберите язык:\nTilni tanlang:",
    },
    "language_current": {
        "ru": "Текущий язык: {language}",
        "uz": "Joriy til: {language}",
        "en": "Current language: {language}",
    },
    "language_changed": {
        "ru": "Язык изменён: {language} ✅",
        "uz": "Til o'zgartirildi: {language} ✅",
        "en": "Language changed: {language} ✅",
    },
    "language_change_confirm": {
        "ru": "Переключить язык на {language}?",
        "uz": "{language} tiliga o'tilsinmi?",
        "en": "Switch language to {language}?",
    },
    "language_change_confirm_note": {
        "ru": "После подтверждения бот и miniapp будут работать на выбранном языке.",
        "uz": "Tasdiqlangandan so'ng bot va miniapp tanlangan tilda ishlaydi.",
        "en": "After confirmation, the bot and miniapp will work in the selected language.",
    },
    "language_change_cancelled": {
        "ru": "Смена языка отменена.",
        "uz": "Tilni almashtirish bekor qilindi.",
        "en": "Language change cancelled.",
    },
    "confirm_yes": {
        "ru": "✅ Да, продолжить",
        "uz": "✅ Ha, davom etish",
        "en": "✅ Yes, continue",
    },
    "confirm_no": {
        "ru": "❌ Нет",
        "uz": "❌ Yo'q",
        "en": "❌ No",
    },
    "back": {
        "ru": "⬅️ Назад",
        "uz": "⬅️ Orqaga",
        "en": "⬅️ Back",
    },
    "cancel": {
        "ru": "❌ Отмена",
        "uz": "❌ Bekor qilish",
        "en": "❌ Cancel",
    },
    "back_to_settings": {
        "ru": "⬅️ Назад к настройкам",
        "uz": "⬅️ Sozlamalarga qaytish",
        "en": "⬅️ Back to settings",
    },
    "close": {
        "ru": "❌ Закрыть",
        "uz": "❌ Yopish",
        "en": "❌ Close",
    },
    "assistant_settings_title": {
        "ru": "⚙️ Настройки Ассистента\n\nВыберите раздел:",
        "uz": "⚙️ Assistent sozlamalari\n\nBo'limni tanlang:",
        "en": "⚙️ Assistant Settings\n\nChoose a section:",
    },
    "assistant_settings_profile": {
        "ru": "✏️ Заполнить профиль",
        "uz": "✏️ Profilni to'ldirish",
        "en": "✏️ Fill Profile",
    },
    "assistant_settings_language": {
        "ru": "🌐 Выбор языка",
        "uz": "🌐 Til tanlash",
        "en": "🌐 Language",
    },
    "assistant_settings_currency": {
        "ru": "💱 Выбор валюты",
        "uz": "💱 Valyuta tanlash",
        "en": "💱 Currency",
    },
    "assistant_settings_rate": {
        "ru": "⭐ Оценить бота",
        "uz": "⭐ Botni baholash",
        "en": "⭐ Rate the Bot",
    },
    "assistant_settings_support": {
        "ru": "✉️ Поддержка",
        "uz": "✉️ Yordam",
        "en": "✉️ Support",
    },
    "assistant_language_title": {
        "ru": "🌐 Выбор языка",
        "uz": "🌐 Til tanlash",
        "en": "🌐 Language",
    },
    "assistant_language_note": {
        "ru": "Выберите язык интерфейса для бота и miniapp.",
        "uz": "Bot va miniapp interfeysi tilini tanlang.",
        "en": "Choose the interface language for the bot and miniapp.",
    },
    "assistant_currency_title": {
        "ru": "💱 Выбор валюты",
        "uz": "💱 Valyuta tanlash",
        "en": "💱 Currency",
    },
    "assistant_currency_in_miniapp": {
        "ru": "Изменение уже доступно в miniapp (Профиль → Настройки).",
        "uz": "O'zgartirish miniapp'da mavjud (Profil → Sozlamalar).",
        "en": "Change is already available in miniapp (Profile → Settings).",
    },
    "assistant_support_title": {
        "ru": "✉️ Поддержка\n\nВыберите действие:",
        "uz": "✉️ Yordam\n\nAmalni tanlang:",
        "en": "✉️ Support\n\nChoose an action:",
    },
    "error_generic": {
        "ru": "Ошибка. Попробуйте ещё раз.",
        "uz": "Xatolik. Yana urinib ko'ring.",
        "en": "Error. Please try again.",
    },
    "error_simple": {
        "ru": "Ошибка",
        "uz": "Xatolik",
        "en": "Error",
    },
    "profile_closed": {
        "ru": "Профиль закрыт.",
        "uz": "Profil yopildi.",
        "en": "Profile closed.",
    },
    "profile_settings_title": {
        "ru": "⚙️ Настройки профиля\n\nВыберите действие:",
        "uz": "⚙️ Profil sozlamalari\n\nAmalni tanlang:",
        "en": "⚙️ Profile Settings\n\nChoose an action:",
    },
    "profile_support_title": {
        "ru": "✉️ Поддержка\n\nВыберите действие:",
        "uz": "✉️ Yordam\n\nAmalni tanlang:",
        "en": "✉️ Support\n\nChoose an action:",
    },
    "profile_settings_language_row": {
        "ru": "🌐 Язык: {language}",
        "uz": "🌐 Til: {language}",
        "en": "🌐 Language: {language}",
    },
    "profile_settings_currency_row": {
        "ru": "💱 Валюта: {currency}",
        "uz": "💱 Valyuta: {currency}",
        "en": "💱 Currency: {currency}",
    },
    "profile_support_dev": {
        "ru": "📝 Написать разработчику",
        "uz": "📝 Dasturchiga yozish",
        "en": "📝 Message Developer",
    },
    "profile_support_bug": {
        "ru": "🐞 Сообщить об ошибке",
        "uz": "🐞 Xato haqida xabar berish",
        "en": "🐞 Report a Bug",
    },
    "main_menu_reports": {
        "ru": "📊 Отчёты",
        "uz": "📊 Hisobotlar",
        "en": "📊 Reports",
    },
    "main_menu_settings": {
        "ru": "⚙️ Настройки Ассистента",
        "uz": "⚙️ Assistent sozlamalari",
        "en": "⚙️ Assistant Settings",
    },
    "main_menu_app": {
        "ru": "📱 Приложение",
        "uz": "📱 Ilova",
        "en": "📱 App",
    },
    "start_private_intro": {
        "ru": (
            "Привет! Я помогу вам вести семейные финансы — удобно прямо в Telegram.\n"
            "Лучше всего работает, когда вы ведёте бюджет вдвоём: "
            "вы + супруг/супруга (без большого семейного чата).\n\n"
            "Создайте отдельную группу «Бюджет»\n"
            "Добавьте туда меня\n"
            "Напишите в группе /start — и начнём\n\n"
            "Нажмите кнопку ниже, чтобы добавить меня в группу 👇"
        ),
        "uz": (
            "Salom! Men sizga oilaviy moliyani Telegram ichida qulay yuritishga yordam beraman.\n"
            "Eng yaxshi ishlaydi, agar byudjetni ikki kishi yuritsa: "
            "siz + turmush o'rtog'ingiz (katta oilaviy chat emas).\n\n"
            "Alohida «Byudjet» guruhi yarating\n"
            "Meni u yerga qo'shing\n"
            "Guruhda /start yozing — va boshlaymiz\n\n"
            "Meni guruhga qo'shish uchun pastdagi tugmani bosing 👇"
        ),
        "en": (
            "Hi! I can help you manage family finances right inside Telegram.\n"
            "It works best when two people manage the budget together: "
            "you + your spouse (without a large family group chat).\n\n"
            "Create a separate “Budget” group\n"
            "Add me there\n"
            "Send /start in that group — and we’ll begin\n\n"
            "Tap the button below to add me to a group 👇"
        ),
    },
    "start_private_mode_pick": {
        "ru": "Выберите режим использования:",
        "uz": "Foydalanish rejimini tanlang:",
        "en": "Choose a usage mode:",
    },
    "start_mode_personal_button": {
        "ru": "👤 Личное использование",
        "uz": "👤 Shaxsiy foydalanish",
        "en": "👤 Personal use",
    },
    "start_mode_family_button": {
        "ru": "👨‍👩‍👧 Семейное использование",
        "uz": "👨‍👩‍👧 Oilaviy foydalanish",
        "en": "👨‍👩‍👧 Family use",
    },
    "start_personal_mode_activated": {
        "ru": "Личный финансовый режим активирован.",
        "uz": "Shaxsiy moliyaviy rejim faollashtirildi.",
        "en": "Personal finance mode activated.",
    },
    "start_family_mode_group_hint": {
        "ru": "Добавьте бота в группу и нажмите /start в группе для создания семейного бюджета.",
        "uz": "Botni guruhga qo'shing va oilaviy byudjet yaratish uchun guruhda /start ni bosing.",
        "en": "Add the bot to a group and press /start in the group to create a family budget.",
    },
    "start_family_mode_activated": {
        "ru": "Семейный финансовый режим активирован.",
        "uz": "Oilaviy moliyaviy rejim faollashtirildi.",
        "en": "Family finance mode activated.",
    },
    "private_mode_required": {
        "ru": "Сначала выберите режим использования.",
        "uz": "Avval foydalanish rejimini tanlang.",
        "en": "Choose a usage mode first.",
    },
    "group_start_required": {
        "ru": "Сначала активируйте семейный режим в этой группе: нажмите /start.",
        "uz": "Avval shu guruhda oilaviy rejimni yoqing: /start ni bosing.",
        "en": "Activate family mode in this group first: press /start.",
    },
    "miniapp_not_configured": {
        "ru": "Mini App пока не подключен: нужен публичный HTTPS URL.\nУкажите MINIAPP_BASE_URL, например: https://your-domain.com",
        "uz": "Mini App hali ulanmagan: public HTTPS URL kerak.\nMINIAPP_BASE_URL ni kiriting, masalan: https://your-domain.com",
        "en": "Mini App is not connected yet: a public HTTPS URL is required.\nSet MINIAPP_BASE_URL, for example: https://your-domain.com",
    },
    "open_family_dashboard": {
        "ru": "Открыть семейный дашборд:",
        "uz": "Oilaviy dashboardni ochish:",
        "en": "Open family dashboard:",
    },
    "quick_menu_restored": {
        "ru": "Быстрое меню снова на месте (Отчёты, Настройки Ассистента, Приложение):",
        "uz": "Tezkor menyu yana joyida (Hisobotlar, Assistent sozlamalari, Ilova):",
        "en": "Quick menu is back (Reports, Assistant Settings, App):",
    },
    "choose_action": {
        "ru": "Выберите действие:",
        "uz": "Amalni tanlang:",
        "en": "Choose an action:",
    },
    "start_group_admin_request": {
        "ru": "Привет всем! Я буду вашим финансовым помощником здесь 🙂\nЧтобы я мог видеть сообщения и учитывать расходы, пожалуйста, сделайте меня администратором группы.",
        "uz": "Hammaga salom! Men bu yerda moliyaviy yordamchingiz bo’laman 🙂\nXabarlarni ko’rish va xarajatlarni hisobga olishim uchun meni guruh administratori qiling.",
        "en": "Hi everyone! I’ll be your finance assistant here 🙂\nTo see messages and track expenses, please make me a group admin.",
    },
    "ponb_step1": {
        "ru": (
            "Отлично! Личный финансовый режим активирован 🎉\n\n"
            "Я — ваш персональный финансовый помощник. Вот что я умею:\n\n"
            "📝 Записывать расходы и доходы из текстовых сообщений\n"
            "🎤 Распознавать голосовые сообщения\n"
            "📊 Строить отчёты и аналитику\n"
            "📱 Удобное мини-приложение для просмотра финансов\n\n"
            "Давайте я покажу, как это работает!"
        ),
        "uz": (
            "Ajoyib! Shaxsiy moliyaviy rejim faollashtirildi 🎉\n\n"
            "Men — sizning shaxsiy moliyaviy yordamchingizman. Mening imkoniyatlarim:\n\n"
            "📝 Matnli xabarlardan xarajat va daromadlarni yozish\n"
            "🎤 Ovozli xabarlarni aniqlash\n"
            "📊 Hisobotlar va tahlillar tayyorlash\n"
            "📱 Moliyani ko’rish uchun qulay mini-ilova\n\n"
            "Keling, qanday ishlashini ko’rsataman!"
        ),
        "en": (
            "Great! Personal finance mode activated 🎉\n\n"
            "I’m your personal finance assistant. Here’s what I can do:\n\n"
            "📝 Record expenses and income from text messages\n"
            "🎤 Recognize voice messages\n"
            "📊 Build reports and analytics\n"
            "📱 Convenient mini-app for viewing finances\n\n"
            "Let me show you how it works!"
        ),
    },
    "ponb_step1_btn": {
        "ru": "Далее →",
        "uz": "Keyingi →",
        "en": "Next →",
    },
    "ponb_step2": {
        "ru": (
            "📝 Шаг 1: Запись расходов текстом\n\n"
            "Просто напишите мне сообщение о расходе — "
            "я сам определю сумму, категорию и тип.\n\n"
            "Для тренировки напишите:\n"
            "Такси 22 000\n\n"
            "Это тестовая запись — потом её можно удалить 👇"
        ),
        "uz": (
            "📝 1-qadam: Xarajatlarni matn bilan yozish\n\n"
            "Menga xarajat haqida xabar yozing — "
            "men summani, toifani va turini o’zim aniqlayman.\n\n"
            "Mashq uchun yozing:\n"
            "Taksi 22 000\n\n"
            "Bu sinov yozuvi — keyin o’chirish mumkin 👇"
        ),
        "en": (
            "📝 Step 1: Recording expenses via text\n\n"
            "Just send me a message about an expense — "
            "I’ll figure out the amount, category, and type.\n\n"
            "For practice, type:\n"
            "Taxi 22,000\n\n"
            "This is a test entry — you can delete it later 👇"
        ),
    },
    "ponb_step3": {
        "ru": (
            "Отлично, запись сохранена! ✅\n\n"
            "🎤 Шаг 2: Голосовые сообщения\n\n"
            "Точно так же можно отправлять голосовые. "
            "Для тренировки скажите:\n"
            "«Обед 60 000»\n\n"
            "Это тоже тестовая запись — удалите потом, если нужно.\n"
            "Или нажмите «Пропустить»."
        ),
        "uz": (
            "Ajoyib, yozuv saqlandi! ✅\n\n"
            "🎤 2-qadam: Ovozli xabarlar\n\n"
            "Xuddi shunday ovozli xabar ham yuborishingiz mumkin. "
            "Mashq uchun ayting:\n"
            "«Tushlik 60 000»\n\n"
            "Bu ham sinov yozuvi — keyin o’chirishingiz mumkin.\n"
            "Yoki «O’tkazib yuborish» tugmasini bosing."
        ),
        "en": (
            "Great, entry saved! ✅\n\n"
            "🎤 Step 2: Voice messages\n\n"
            "You can also send voice messages. "
            "For practice, say:\n"
            "\"Lunch 60,000\"\n\n"
            "This is also a test entry — delete it later if needed.\n"
            "Or tap \"Skip\"."
        ),
    },
    "ponb_show_report_btn": {
        "ru": "Посмотреть отчёт 📊",
        "uz": "Hisobotni ko'rish 📊",
        "en": "View report 📊",
    },
    "ponb_skip_btn": {
        "ru": "Пропустить →",
        "uz": "O’tkazib yuborish →",
        "en": "Skip →",
    },
    "ponb_step4": {
        "ru": (
            "🎉 Вы освоили основы!\n\n"
            "📊 Теперь про отчёты.\n\n"
            "Бот автоматически категоризирует все ваши операции "
            "и может построить детальный отчёт по команде /report — "
            "за день, неделю, месяц или произвольный период."
        ),
        "uz": (
            "🎉 Asoslarni o’zlashtirdingiz!\n\n"
            "📊 Endi hisobotlar haqida.\n\n"
            "Bot barcha operatsiyalaringizni avtomatik toifalaydi "
            "va /report buyrug’i bilan batafsil hisobot tayyorlaydi — "
            "kun, hafta, oy yoki boshqa davr uchun."
        ),
        "en": (
            "🎉 You’ve mastered the basics!\n\n"
            "📊 Now about reports.\n\n"
            "The bot automatically categorizes all your transactions "
            "and can build a detailed report via /report — "
            "for a day, week, month, or custom period."
        ),
    },
    "ponb_step5": {
        "ru": (
            "⏰ Ежедневный отчёт\n\n"
            "Каждый вечер я могу присылать вам сводку за день: "
            "сколько потрачено, по каким категориям, сколько осталось.\n\n"
            "Это помогает держать расходы под контролем "
            "и не забывать записывать траты.\n\n"
            "Выберите удобное время для ежедневного отчёта:"
        ),
        "uz": (
            "⏰ Kunlik hisobot\n\n"
            "Har kuni kechqurun men sizga kun bo’yicha xulosa yuboraman: "
            "qancha sarflandi, qaysi toifalarda, qancha qoldi.\n\n"
            "Bu xarajatlarni nazorat qilishga "
            "va yozishni unutmaslikka yordam beradi.\n\n"
            "Kunlik hisobot uchun qulay vaqtni tanlang:"
        ),
        "en": (
            "⏰ Daily report\n\n"
            "Every evening I can send you a daily summary: "
            "how much was spent, in which categories, how much is left.\n\n"
            "This helps keep expenses under control "
            "and not forget to log transactions.\n\n"
            "Choose a convenient time for the daily report:"
        ),
    },
    "ponb_step6": {
        "ru": (
            "✅ Отлично! Ежедневный отчёт будет приходить в {time}.\n\n"
            "Также раз в неделю и раз в месяц вы будете получать "
            "расширенные сводки."
        ),
        "uz": (
            "✅ Ajoyib! Kunlik hisobot {time} da keladi.\n\n"
            "Shuningdek, haftada bir va oyda bir marta "
            "kengaytirilgan xulosalar olasiz."
        ),
        "en": (
            "✅ Great! The daily report will arrive at {time}.\n\n"
            "You’ll also receive extended summaries "
            "once a week and once a month."
        ),
    },
    "ponb_complete": {
        "ru": (
            "🎉 Поздравляем, настройка завершена!\n\n"
            "Тестовые записи удалены — вы начинаете с чистого листа.\n"
            "Теперь просто пишите или говорите о расходах и доходах — я всё запишу.\n\n"
            "Откройте мини-приложение — там графики, история и полная аналитика 👇"
        ),
        "uz": (
            "🎉 Tabriklaymiz, sozlash tugallandi!\n\n"
            "Sinov yozuvlari o’chirildi — siz toza sahifadan boshlaysiz.\n"
            "Endi shunchaki xarajat va daromadlar haqida yozing yoki ayting — men hammasini yozaman.\n\n"
            "Mini-ilovani oching — u yerda grafiklar, tarix va to’liq tahlil bor 👇"
        ),
        "en": (
            "🎉 Congratulations, setup is complete!\n\n"
            "Test entries have been deleted — you’re starting fresh.\n"
            "Now just write or say your expenses and income — I’ll record everything.\n\n"
            "Open the mini-app — it has charts, history, and full analytics 👇"
        ),
    },
    "ponb_open_app_btn": {
        "ru": "Открыть приложение 📱",
        "uz": "Ilovani ochish 📱",
        "en": "Open App 📱",
    },
}


def normalize_language(value: str | None) -> str:
    code = str(value or "").strip().lower()
    if code in SUPPORTED_LANGUAGES:
        return code
    return DEFAULT_LANGUAGE


def is_supported_language(value: str | None) -> bool:
    return normalize_language(value) == str(value or "").strip().lower()


def language_native_label(code: str | None) -> str:
    return LANGUAGE_NATIVE_LABELS.get(normalize_language(code), LANGUAGE_NATIVE_LABELS[DEFAULT_LANGUAGE])


def language_short_label(code: str | None) -> str:
    return LANGUAGE_SHORT_LABELS.get(normalize_language(code), LANGUAGE_SHORT_LABELS[DEFAULT_LANGUAGE])


def language_flag_label(code: str | None) -> str:
    return LANGUAGE_FLAG_LABELS.get(normalize_language(code), LANGUAGE_FLAG_LABELS[DEFAULT_LANGUAGE])


def locale_for_language(code: str | None) -> str:
    return LOCALE_BY_LANGUAGE.get(normalize_language(code), LOCALE_BY_LANGUAGE[DEFAULT_LANGUAGE])


def t(key: str, lang: str | None = None, **kwargs: object) -> str:
    normalized_lang = normalize_language(lang)
    by_lang = TEXTS.get(key)
    if not by_lang:
        return key
    template = by_lang.get(normalized_lang) or by_lang.get(DEFAULT_LANGUAGE) or key
    if kwargs:
        try:
            return template.format(**kwargs)
        except Exception:
            return template
    return template
