(function () {
  // Telegram iOS WebView on older devices may not support String.prototype.replaceAll.
  if (typeof String.prototype.replaceAll !== "function") {
    // eslint-disable-next-line no-extend-native
    String.prototype.replaceAll = function replaceAllCompat(search, replacement) {
      const source = String(this);
      if (search instanceof RegExp) {
        if (!search.global) {
          throw new TypeError("replaceAll requires a global RegExp");
        }
        return source.replace(search, replacement);
      }
      return source.split(String(search)).join(String(replacement));
    };
  }

  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;

  function applyIosInputZoomFix() {
    const ua = String(navigator.userAgent || "");
    const isIosDevice =
      /iPhone|iPad|iPod/i.test(ua) ||
      (navigator.platform === "MacIntel" && Number(navigator.maxTouchPoints || 0) > 1);
    if (!isIosDevice) return;

    const viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) return;

    const baseContent = "width=device-width, initial-scale=1, viewport-fit=cover";
    // Prevent iOS WebView auto-zoom when focusing inputs in profile forms.
    viewport.setAttribute("content", `${baseContent}, maximum-scale=1`);
  }

  applyIosInputZoomFix();

  if (tg) {
    tg.ready();
    tg.expand();
  }

  const query = new URLSearchParams(window.location.search);
  const tgInitUserId = Number((tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.id) || 0);
  const tgInitChatId = Number((tg && tg.initDataUnsafe && tg.initDataUnsafe.chat && tg.initDataUnsafe.chat.id) || 0);
  const chatId = Number(query.get("chat_id") || String(tgInitChatId || 0));
  const currentUserId = Number(query.get("user_id") || String(tgInitUserId || 0));
  const apiBaseParam = String(query.get("api_base") || "").trim();

  const state = {
    chatId,
    currentUserId,
    scope: "all",
    period: "today",
    start: null,
    end: null,
    selectedAnalytics: "expense",
    scopeOptions: [
      { key: "all", label: "Общие расходы" },
      { key: "family", label: "Семейные расходы" },
    ],
    memberOptions: [],
    chartItems: [],
    chartTotal: 0,
    activeCategoryKey: null,
    currentTransactions: [],
    transactionsTypeFilter: "all",
    comparison: null,
    analyticsPage: {
      initialized: false,
      report: null,
      scopeBeforeOpen: null,
    },
    categoriesByKind: { expense: [], income: [] },
    addForm: {
      mode: "transaction",
      kind: "expense",
      recipientUserId: "",
      amountText: "",
      description: "",
      categoryKey: "",
      categoryLabel: "",
      categoryManual: false,
      dateValue: "",
      timeValue: "",
    },
    addSubmitting: false,
    screen: "home",
    isLoading: false,
    apiUnavailable: false,
    profile: {
      loaded: false,
      loading: false,
      saving: false,
      data: null,
      detailPage: "",
      supportKind: "message",
      supportMessage: "",
      supportPhotos: [],
      reviewRating: 0,
      reviewComment: "",
      reviewLoadedFromServer: false,
      reviewEditMode: false,
    },
  };

  const els = {
    appRoot: document.getElementById("app"),
    screenTitle: document.getElementById("screenTitle"),
    scopeLabel: document.getElementById("scopeLabel"),
    scopeMenu: document.getElementById("scopeMenu"),
    openScopeBtn: document.getElementById("openScopeBtn"),
    periodLabel: document.getElementById("periodLabel"),
    openDatePanelBtn: document.getElementById("openDatePanelBtn"),
    periodBadgeBtn: document.getElementById("periodBadgeBtn"),
    statusBanner: document.getElementById("statusBanner"),
    dateSheet: document.getElementById("dateSheet"),
    closeDateSheetBtn: document.getElementById("closeDateSheetBtn"),
    applyCustomPeriodBtn: document.getElementById("applyCustomPeriodBtn"),
    customStartDate: document.getElementById("customStartDate"),
    customEndDate: document.getElementById("customEndDate"),
    tabIncome: document.getElementById("tabIncome"),
    tabExpense: document.getElementById("tabExpense"),
    incomeValue: document.getElementById("incomeValue"),
    expenseValue: document.getElementById("expenseValue"),
    familyTransfersValue: document.getElementById("familyTransfersValue"),
    analyticsPanel: document.getElementById("analyticsPanel"),
    recentPanel: document.getElementById("recentPanel"),
    chartSectionTitle: document.getElementById("chartSectionTitle"),
    recentSectionTitle: document.getElementById("recentSectionTitle"),
    breakdownView: document.getElementById("breakdownView"),
    donut: document.getElementById("donut"),
    donutTotal: document.getElementById("donutTotal"),
    donutSub: document.getElementById("donutSub"),
    donutMeta: document.getElementById("donutMeta"),
    chartLegend: document.getElementById("chartLegend"),
    recentList: document.getElementById("recentList"),
    viewAllBtn: document.getElementById("viewAllBtn"),
    transactionsList: document.getElementById("transactionsList"),
    homeScreen: document.getElementById("homeScreen"),
    transactionsScreen: document.getElementById("transactionsScreen"),
    analyticsScreen: document.getElementById("analyticsScreen"),
    balanceTrendSvg: document.getElementById("balanceTrendSvg"),
    balanceTrendLegend: document.getElementById("balanceTrendLegend"),
    analyticsHero: document.getElementById("analyticsHero"),
    analyticsStatus: document.getElementById("analyticsStatus"),
    analyticsForecast: document.getElementById("analyticsForecast"),
    analyticsTrendChanges: document.getElementById("analyticsTrendChanges"),
    analyticsComparisonSection: document.getElementById("analyticsComparisonSection"),
    analyticsComparisonCard: document.getElementById("analyticsComparisonCard"),
    analyticsTopCategories: document.getElementById("analyticsTopCategories"),
    analyticsParticipants: document.getElementById("analyticsParticipants"),
    analyticsInsights: document.getElementById("analyticsInsights"),
    addScreen: document.getElementById("addScreen"),
    profileScreen: document.getElementById("profileScreen"),
    profileDetailScreen: document.getElementById("profileDetailScreen"),
    placeholderScreen: document.getElementById("placeholderScreen"),
    placeholderTitle: document.getElementById("placeholderTitle"),
    profileAvatarImg: document.getElementById("profileAvatarImg"),
    profileAvatarFallback: document.getElementById("profileAvatarFallback"),
    profileDisplayName: document.getElementById("profileDisplayName"),
    profileSubtitle: document.getElementById("profileSubtitle"),
    profileInfoBtn: document.getElementById("profileInfoBtn"),
    profileSettingsBtn: document.getElementById("profileSettingsBtn"),
    profileSupportBtn: document.getElementById("profileSupportBtn"),
    profileInfoMeta: document.getElementById("profileInfoMeta"),
    profileSettingsMeta: document.getElementById("profileSettingsMeta"),
    profileSupportMeta: document.getElementById("profileSupportMeta"),
    profileRateBtn: document.getElementById("profileRateBtn"),
    profileDetailActionsBar: document.getElementById("profileDetailActionsBar"),
    profileDetailBackBtn: document.getElementById("profileDetailBackBtn"),
    profileDetailTitle: document.getElementById("profileDetailTitle"),
    profileDetailSubtitle: document.getElementById("profileDetailSubtitle"),
    profileDetailSaveBtn: document.getElementById("profileDetailSaveBtn"),
    profileDetailInfoPage: document.getElementById("profileDetailInfoPage"),
    profileDetailSettingsPage: document.getElementById("profileDetailSettingsPage"),
    profileDetailSupportPage: document.getElementById("profileDetailSupportPage"),
    profileDetailSupportComposePage: document.getElementById("profileDetailSupportComposePage"),
    profileDetailReviewPage: document.getElementById("profileDetailReviewPage"),
    profileDetailInfoUsername: document.getElementById("profileDetailInfoUsername"),
    profileDetailInfoTelegramId: document.getElementById("profileDetailInfoTelegramId"),
    profileDetailDisplayNameInput: document.getElementById("profileDetailDisplayNameInput"),
    profileDetailPhoneInput: document.getElementById("profileDetailPhoneInput"),
    profileDetailEmailInput: document.getElementById("profileDetailEmailInput"),
    profileDetailBirthDateInput: document.getElementById("profileDetailBirthDateInput"),
    profileDetailCurrencySelect: document.getElementById("profileDetailCurrencySelect"),
    profileDetailLanguageSelect: document.getElementById("profileDetailLanguageSelect"),
    profileDetailOpenDevSupportBtn: document.getElementById("profileDetailOpenDevSupportBtn"),
    profileDetailOpenBugSupportBtn: document.getElementById("profileDetailOpenBugSupportBtn"),
    profileDetailSupportMessageLabel: document.getElementById("profileDetailSupportMessageLabel"),
    profileDetailSupportMessageInput: document.getElementById("profileDetailSupportMessageInput"),
    profileDetailSupportPhotoWrap: document.getElementById("profileDetailSupportPhotoWrap"),
    profileDetailSupportPhotoInput: document.getElementById("profileDetailSupportPhotoInput"),
    profileDetailSupportAttachPhotoBtn: document.getElementById("profileDetailSupportAttachPhotoBtn"),
    profileDetailSupportRemovePhotoBtn: document.getElementById("profileDetailSupportRemovePhotoBtn"),
    profileDetailSupportPhotoMeta: document.getElementById("profileDetailSupportPhotoMeta"),
    profileDetailSupportPhotoGrid: document.getElementById("profileDetailSupportPhotoGrid"),
    profileDetailExistingReviewCard: document.getElementById("profileDetailExistingReviewCard"),
    profileDetailExistingReviewRating: document.getElementById("profileDetailExistingReviewRating"),
    profileDetailExistingReviewComment: document.getElementById("profileDetailExistingReviewComment"),
    profileDetailReviewAgainBtn: document.getElementById("profileDetailReviewAgainBtn"),
    profileDetailRatingStars: document.getElementById("profileDetailRatingStars"),
    profileDetailRatingMeta: document.getElementById("profileDetailRatingMeta"),
    profileDetailReviewCommentInput: document.getElementById("profileDetailReviewCommentInput"),
    addModeTransactionBtn: document.getElementById("addModeTransactionBtn"),
    addModeTransferBtn: document.getElementById("addModeTransferBtn"),
    addKindRow: document.getElementById("addKindRow"),
    addKindExpenseBtn: document.getElementById("addKindExpenseBtn"),
    addKindIncomeBtn: document.getElementById("addKindIncomeBtn"),
    addTransferRecipientField: document.getElementById("addTransferRecipientField"),
    addTransferRecipientSelect: document.getElementById("addTransferRecipientSelect"),
    addAmountInput: document.getElementById("addAmountInput"),
    addDescriptionLabel: document.getElementById("addDescriptionLabel"),
    addDescriptionInput: document.getElementById("addDescriptionInput"),
    addCategoryField: document.getElementById("addCategoryField"),
    addCategoryValue: document.getElementById("addCategoryValue"),
    addChangeCategoryBtn: document.getElementById("addChangeCategoryBtn"),
    addDateInput: document.getElementById("addDateInput"),
    addTimeInput: document.getElementById("addTimeInput"),
    addSaveBtn: document.getElementById("addSaveBtn"),
    categorySheet: document.getElementById("categorySheet"),
    categorySheetList: document.getElementById("categorySheetList"),
    closeCategorySheetBtn: document.getElementById("closeCategorySheetBtn"),
    appToast: document.getElementById("appToast"),
    navHome: document.getElementById("navHome"),
    navTransactions: document.getElementById("navTransactions"),
    navAdd: document.getElementById("navAdd"),
    navConverter: document.getElementById("navConverter"),
    navProfile: document.getElementById("navProfile"),
  };

  els.scopeWrap = els.openScopeBtn ? els.openScopeBtn.closest(".scope-wrap") : null;

  const chartPalette = [
    "#8B95D6",
    "#71B7B2",
    "#F0B27A",
    "#E79BB4",
    "#9BB8E8",
    "#B7A0E8",
    "#8EC5A4",
    "#D7A9C2",
    "#A4B2C8",
    "#C7B28E",
  ];

  const fallbackCategories = {
    expense: [
      { key: "groceries_products", label: "Продукты и быт / Продукты" },
      { key: "cafe_coffee", label: "Кафе и рестораны / Кофе" },
      { key: "transport_taxi", label: "Транспорт / Такси" },
      { key: "home_utilities", label: "Жильё и дом / Коммунальные услуги" },
      { key: "health_tests", label: "Здоровье / Анализы" },
      { key: "expense_other", label: "Прочие расходы" },
    ],
    income: [
      { key: "salary", label: "Зарплата" },
      { key: "bonus", label: "Бонус/премия" },
      { key: "profit", label: "Прибыль" },
      { key: "windfall", label: "Выигрыш/находка" },
      { key: "cashback", label: "Кэшбэк" },
      { key: "income_other", label: "Прочие доходы" },
    ],
  };

  let suggestDebounceTimer = null;
  let toastTimer = null;

  function normalizeApiBase(raw) {
    const value = String(raw || "").trim();
    if (!value) return "";
    return value.replace(/\/+$/, "");
  }

  function buildApiCandidates() {
    const candidates = [];
    const push = (value) => {
      const normalized = normalizeApiBase(value);
      if (!normalized) return;
      if (!candidates.includes(normalized)) {
        candidates.push(normalized);
      }
    };

    push(apiBaseParam);
    const pathname = (window.location.pathname || "").replace(/\/+$/, "");
    if (pathname.startsWith("/miniapp")) {
      push("/miniapp/api");
      push("/api");
    } else {
      push("/api");
      push("/miniapp/api");
    }
    return candidates;
  }

  const apiCandidates = buildApiCandidates();
  const profileLocalSettingsKey = "finbot-miniapp-profile-settings-v1";
  const languageLabels = {
    ru: "Русский",
    uz: "O'zbek tili",
    en: "English",
  };
  const currencyLabels = {
    UZS: "UZS",
    USD: "USD",
    EUR: "EUR",
    RUB: "RUB",
  };
  const supportBugPhotoLimit = 3;
  const supportBugPhotoMaxBytes = 4 * 1024 * 1024;

  const i18n = {
    ru: {
      app_title: "Семейные финансы",
      today: "Сегодня",
      week: "Неделя",
      month: "Месяц",
      year: "Год",
      custom: "Период",
      home: "Главная",
      transactions: "Транзакции",
      analytics: "Аналитика",
      profile: "Профиль",
      add_transaction_title: "Добавить транзакцию",
      scope_all: "Общие расходы",
      scope_family: "Семейные расходы",
      status_need_chat: "Не передан chat_id. Откройте приложение из группы через кнопку бота.",
      status_api_overview_error: "Не удалось загрузить данные. Проверьте API mini-app (домен /api).",
      status_api_transactions_error: "Не удалось загрузить транзакции. Проверьте API mini-app (домен /api).",
      status_api_analytics_error: "Не удалось загрузить аналитику. Проверьте API mini-app (домен /api).",
      empty_no_chat: "Нет данных по текущему чату.",
      empty_overview_error: "Ошибка загрузки отчёта.",
      empty_transactions_error: "Ошибка загрузки транзакций.",
      empty_analytics_error: "Ошибка загрузки аналитики.",
      empty_analytics_no_data: "Нет данных за выбранный период.",
      home_income: "Доходы",
      home_expense: "Расходы",
      home_transfers: "Семейные переводы",
      home_breakdown_expense: "Разбивка расходов",
      home_breakdown_income: "Разбивка доходов",
      donut_total_period: "Всего за период",
      home_recent_expenses: "Последние расходы",
      home_recent_income: "Последние доходы",
      view_all: "Посмотреть все",
      add_mode_transaction: "Транзакция",
      add_mode_transfer: "Перевод средств внутри семьи",
      add_kind_expense: "Расход",
      add_kind_income: "Доход",
      add_recipient: "Кому перевести",
      select_member: "Выберите участника",
      no_second_member: "Нет второго участника",
      add_amount: "Сумма",
      add_description_tx: "Название транзакции",
      add_description_transfer: "Комментарий (необязательно)",
      add_description_placeholder_tx: "Например: коммуналка",
      add_description_placeholder_transfer: "Например: перевод за продукты",
      add_category: "Категория",
      add_change_category: "Изменить категорию",
      add_category_auto: "Определяю автоматически…",
      add_date: "Дата",
      add_time: "Время",
      save: "Сохранить",
      save_transfer: "Сохранить перевод",
      profile_info_title: "Личная информация",
      profile_info_meta_default: "Имя, username и контакты",
      profile_settings_title_row: "Настройки",
      profile_settings_meta_default: "Язык и валюта",
      profile_support_title_row: "Поддержка",
      profile_support_meta_default: "Связь с разработчиком и баг-репорт",
      profile_rate_title: "Оценить бота",
      profile_rate_meta_default: "Оставить оценку и отзыв",
      profile_subtitle_fallback: "Данные Telegram",
      profile_user_fallback: "Пользователь",
      profile_user_number: "Пользователь {id}",
      not_specified: "Не указано",
      settings_currency_label: "Выбор валюты",
      settings_language_label: "Выбор языка",
      settings_hint: "Настройки применяются к вашему профилю в боте и miniapp.",
      support_dev_title: "Связь с разработчиком",
      support_dev_meta: "Написать сообщение разработчику",
      support_bug_title: "Сообщить об ошибке",
      support_bug_meta: "Текст и фото (опционально)",
      support_message_label: "Сообщение",
      support_message_placeholder: "Опишите вопрос или проблему",
      support_attach_photo: "Прикрепить фото",
      support_clear_photo: "Очистить фото",
      support_photo_limit: "Можно добавить до 3 фото (до 4 МБ каждое)",
      support_compose_hint: "Сообщение будет отправлено разработчику прямо из miniapp от имени вашего профиля.",
      review_current_title: "Текущая оценка",
      review_again: "Оценить заново",
      review_rate_prompt: "Поставьте оценку",
      review_meta_default: "Можно оставить комментарий (необязательно).",
      review_comment_label: "Комментарий",
      review_comment_placeholder: "Что понравилось или что улучшить",
      placeholder_soon: "Скоро",
      placeholder_text: "Этот раздел пока пустой. Добавим следующим шагом.",
      fab_add_aria: "Добавить",
      date_range_title: "Диапазон дат",
      date_range_start: "Начало",
      date_range_end: "Конец",
      apply: "Применить",
      close: "Закрыть",
      category_picker_title: "Выберите категорию",
      support_message_to_dev: "Сообщение разработчику",
      support_bug_description: "Описание ошибки",
      support_bug_placeholder: "Что произошло, как повторить, что ожидали увидеть",
      support_message_placeholder_compose: "Напишите сообщение разработчику",
      support_photos_none: "Фото не выбраны",
      support_photos_count: "Добавлено фото: {count}/{limit}",
      photo_alt: "Фото {index}",
      photo_remove_aria: "Удалить фото {index}",
      photo_read_error: "Не удалось прочитать фото",
      contacts_filled: "Контактов заполнено: {count}",
      profile_settings_meta: "{currency} • {language}",
      profile_rate_current: "Текущая оценка: {rating}/5",
      profile_detail_info_title: "Личная информация",
      profile_detail_info_subtitle: "Ваши данные профиля",
      profile_detail_settings_title: "Настройки",
      profile_detail_settings_subtitle: "Язык и валюта",
      profile_detail_support_title: "Поддержка",
      profile_detail_support_subtitle: "Связь с разработчиком и ошибки",
      profile_detail_support_message_title: "Связь с разработчиком",
      profile_detail_support_message_subtitle: "Напишите сообщение",
      profile_detail_support_bug_title: "Сообщить об ошибке",
      profile_detail_support_bug_subtitle: "Описание и фото (опционально)",
      profile_detail_review_title: "Оценить бота",
      profile_detail_review_subtitle: "Оценка и комментарий",
      send: "Отправить",
      send_rating: "Отправить оценку",
      selected_rating: "Выбрано: {rating}/5",
      no_comment: "Без комментария",
      profile_partial_loaded: "Профиль загружен частично (без сервера)",
      saved: "Сохранено",
      save_failed: "Не удалось сохранить. Попробуйте ещё раз.",
      email_check: "Проверьте email",
      birth_date_invalid: "Некорректная дата рождения",
      personal_saved: "Личные данные сохранены",
      settings_saved: "Настройки сохранены",
      support_describe_bug: "Опишите ошибку",
      support_enter_message: "Введите сообщение",
      support_sent_bug: "Ошибка отправлена разработчику",
      support_sent_message: "Сообщение отправлено",
      support_send_failed: "Не удалось отправить сообщение",
      review_choose_rating: "Выберите оценку",
      review_thanks: "Спасибо за оценку",
      review_send_failed: "Не удалось отправить оценку",
      amount_gt_zero: "Введите сумму больше 0",
      pick_date_time: "Укажите дату и время",
      pick_transfer_recipient: "Выберите получателя перевода",
      no_self_transfer: "Нельзя переводить самому себе",
      enter_tx_name: "Введите название транзакции",
      pick_tx_type: "Выберите тип транзакции",
      invalid_datetime: "Некорректная дата или время",
      future_datetime_forbidden: "Нельзя выбрать дату/время в будущем",
      transfer_saved: "Перевод сохранён",
      create_saved: "Сохранено",
      create_error_prefix: "Ошибка: ",
      create_error_fallback: "не удалось сохранить",
      recent_empty_income: "Пока нет доходов за этот период",
      recent_empty_expense: "Пока нет расходов за этот период",
      recent_empty_all: "Пока нет транзакций за этот период",
      add_income: "Добавить доход",
      add_expense: "Добавить расход",
      scope_no_options: "Нет вариантов",
      other: "Прочее",
      api_404: "MiniApp API не обновлён (404). Перезапустите бот и miniapp server.",
      api_support_not_configured: "Поддержка не настроена: проверьте ADMIN_CHAT_ID",
      api_no_connection: "Нет связи с miniapp server",
      api_module_missing: "Модуль аналитики не загружен.",
      api_module_unavailable: "Модуль аналитики недоступен.",
      error: "Ошибка",
      only_images: "Нужны только файлы изображений",
      photo_size_limit: "Каждое фото должно быть до 4 МБ",
      photos_limit_max: "Можно добавить до {limit} фото",
      photos_added_partial: "Добавлено только {count} фото (лимит {limit})",
    },
  };

  i18n.uz = Object.assign({}, i18n.ru, {
    app_title: "Oilaviy moliya",
    today: "Bugun",
    week: "Hafta",
    month: "Oy",
    year: "Yil",
    custom: "Davr",
    home: "Bosh sahifa",
    transactions: "Tranzaksiyalar",
    analytics: "Analitika",
    profile: "Profil",
    add_transaction_title: "Tranzaksiya qo'shish",
    scope_all: "Umumiy xarajatlar",
    scope_family: "Oilaviy xarajatlar",
    home_income: "Daromadlar",
    home_expense: "Xarajatlar",
    home_transfers: "Oilaviy o'tkazmalar",
    view_all: "Barchasini ko'rish",
    save: "Saqlash",
    send: "Yuborish",
    close: "Yopish",
    apply: "Qo'llash",
    profile_settings_title_row: "Sozlamalar",
    profile_support_title_row: "Yordam",
    profile_rate_title: "Botni baholash",
    settings_currency_label: "Valyutani tanlash",
    settings_language_label: "Tilni tanlash",
    settings_hint: "Sozlamalar bot va miniapp profilingizga qo'llanadi.",
    settings_saved: "Sozlamalar saqlandi",
    profile_detail_settings_title: "Sozlamalar",
    profile_detail_settings_subtitle: "Til va valyuta",
    other: "Boshqa",
    language: "Til",
    status_need_chat: "chat_id uzatilmadi. Ilovani guruhdagi bot tugmasi orqali oching.",
    api_no_connection: "miniapp server bilan aloqa yo'q",
  });

  i18n.en = Object.assign({}, i18n.ru, {
    app_title: "Family Finance",
    today: "Today",
    week: "Week",
    month: "Month",
    year: "Year",
    custom: "Period",
    home: "Home",
    transactions: "Transactions",
    analytics: "Analytics",
    profile: "Profile",
    add_transaction_title: "Add transaction",
    scope_all: "All expenses",
    scope_family: "Family expenses",
    home_income: "Income",
    home_expense: "Expenses",
    home_transfers: "Family transfers",
    view_all: "View all",
    save: "Save",
    send: "Send",
    close: "Close",
    apply: "Apply",
    profile_settings_title_row: "Settings",
    profile_support_title_row: "Support",
    profile_rate_title: "Rate the bot",
    settings_currency_label: "Select currency",
    settings_language_label: "Select language",
    settings_hint: "Settings are applied to your profile in the bot and miniapp.",
    settings_saved: "Settings saved",
    profile_detail_settings_title: "Settings",
    profile_detail_settings_subtitle: "Language and currency",
    other: "Other",
    status_need_chat: "chat_id is missing. Open the app from the group using the bot button.",
    api_no_connection: "No connection to miniapp server",
    api_support_not_configured: "Support is not configured: check ADMIN_CHAT_ID",
  });

  function currentLanguageCode() {
    const profileData = state && state.profile && state.profile.data ? state.profile.data : null;
    if (profileData && profileData.language && languageLabels[profileData.language]) {
      return String(profileData.language);
    }
    const local = readLocalProfileSettings();
    if (local && local.language && languageLabels[local.language]) {
      return String(local.language);
    }
    const tgUser = safeTgUser();
    const tgLangRaw = String((tgUser && tgUser.language_code) || "").toLowerCase();
    if (tgLangRaw.startsWith("uz")) return "uz";
    if (tgLangRaw.startsWith("en")) return "en";
    return "ru";
  }

  function uiLocale() {
    const lang = currentLanguageCode();
    if (lang === "uz") return "uz-UZ";
    if (lang === "en") return "en-US";
    return "ru-RU";
  }

  function tr(key, vars) {
    const lang = currentLanguageCode();
    const dict = i18n[lang] || i18n.ru;
    let text = Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : (i18n.ru[key] || key);
    if (vars && text && typeof text === "string") {
      Object.keys(vars).forEach((k) => {
        text = text.replaceAll(`{${k}}`, String(vars[k]));
      });
    }
    return String(text || key);
  }

  function formatDateLabel(value) {
    if (!value) return "";
    const dt = new Date(`${value}T00:00:00`);
    if (Number.isNaN(dt.getTime())) return value;
    return dt.toLocaleDateString(uiLocale());
  }

  function effectiveCurrentUserId() {
    const fromState = Number(state.currentUserId || 0);
    if (fromState > 0) return fromState;
    const tgUser = safeTgUser();
    const fromTg = Number((tgUser && tgUser.id) || 0);
    if (fromTg > 0) {
      state.currentUserId = fromTg;
      return fromTg;
    }
    return 0;
  }

  function effectiveChatId() {
    const fromState = Number(state.chatId || 0);
    if (fromState !== 0) return fromState;
    const fromTgChat = Number((tg && tg.initDataUnsafe && tg.initDataUnsafe.chat && tg.initDataUnsafe.chat.id) || 0);
    if (fromTgChat !== 0) {
      state.chatId = fromTgChat;
      return fromTgChat;
    }
    return 0;
  }

  function updatePeriodLabel() {
    if (state.period === "custom" && state.start && state.end) {
      els.periodLabel.textContent = `${formatDateLabel(state.start)} - ${formatDateLabel(state.end)}`;
      return;
    }
    els.periodLabel.textContent = tr(state.period) || tr("today");
  }

  function setStatusBanner(text, kind) {
    if (!text) {
      els.statusBanner.classList.add("hidden");
      els.statusBanner.classList.remove("error", "info");
      els.statusBanner.textContent = "";
      return;
    }
    els.statusBanner.textContent = text;
    els.statusBanner.classList.remove("hidden");
    els.statusBanner.classList.toggle("error", kind === "error");
    els.statusBanner.classList.toggle("info", kind !== "error");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function lucideSvg(name, attrs) {
    if (!window.lucide || !window.lucide.icons) return "";
    const icon = window.lucide.icons[name];
    if (!icon) return "";
    const options = Object.assign(
      { width: 18, height: 18, "stroke-width": 2, color: "currentColor" },
      attrs || {}
    );
    return icon.toSvg(options);
  }

  function categoryIconName(label, kind) {
    const text = String(label || "").toLowerCase();
    if (kind === "income") return "arrow-down-left";
    if (/(кафе|ресторан|еда|кофе|фастфуд|продукт)/i.test(text)) return "utensils-crossed";
    if (/(транспорт|такси|метро|бензин|авто|парковка)/i.test(text)) return "car";
    if (/(жиль|дом|аренд|ипотек|коммун|ремонт|мебел|техник)/i.test(text)) return "home";
    if (/(здоров|аптек|врач|анализ|стомат|спорт)/i.test(text)) return "heart-pulse";
    if (/(образован|школ|садик|курс|книг)/i.test(text)) return "graduation-cap";
    if (/(финанс|кредит|инвест|долг|банк|сбереж)/i.test(text)) return "wallet";
    if (/(одеж|обув|космет|уход)/i.test(text)) return "shirt";
    if (/(развлеч|игр|кино|путеше|подпис)/i.test(text)) return "sparkles";
    return "receipt";
  }

  function fmtMoney(amount, signed) {
    const absVal = Math.abs(Number(amount || 0));
    const sign = signed ? (amount > 0 ? "+" : amount < 0 ? "-" : "") : "";
    const lang = currentLanguageCode();
    const currencySuffix = lang === "ru" ? "сум" : "so'm";
    return `${sign}${new Intl.NumberFormat(uiLocale()).format(absVal)} ${currencySuffix}`;
  }

  function fmtPercent(value) {
    const pct = Number(value || 0);
    if (!Number.isFinite(pct) || pct <= 0) return "0";
    if (pct < 1) return pct.toFixed(1);
    return String(Math.round(pct));
  }

  function fmtSignedPercent(value) {
    const pct = Number(value || 0);
    if (!Number.isFinite(pct) || pct === 0) return "0%";
    const abs = Math.abs(pct);
    const rendered = abs < 1 ? abs.toFixed(1) : Math.round(abs).toString();
    return `${pct > 0 ? "+" : "-"}${rendered}%`;
  }

  function fmtSignedPercentNullable(value) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
      return "—";
    }
    return fmtSignedPercent(Number(value));
  }

  function analyticsPctClass(value, positiveGood) {
    if (value === null || value === undefined || !Number.isFinite(Number(value)) || Number(value) === 0) {
      return "";
    }
    const next = Number(value);
    const improved = positiveGood ? next > 0 : next < 0;
    return improved ? "up" : "down";
  }

  function analyticsDirectionClass(direction) {
    if (direction === "improved") return "up";
    if (direction === "worse") return "down";
    return "";
  }

  function parseDateOnly(value) {
    if (!value) return null;
    const dt = new Date(`${value}T00:00:00`);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  function toDateOnlyIso(dt) {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function addDays(dt, days) {
    const next = new Date(dt);
    next.setDate(next.getDate() + days);
    return next;
  }

  function diffDaysInclusive(startIso, endIso) {
    const start = parseDateOnly(startIso);
    const end = parseDateOnly(endIso);
    if (!start || !end) return 1;
    const diff = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
    return Math.max(1, diff);
  }

  function periodComparisonLabel(mode) {
    const lang = currentLanguageCode();
    if (lang === "uz") {
      if (mode === "week") return "o'tgan haftaga nisbatan";
      if (mode === "month") return "o'tgan oyga nisbatan";
      if (mode === "year") return "o'tgan yilga nisbatan";
      if (mode === "today") return "kechagi kunga nisbatan";
      return "oldingi davrga nisbatan";
    }
    if (lang === "en") {
      if (mode === "week") return "vs last week";
      if (mode === "month") return "vs last month";
      if (mode === "year") return "vs last year";
      if (mode === "today") return "vs yesterday";
      return "vs previous period";
    }
    if (mode === "week") return "к прошлой неделе";
    if (mode === "month") return "к прошлому месяцу";
    if (mode === "year") return "к прошлому году";
    if (mode === "today") return "к вчерашнему дню";
    return "к прошлому периоду";
  }

  function getComparisonRange(mode, startIso, endIso) {
    const length = diffDaysInclusive(startIso, endIso);
    const currentStart = parseDateOnly(startIso);
    if (!currentStart) {
      return null;
    }
    const prevEnd = addDays(currentStart, -1);
    const prevStart = addDays(prevEnd, -(length - 1));
    return {
      start: toDateOnlyIso(prevStart),
      end: toDateOnlyIso(prevEnd),
      label: periodComparisonLabel(mode),
    };
  }

  function normalizeCategoryKey(label) {
    return String(label || tr("other"))
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function stableColorByCategory(label) {
    const key = normalizeCategoryKey(label);
    let hash = 0;
    for (let i = 0; i < key.length; i += 1) {
      hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    }
    return chartPalette[hash % chartPalette.length];
  }

  function polarToCartesian(cx, cy, radius, angleDeg) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  }

  function buildDonutPath(cx, cy, outerRadius, innerRadius, startAngle, endAngle) {
    const startOuter = polarToCartesian(cx, cy, outerRadius, startAngle);
    const endOuter = polarToCartesian(cx, cy, outerRadius, endAngle);
    const startInner = polarToCartesian(cx, cy, innerRadius, endAngle);
    const endInner = polarToCartesian(cx, cy, innerRadius, startAngle);
    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
    return [
      `M ${startOuter.x} ${startOuter.y}`,
      `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${endOuter.x} ${endOuter.y}`,
      `L ${startInner.x} ${startInner.y}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${endInner.x} ${endInner.y}`,
      "Z",
    ].join(" ");
  }

  function updateDonutCenter(activeItem) {
    const setMoneyCenter = (amountValue) => {
      const amount = Math.abs(Number(amountValue || 0));
      const amountStr = new Intl.NumberFormat(uiLocale()).format(amount);
      const currencySuffix = currentLanguageCode() === "ru" ? "сум" : "so'm";
      const len = amountStr.length;
      els.donutTotal.classList.remove("small", "xsmall");
      if (len >= 11) {
        els.donutTotal.classList.add("xsmall");
      } else if (len >= 9) {
        els.donutTotal.classList.add("small");
      }
      els.donutTotal.innerHTML = `
        <span class="money-amount">${amountStr}</span>
        <span class="money-currency">${escapeHtml(currencySuffix)}</span>
      `;
    };

    const total = Number(state.chartTotal || 0);
    if (activeItem) {
      setMoneyCenter(activeItem.amount);
      els.donutSub.textContent = `${fmtPercent(activeItem.percent)}%`;
      els.donutMeta.textContent = activeItem.label;
      els.donutMeta.classList.remove("hidden");
      return;
    }
    setMoneyCenter(total);
    els.donutSub.textContent = tr("donut_total_period");
    els.donutMeta.textContent = "";
    els.donutMeta.classList.add("hidden");
  }

  function renderDonut(items, activeKey) {
    const size = 220;
    const center = size / 2;
    const outerRadius = 100;
    const innerRadius = 70;

    if (!items.length) {
      els.donut.innerHTML = `
        <svg viewBox="0 0 ${size} ${size}" role="img" aria-label="${escapeHtml(tr('home_breakdown_expense'))}">
          <circle class="donut-track" cx="${center}" cy="${center}" r="${(outerRadius + innerRadius) / 2}" />
        </svg>
      `;
      return;
    }

    let angle = 0;
    const gapAngle = items.length > 1 ? 1.4 : 0;
    const segments = items
      .map((item) => {
        const sweep = state.chartTotal > 0 ? (item.amount / state.chartTotal) * 360 : 0;
        if (sweep <= 0) {
          return "";
        }

        const start = angle;
        const end = angle + sweep;
        angle = end;

        const drawStart = end - start > gapAngle ? start + gapAngle / 2 : start;
        const drawEnd = end - start > gapAngle ? end - gapAngle / 2 : end;
        const isActive = Boolean(activeKey) && item.key === activeKey;
        const isDim = Boolean(activeKey) && item.key !== activeKey;
        const className = [
          "donut-segment",
          isActive ? "is-active" : "",
          isDim ? "is-dim" : "",
        ]
          .filter(Boolean)
          .join(" ");

        if (sweep >= 359.9) {
          return `
            <g class="${className}" style="transform-origin:${center}px ${center}px">
              <circle
                cx="${center}"
                cy="${center}"
                r="${(outerRadius + innerRadius) / 2}"
                fill="none"
                stroke="${item.color}"
                stroke-width="${outerRadius - innerRadius}"
              />
            </g>
          `;
        }

        const d = buildDonutPath(center, center, outerRadius, innerRadius, drawStart, drawEnd);
        return `
          <g class="${className}" style="transform-origin:${center}px ${center}px">
            <path d="${d}" fill="${item.color}"></path>
          </g>
        `;
      })
      .join("");

    els.donut.innerHTML = `
      <svg viewBox="0 0 ${size} ${size}" role="img" aria-label="${escapeHtml(tr('home_breakdown_expense'))}">
        <circle class="donut-track" cx="${center}" cy="${center}" r="${(outerRadius + innerRadius) / 2}" />
        ${segments}
      </svg>
    `;
  }

  function renderLegend(items, activeKey) {
    els.chartLegend.innerHTML = "";
    if (!items.length) {
      const emptyText =
        currentLanguageCode() === "ru"
          ? "Нет данных по категориям."
          : currentLanguageCode() === "uz"
            ? "Kategoriyalar bo'yicha ma'lumot yo'q."
            : "No category data.";
      els.chartLegend.innerHTML = `<div class="empty">${escapeHtml(emptyText)}</div>`;
      return;
    }

    items.forEach((item) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "legend-item" + (activeKey === item.key ? " active" : "");
      row.innerHTML = `
        <span class="legend-left">
          <span class="legend-marker" style="background:${item.color}"></span>
          <span class="legend-name">${escapeHtml(item.label)}</span>
        </span>
        <span class="legend-right">${fmtMoney(item.amount, false)} • ${fmtPercent(item.percent)}%</span>
      `;
      row.addEventListener("click", () => {
        state.activeCategoryKey = state.activeCategoryKey === item.key ? null : item.key;
        renderInteractiveChart();
      });
      els.chartLegend.appendChild(row);
    });
  }

  function renderInteractiveChart() {
    const items = Array.isArray(state.chartItems) ? state.chartItems : [];
    const hasActive = items.some((item) => item.key === state.activeCategoryKey);
    if (!hasActive) {
      state.activeCategoryKey = null;
    }
    const activeItem = items.find((item) => item.key === state.activeCategoryKey) || null;
    renderDonut(items, state.activeCategoryKey);
    renderLegend(items, state.activeCategoryKey);
    updateDonutCenter(activeItem);
  }

  function fmtDateTime(iso) {
    const dt = new Date(iso);
    const now = new Date();
    const sameDay = dt.toDateString() === now.toDateString();
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    const isYesterday = dt.toDateString() === y.toDateString();
    const hh = String(dt.getHours()).padStart(2, "0");
    const mm = String(dt.getMinutes()).padStart(2, "0");
    if (sameDay) return `${tr("today")}, ${hh}:${mm}`;
    if (isYesterday) {
      const yesterdayLabel = currentLanguageCode() === "ru" ? "Вчера" : (currentLanguageCode() === "uz" ? "Kecha" : "Yesterday");
      return `${yesterdayLabel}, ${hh}:${mm}`;
    }
    return `${dt.toLocaleDateString(uiLocale())} ${hh}:${mm}`;
  }

  function buildApiParams(overrides) {
    const opts = Object.assign(
      {
        chatId: effectiveChatId(),
        scope: state.scope,
        period: state.period,
        start: state.start,
        end: state.end,
      },
      overrides || {}
    );

    const params = new URLSearchParams();
    params.set("chat_id", String(opts.chatId || 0));
    params.set("user_id", String(effectiveCurrentUserId() || 0));
    params.set("scope", String(opts.scope || "all"));
    params.set("period", String(opts.period || "today"));
    if (opts.period === "custom" && opts.start && opts.end) {
      params.set("start", String(opts.start));
      params.set("end", String(opts.end));
    }
    return params.toString();
  }

  async function fetchJsonWithFallback(endpoint, overrides) {
    const suffix = endpoint.replace(/^\/+/, "");
    const qs = buildApiParams(overrides);
    let lastError = null;
    for (const base of apiCandidates) {
      const url = `${base}/${suffix}?${qs}`;
      try {
        const resp = await fetch(url, { cache: "no-store" });
        if (!resp.ok) {
          lastError = new Error(`HTTP ${resp.status}: ${url}`);
          continue;
        }
        return await resp.json();
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error("api unavailable");
  }

  function buildPostQuery() {
    const params = new URLSearchParams();
    params.set("chat_id", String(effectiveChatId() || 0));
    params.set("user_id", String(effectiveCurrentUserId() || 0));
    return params.toString();
  }

  async function postJsonWithFallback(endpoint, payload) {
    const suffix = endpoint.replace(/^\/+/, "");
    const qs = buildPostQuery();
    let lastError = null;
    for (const base of apiCandidates) {
      const url = `${base}/${suffix}?${qs}`;
      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload || {}),
          cache: "no-store",
        });
        if (!resp.ok) {
          const errPayload = await resp.json().catch(() => ({}));
          const message = errPayload && errPayload.error ? String(errPayload.error) : `HTTP ${resp.status}`;
          lastError = new Error(message);
          continue;
        }
        return await resp.json();
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error("api unavailable");
  }

  function parseAmountInput(value) {
    const raw = String(value || "")
      .replace(/[^\d]/g, "")
      .trim();
    if (!raw) return 0;
    return Number(raw);
  }

  function formatAmountInput(value) {
    const digits = String(value || "").replace(/[^\d]/g, "");
    if (!digits) return "";
    return new Intl.NumberFormat(uiLocale()).format(Number(digits));
  }

  function nowLocalDateTimeParts() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    return {
      date: `${yyyy}-${mm}-${dd}`,
      time: `${hh}:${min}`,
    };
  }

  function clampFutureDateTime(dateValue, timeValue) {
    const now = new Date();
    const selected = new Date(`${dateValue}T${timeValue}`);
    if (Number.isNaN(selected.getTime()) || selected <= now) {
      return { date: dateValue, time: timeValue };
    }
    const nowParts = nowLocalDateTimeParts();
    return { date: nowParts.date, time: nowParts.time };
  }

  function showToast(message) {
    if (!message) return;
    if (toastTimer) {
      clearTimeout(toastTimer);
    }
    els.appToast.textContent = message;
    els.appToast.classList.remove("hidden");
    toastTimer = setTimeout(() => {
      els.appToast.classList.add("hidden");
      els.appToast.textContent = "";
    }, 2600);
  }

  function userFacingApiError(err, fallbackText) {
    const raw = String((err && err.message) || "").trim();
    if (!raw) return String(fallbackText || tr("error"));
    if (/HTTP 404\b/i.test(raw)) {
      return tr("api_404");
    }
    if (/support chat is not configured/i.test(raw)) {
      return tr("api_support_not_configured");
    }
    if (/Failed to fetch|NetworkError|api unavailable/i.test(raw)) {
      return tr("api_no_connection");
    }
    return raw;
  }

  function safeTgUser() {
    const user = tg && tg.initDataUnsafe ? tg.initDataUnsafe.user : null;
    if (!user || typeof user !== "object") return null;
    return user;
  }

  function safeTgReceiverUsername() {
    const raw = tg && tg.initDataUnsafe ? tg.initDataUnsafe.receiver : null;
    if (!raw || typeof raw !== "object") return "";
    const username = String(raw.username || "").trim().replace(/^@+/, "");
    return username;
  }

  function readLocalProfileSettings() {
    try {
      const raw = window.localStorage.getItem(profileLocalSettingsKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return {};
      return parsed;
    } catch (_err) {
      return {};
    }
  }

  function writeLocalProfileSettings(next) {
    try {
      window.localStorage.setItem(profileLocalSettingsKey, JSON.stringify(next || {}));
    } catch (_err) {
      // ignore storage failures in Mini App webview
    }
  }

  function normalizeLanguageCode(value) {
    const code = String(value || "").trim().toLowerCase();
    if (code in languageLabels) return code;
    return "ru";
  }

  function normalizeCurrencyCode(value) {
    const code = String(value || "").trim().toUpperCase();
    if (code in currencyLabels) return code;
    return "UZS";
  }

  function profileUserView() {
    const tgUser = safeTgUser();
    const firstName = String((tgUser && tgUser.first_name) || "").trim();
    const lastName = String((tgUser && tgUser.last_name) || "").trim();
    const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
    const username = String((tgUser && tgUser.username) || "").trim();
    const telegramId = Number((tgUser && tgUser.id) || state.currentUserId || 0) || 0;
    const photoUrl = String((tgUser && tgUser.photo_url) || "").trim();
    return {
      fullName,
      firstName,
      lastName,
      username,
      telegramId,
      photoUrl,
    };
  }

  function profileInitials() {
    const user = profileUserView();
    const source = user.fullName || user.username || tr("profile_user_fallback");
    const parts = source
      .replace(/^@+/, "")
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length === 0) return "F";
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
  }

  function profileDisplayNameValue() {
    const profileData = state.profile.data || {};
    const savedDisplayName = String(profileData.display_name || "").trim();
    if (savedDisplayName) return savedDisplayName;
    const memberName = String(profileData.member_name || "").trim();
    if (memberName) return memberName;
    const tgUser = profileUserView();
    if (tgUser.fullName) return tgUser.fullName;
    if (tgUser.username) return `@${tgUser.username}`;
    return tr("profile_user_number", { id: tgUser.telegramId || "" }).trim();
  }

  function profileSubtitleValue() {
    const tgUser = profileUserView();
    const parts = [];
    if (tgUser.username) parts.push(`@${tgUser.username}`);
    if (tgUser.telegramId) parts.push(`ID ${tgUser.telegramId}`);
    if (parts.length === 0) return tr("profile_subtitle_fallback");
    return parts.join(" • ");
  }

  function profileFieldValue(value, fallback) {
    const text = String(value || "").trim();
    return text || (fallback || tr("not_specified"));
  }

  function normalizeBirthDateForStorage(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (match) {
      const [, y, m, d] = match;
      const parsed = new Date(`${y}-${m}-${d}T00:00:00`);
      if (!Number.isNaN(parsed.getTime())) return `${y}-${m}-${d}`;
    }
    match = /^(\d{2})[-/.](\d{2})[-/.](\d{4})$/.exec(raw);
    if (match) {
      const [, d, m, y] = match;
      const parsed = new Date(`${y}-${m}-${d}T00:00:00`);
      if (!Number.isNaN(parsed.getTime())) return `${y}-${m}-${d}`;
    }
    return raw;
  }

  function birthDateForInput(value) {
    const normalized = normalizeBirthDateForStorage(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
    return "";
  }

  function supportPhotoItems() {
    if (!Array.isArray(state.profile.supportPhotos)) {
      state.profile.supportPhotos = [];
    }
    return state.profile.supportPhotos;
  }

  function renderSupportPhotoState() {
    const isBug = state.profile.supportKind === "bug";
    const photos = supportPhotoItems();
    const photoCount = photos.length;
    const hasPhoto = photoCount > 0;
    els.profileDetailSupportPhotoWrap.classList.toggle("hidden", !isBug);
    els.profileDetailSupportRemovePhotoBtn.classList.toggle("hidden", !hasPhoto);
    els.profileDetailSupportAttachPhotoBtn.disabled = !isBug || photoCount >= supportBugPhotoLimit;
    if (!isBug) {
      return;
    }

    if (hasPhoto) {
      els.profileDetailSupportPhotoMeta.textContent = tr("support_photos_count", {
        count: photoCount,
        limit: supportBugPhotoLimit,
      });
    } else {
      els.profileDetailSupportPhotoMeta.textContent = tr("support_photos_none");
    }

    if (!els.profileDetailSupportPhotoGrid) return;
    els.profileDetailSupportPhotoGrid.innerHTML = "";
    els.profileDetailSupportPhotoGrid.classList.toggle("hidden", !hasPhoto);
    photos.forEach((photo, index) => {
      const item = document.createElement("div");
      item.className = "profile-photo-item";

      const thumb = document.createElement("img");
      thumb.className = "profile-photo-thumb";
      thumb.alt = tr("photo_alt", { index: index + 1 });
      thumb.src = String((photo && photo.dataUrl) || "");

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "profile-photo-remove-btn";
      removeBtn.setAttribute("aria-label", tr("photo_remove_aria", { index: index + 1 }));
      removeBtn.textContent = "×";
      removeBtn.addEventListener("click", () => {
        removeSupportPhotoAt(index);
      });

      const name = document.createElement("div");
      name.className = "profile-photo-item-name";
      name.textContent = String((photo && photo.name) || tr("photo_alt", { index: index + 1 }));

      item.appendChild(thumb);
      item.appendChild(removeBtn);
      item.appendChild(name);
      els.profileDetailSupportPhotoGrid.appendChild(item);
    });
  }

  function clearSupportPhoto() {
    state.profile.supportPhotos = [];
    if (els.profileDetailSupportPhotoInput) {
      els.profileDetailSupportPhotoInput.value = "";
    }
    renderSupportPhotoState();
  }

  function removeSupportPhotoAt(index) {
    const photos = supportPhotoItems();
    if (index < 0 || index >= photos.length) return;
    photos.splice(index, 1);
    if (els.profileDetailSupportPhotoInput) {
      els.profileDetailSupportPhotoInput.value = "";
    }
    renderSupportPhotoState();
  }

  function readImageFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        if (!result.startsWith("data:")) {
          reject(new Error(tr("photo_read_error")));
          return;
        }
        resolve(result);
      };
      reader.onerror = () => {
        reject(new Error(tr("photo_read_error")));
      };
      reader.readAsDataURL(file);
    });
  }

  function renderProfileHeader() {
    const user = profileUserView();
    els.profileDisplayName.textContent = profileDisplayNameValue();
    els.profileSubtitle.textContent = profileSubtitleValue();
    els.profileAvatarFallback.textContent = profileInitials();
    if (user.photoUrl) {
      els.profileAvatarImg.src = user.photoUrl;
      els.profileAvatarImg.classList.remove("hidden");
      els.profileAvatarFallback.classList.add("hidden");
    } else {
      els.profileAvatarImg.removeAttribute("src");
      els.profileAvatarImg.classList.add("hidden");
      els.profileAvatarFallback.classList.remove("hidden");
    }
  }

  function normalizeProfileData(raw) {
    const local = readLocalProfileSettings();
    const tgUser = safeTgUser();
    const base = raw && typeof raw === "object" ? raw : {};
    const out = Object.assign({}, base);
    out.language = normalizeLanguageCode(out.language || local.language || (tgUser && tgUser.language_code) || "ru");
    out.currency = normalizeCurrencyCode(out.currency || local.currency || "UZS");
    out.display_name = String(out.display_name || "");
    out.phone = String(out.phone || "");
    out.email = String(out.email || "");
    out.birth_date = normalizeBirthDateForStorage(out.birth_date || "");
    out.member_name = String(out.member_name || "");
    if (out.latest_review && typeof out.latest_review === "object") {
      const rating = Number(out.latest_review.rating || 0);
      out.latest_review = {
        rating: rating >= 1 && rating <= 5 ? rating : 0,
        comment: String(out.latest_review.comment || ""),
        created_at: String(out.latest_review.created_at || ""),
      };
    } else {
      out.latest_review = null;
    }
    return out;
  }

  function persistLocalProfileSettingsFromData() {
    const profileData = normalizeProfileData(state.profile.data || {});
    state.profile.data = profileData;
    writeLocalProfileSettings({
      language: profileData.language,
      currency: profileData.currency,
    });
  }

  function setNodeText(node, value) {
    if (!node) return;
    node.textContent = String(value || "");
  }

  function setNodePlaceholder(node, value) {
    if (!node) return;
    node.placeholder = String(value || "");
  }

  function applyUiLanguage() {
    const lang = currentLanguageCode();
    document.documentElement.lang = lang;
    document.title = tr("app_title");

    if (Array.isArray(state.scopeOptions)) {
      state.scopeOptions = state.scopeOptions.map((item) => {
        const key = String((item && item.key) || "");
        if (key === "all") return Object.assign({}, item, { label: tr("scope_all") });
        if (key === "family") return Object.assign({}, item, { label: tr("scope_family") });
        return item;
      });
    }
    const currentScopeOption = (state.scopeOptions || []).find((item) => String(item.key || "") === String(state.scope || ""));
    if (currentScopeOption && els.scopeLabel) {
      els.scopeLabel.textContent = String(currentScopeOption.label || tr("scope_all"));
    } else if (els.scopeLabel) {
      els.scopeLabel.textContent = tr("scope_all");
    }

    if (els.screenTitle) {
      if (state.screen === "transactions") els.screenTitle.textContent = tr("transactions");
      else if (state.screen === "analytics") els.screenTitle.textContent = tr("analytics");
      else if (state.screen === "profile" || state.screen === "profile-detail") els.screenTitle.textContent = tr("profile");
      else if (state.screen === "add") els.screenTitle.textContent = tr("add_transaction_title");
      else els.screenTitle.textContent = tr("home");
    }

    setNodeText(els.tabIncome && els.tabIncome.querySelector(".card-title"), tr("home_income"));
    setNodeText(els.tabExpense && els.tabExpense.querySelector(".card-title"), tr("home_expense"));
    setNodeText(
      els.familyTransfersValue && els.familyTransfersValue.closest(".card") && els.familyTransfersValue.closest(".card").querySelector(".card-title"),
      tr("home_transfers")
    );
    setNodeText(els.viewAllBtn, tr("view_all"));
    setNodeText(els.addModeTransactionBtn, tr("add_mode_transaction"));
    setNodeText(els.addModeTransferBtn, tr("add_mode_transfer"));
    setNodeText(els.addKindExpenseBtn, tr("add_kind_expense"));
    setNodeText(els.addKindIncomeBtn, tr("add_kind_income"));
    setNodeText(els.addDescriptionLabel, state.addForm.mode === "transfer" ? tr("add_description_transfer") : tr("add_description_tx"));
    setNodePlaceholder(
      els.addDescriptionInput,
      state.addForm.mode === "transfer" ? tr("add_description_placeholder_transfer") : tr("add_description_placeholder_tx")
    );
    setNodeText(els.addChangeCategoryBtn, tr("add_change_category"));
    setNodeText(document.querySelector("#addTransferRecipientField .field-label"), tr("add_recipient"));
    setNodeText(els.addAmountInput && els.addAmountInput.closest(".field") && els.addAmountInput.closest(".field").querySelector(".field-label"), tr("add_amount"));
    setNodeText(document.querySelector("#addCategoryField .field-label"), tr("add_category"));
    setNodeText(els.addDateInput && els.addDateInput.closest(".field") && els.addDateInput.closest(".field").querySelector(".field-label"), tr("add_date"));
    setNodeText(els.addTimeInput && els.addTimeInput.closest(".field") && els.addTimeInput.closest(".field").querySelector(".field-label"), tr("add_time"));
    setNodeText(document.querySelector("#homeScreen .panel-head #chartSectionTitle"), tr(state.selectedAnalytics === "income" ? "home_breakdown_income" : "home_breakdown_expense"));
    setNodeText(document.querySelector("#homeScreen .panel-head #recentSectionTitle"), tr(state.selectedAnalytics === "income" ? "home_recent_income" : "home_recent_expenses"));
    setNodeText(els.donutSub, tr("donut_total_period"));

    setNodeText(els.profileInfoBtn && els.profileInfoBtn.querySelector(".profile-row-title"), tr("profile_info_title"));
    setNodeText(els.profileSettingsBtn && els.profileSettingsBtn.querySelector(".profile-row-title"), tr("profile_settings_title_row"));
    setNodeText(els.profileSupportBtn && els.profileSupportBtn.querySelector(".profile-row-title"), tr("profile_support_title_row"));
    setNodeText(els.profileRateBtn && els.profileRateBtn.querySelector(".profile-row-title"), tr("profile_rate_title"));
    setNodeText(els.profileDetailOpenDevSupportBtn && els.profileDetailOpenDevSupportBtn.querySelector(".profile-row-title"), tr("support_dev_title"));
    setNodeText(els.profileDetailOpenDevSupportBtn && els.profileDetailOpenDevSupportBtn.querySelector(".profile-row-meta"), tr("support_dev_meta"));
    setNodeText(els.profileDetailOpenBugSupportBtn && els.profileDetailOpenBugSupportBtn.querySelector(".profile-row-title"), tr("support_bug_title"));
    setNodeText(els.profileDetailOpenBugSupportBtn && els.profileDetailOpenBugSupportBtn.querySelector(".profile-row-meta"), tr("support_bug_meta"));
    setNodePlaceholder(els.profileDetailSupportMessageInput, tr("support_message_placeholder"));
    setNodeText(els.profileDetailSupportAttachPhotoBtn, tr("support_attach_photo"));
    setNodeText(els.profileDetailSupportRemovePhotoBtn, tr("support_clear_photo"));
    setNodeText(document.querySelector(".profile-photo-limit-note"), tr("support_photo_limit"));
    setNodeText(document.querySelector("#profileDetailSupportComposePage .profile-hint"), tr("support_compose_hint"));
    setNodeText(document.querySelector("#profileDetailReviewPage .profile-existing-review-title"), tr("review_current_title"));
    setNodeText(els.profileDetailReviewAgainBtn, tr("review_again"));
    setNodeText(document.querySelector("#profileDetailReviewPage .profile-rating-label"), tr("review_rate_prompt"));
    setNodeText(els.profileDetailRatingMeta, state.profile.reviewRating > 0 ? tr("selected_rating", { rating: state.profile.reviewRating }) : tr("review_meta_default"));
    setNodeText(els.profileDetailReviewCommentInput && els.profileDetailReviewCommentInput.closest(".field") && els.profileDetailReviewCommentInput.closest(".field").querySelector(".field-label"), tr("review_comment_label"));
    setNodePlaceholder(els.profileDetailReviewCommentInput, tr("review_comment_placeholder"));

    const settingsLabels = document.querySelectorAll("#profileDetailSettingsPage .field-label");
    if (settingsLabels[0]) settingsLabels[0].textContent = tr("settings_currency_label");
    if (settingsLabels[1]) settingsLabels[1].textContent = tr("settings_language_label");
    setNodeText(document.querySelector("#profileDetailSettingsPage .profile-hint"), tr("settings_hint"));
    if (els.profileDetailLanguageSelect) {
      Array.from(els.profileDetailLanguageSelect.options || []).forEach((opt) => {
        const code = String(opt.value || "");
        if (languageLabels[code]) opt.textContent = languageLabels[code];
      });
    }
    if (els.profileDetailCurrencySelect) {
      const uzsOption = Array.from(els.profileDetailCurrencySelect.options || []).find((opt) => String(opt.value) === "UZS");
      if (uzsOption) {
        uzsOption.textContent = lang === "ru" ? "UZS (сум)" : "UZS (so'm)";
      }
    }

    setNodeText(els.placeholderTitle, tr("placeholder_soon"));
    setNodeText(document.querySelector("#placeholderScreen p"), tr("placeholder_text"));
    setNodeText(document.querySelector("#transactionsScreen .panel-head h2"), tr("transactions"));
    setNodeText(document.querySelector("#analyticsScreen section:nth-of-type(2) .panel-head h2"), lang === "ru" ? "Динамика расходов и доходов" : (lang === "uz" ? "Xarajat va daromad dinamikasi" : "Expense and income trend"));
    setNodeText(document.querySelector("#analyticsComparisonSection .panel-head h2"), lang === "ru" ? "Сравнение периодов" : (lang === "uz" ? "Davrlarni solishtirish" : "Period comparison"));
    setNodeText(document.querySelector("#analyticsScreen section:nth-of-type(4) .panel-head h2"), lang === "ru" ? "Категории расходов" : (lang === "uz" ? "Xarajat kategoriyalari" : "Expense categories"));
    setNodeText(document.querySelector("#analyticsScreen section:nth-of-type(5) .panel-head h2"), lang === "ru" ? "Семейная аналитика" : (lang === "uz" ? "Oilaviy analitika" : "Family analytics"));
    setNodeText(document.querySelector("#analyticsScreen section:nth-of-type(6) .panel-head h2"), lang === "ru" ? "Инсайты" : (lang === "uz" ? "Insightlar" : "Insights"));

    setNodeText(els.navHome && els.navHome.querySelector(".txt"), tr("home"));
    setNodeText(els.navTransactions && els.navTransactions.querySelector(".txt"), tr("transactions"));
    setNodeText(els.navConverter && els.navConverter.querySelector(".txt"), tr("analytics"));
    setNodeText(els.navProfile && els.navProfile.querySelector(".txt"), tr("profile"));
    if (els.navAdd) {
      els.navAdd.setAttribute("aria-label", tr("fab_add_aria"));
    }

    setNodeText(document.querySelector("#dateSheet h3"), tr("date_range_title"));
    const quickBtns = Array.from(document.querySelectorAll("#dateSheet .quick-btn"));
    quickBtns.forEach((btn) => {
      const key = String(btn.dataset.period || "");
      if (key) btn.textContent = tr(key);
    });
    const rangeLabels = Array.from(document.querySelectorAll("#dateSheet .range-row label"));
    if (rangeLabels[0] && rangeLabels[0].childNodes[0]) rangeLabels[0].childNodes[0].nodeValue = `${tr("date_range_start")}\n            `;
    if (rangeLabels[1] && rangeLabels[1].childNodes[0]) rangeLabels[1].childNodes[0].nodeValue = `${tr("date_range_end")}\n            `;
    setNodeText(els.applyCustomPeriodBtn, tr("apply"));
    setNodeText(els.closeDateSheetBtn, tr("close"));
    setNodeText(document.querySelector("#categorySheet h3"), tr("category_picker_title"));
    setNodeText(els.closeCategorySheetBtn, tr("close"));

    updatePeriodLabel();
  }

  function updateProfileSectionMeta() {
    const profileData = normalizeProfileData(state.profile.data || {});
    state.profile.data = profileData;
    const hasPhone = String(profileData.phone || "").trim();
    const hasEmail = String(profileData.email || "").trim();
    const contactsCount = [hasPhone, hasEmail].filter(Boolean).length;
    els.profileInfoMeta.textContent = contactsCount
      ? tr("contacts_filled", { count: contactsCount })
      : tr("profile_info_meta_default");
    els.profileSettingsMeta.textContent = tr("profile_settings_meta", {
      currency: currencyLabels[profileData.currency],
      language: languageLabels[profileData.language],
    });
    els.profileSupportMeta.textContent = tr("profile_support_meta_default");

    const latestReview = profileData.latest_review;
    if (latestReview && Number(latestReview.rating || 0) >= 1) {
      els.profileRateBtn.querySelector(".profile-row-meta").textContent = tr("profile_rate_current", {
        rating: latestReview.rating,
      });
    } else {
      els.profileRateBtn.querySelector(".profile-row-meta").textContent = tr("profile_rate_meta_default");
    }
  }

  function renderProfileScreen() {
    if (!els.profileScreen) return;
    applyUiLanguage();
    renderProfileHeader();
    updateProfileSectionMeta();
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }

  function profileDetailPageConfig(page) {
    if (page === "support-message") {
      return {
        title: tr("profile_detail_support_message_title"),
        subtitle: tr("profile_detail_support_message_subtitle"),
        actionLabel: tr("send"),
      };
    }
    if (page === "support-bug") {
      return {
        title: tr("profile_detail_support_bug_title"),
        subtitle: tr("profile_detail_support_bug_subtitle"),
        actionLabel: tr("send"),
      };
    }
    if (page === "settings") {
      return {
        title: tr("profile_detail_settings_title"),
        subtitle: tr("profile_detail_settings_subtitle"),
        actionLabel: tr("save"),
      };
    }
    if (page === "support") {
      return {
        title: tr("profile_detail_support_title"),
        subtitle: tr("profile_detail_support_subtitle"),
        actionLabel: tr("send"),
      };
    }
    if (page === "review") {
      return {
        title: tr("profile_detail_review_title"),
        subtitle: tr("profile_detail_review_subtitle"),
        actionLabel: tr("send_rating"),
      };
    }
    return {
      title: tr("profile_detail_info_title"),
      subtitle: tr("profile_detail_info_subtitle"),
      actionLabel: tr("save"),
    };
  }

  function setProfileSupportKind(kind) {
    state.profile.supportKind = kind === "bug" ? "bug" : "message";
    const isBug = state.profile.supportKind === "bug";
    els.profileDetailSupportMessageLabel.textContent = isBug ? tr("support_bug_description") : tr("support_message_to_dev");
    els.profileDetailSupportMessageInput.placeholder = isBug
      ? tr("support_bug_placeholder")
      : tr("support_message_placeholder_compose");
    renderSupportPhotoState();
  }

  function setProfileReviewRating(value) {
    const rating = Math.max(0, Math.min(5, Number(value || 0) || 0));
    state.profile.reviewRating = rating;
    const starButtons = els.profileDetailRatingStars
      ? Array.from(els.profileDetailRatingStars.querySelectorAll("[data-rating]"))
      : [];
    starButtons.forEach((btn) => {
      const starValue = Number(btn.dataset.rating || 0);
      btn.classList.toggle("active", starValue > 0 && starValue <= rating);
      btn.setAttribute("aria-checked", starValue === rating ? "true" : "false");
    });
    if (els.profileDetailRatingMeta) {
      els.profileDetailRatingMeta.textContent =
        rating > 0 ? tr("selected_rating", { rating }) : tr("review_meta_default");
    }
  }

  function syncProfileDetailInputsFromState() {
    const profileData = normalizeProfileData(state.profile.data || {});
    state.profile.data = profileData;
    const user = profileUserView();
    const page = state.profile.detailPage || "";

    if (page === "info") {
      els.profileDetailInfoUsername.textContent = user.username ? `@${user.username}` : tr("not_specified");
      els.profileDetailInfoTelegramId.textContent = user.telegramId ? String(user.telegramId) : tr("not_specified");
      els.profileDetailDisplayNameInput.value = String(profileData.display_name || "");
      els.profileDetailPhoneInput.value = String(profileData.phone || "");
      els.profileDetailEmailInput.value = String(profileData.email || "");
      els.profileDetailBirthDateInput.value = birthDateForInput(profileData.birth_date || "");
      return;
    }

    if (page === "settings") {
      els.profileDetailCurrencySelect.value = normalizeCurrencyCode(profileData.currency || "UZS");
      els.profileDetailLanguageSelect.value = normalizeLanguageCode(profileData.language || "ru");
      return;
    }

    if (page === "support-message" || page === "support-bug") {
      setProfileSupportKind(page === "support-bug" ? "bug" : "message");
      els.profileDetailSupportMessageInput.value = String(state.profile.supportMessage || "");
      renderSupportPhotoState();
      return;
    }

    if (page === "support") {
      setProfileSupportKind(state.profile.supportKind || "message");
      return;
    }

    if (page === "review") {
      if (!state.profile.reviewLoadedFromServer) {
        const latest = profileData.latest_review && typeof profileData.latest_review === "object"
          ? profileData.latest_review
          : null;
        state.profile.reviewRating = Number(latest && latest.rating ? latest.rating : 0);
        state.profile.reviewComment = String((latest && latest.comment) || "");
        state.profile.reviewLoadedFromServer = true;
        state.profile.reviewEditMode = !Boolean(latest && Number(latest.rating || 0) >= 1);
      }
      const latest = profileData.latest_review && typeof profileData.latest_review === "object"
        ? profileData.latest_review
        : null;
      const hasExisting = Boolean(latest && Number(latest.rating || 0) >= 1);
      els.profileDetailExistingReviewCard.classList.toggle("hidden", !hasExisting);
      if (hasExisting) {
        els.profileDetailExistingReviewRating.textContent = `${Number(latest.rating || 0)}/5`;
        els.profileDetailExistingReviewComment.textContent = String(latest.comment || "").trim() || tr("no_comment");
      }
      els.profileDetailReviewCommentInput.value = String(state.profile.reviewComment || "");
      setProfileReviewRating(state.profile.reviewRating || 0);
      const ratingWrap = els.profileDetailRatingStars
        ? els.profileDetailRatingStars.closest(".profile-rating-wrap")
        : null;
      if (ratingWrap) {
        ratingWrap.classList.toggle("hidden", hasExisting && !state.profile.reviewEditMode);
      }
      els.profileDetailRatingStars.classList.toggle("hidden", hasExisting && !state.profile.reviewEditMode);
      const reviewCommentField = els.profileDetailReviewCommentInput.closest(".field");
      if (reviewCommentField) {
        reviewCommentField.classList.toggle("hidden", hasExisting && !state.profile.reviewEditMode);
      }
    }
  }

  function renderProfileDetailScreen() {
    applyUiLanguage();
    const page = state.profile.detailPage || "";
    const cfg = profileDetailPageConfig(page);
    els.profileDetailTitle.textContent = cfg.title;
    els.profileDetailSubtitle.textContent = cfg.subtitle;
    els.profileDetailSaveBtn.textContent = cfg.actionLabel;

    els.profileDetailInfoPage.classList.toggle("hidden", page !== "info");
    els.profileDetailSettingsPage.classList.toggle("hidden", page !== "settings");
    els.profileDetailSupportPage.classList.toggle("hidden", page !== "support");
    els.profileDetailSupportComposePage.classList.toggle(
      "hidden",
      !(page === "support-message" || page === "support-bug")
    );
    els.profileDetailReviewPage.classList.toggle("hidden", page !== "review");

    syncProfileDetailInputsFromState();

    const reviewNeedsRating =
      page === "review" &&
      (state.profile.reviewEditMode || !((state.profile.data || {}).latest_review)) &&
      Number(state.profile.reviewRating || 0) <= 0;
    const isActionPage = page !== "support";
    const isDisabled = !isActionPage || state.profile.saving || reviewNeedsRating;
    els.profileDetailSaveBtn.disabled = Boolean(isDisabled);
    els.profileDetailActionsBar.classList.toggle("hidden", page === "support");
    if (page === "review" && !state.profile.reviewEditMode && (state.profile.data || {}).latest_review) {
      els.profileDetailSaveBtn.textContent = tr("review_again");
    }

    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }

  async function loadProfile() {
    if (state.profile.loading) return;
    state.profile.loading = true;
    try {
      const payload = await fetchJsonWithFallback("profile", {
        scope: "all",
        period: "today",
      });
      const profileData = payload && payload.profile && typeof payload.profile === "object" ? payload.profile : {};
      if (payload && typeof payload.member_name === "string") {
        profileData.member_name = payload.member_name;
      }
      if (payload && payload.latest_review && typeof payload.latest_review === "object") {
        profileData.latest_review = payload.latest_review;
      }
      state.profile.data = normalizeProfileData(profileData);
      persistLocalProfileSettingsFromData();
      state.profile.loaded = true;
      state.profile.reviewLoadedFromServer = false;
      renderProfileScreen();
      if (state.screen === "profile-detail") {
        renderProfileDetailScreen();
      }
    } catch (err) {
      state.profile.data = normalizeProfileData(state.profile.data || {});
      state.profile.loaded = true;
      renderProfileScreen();
      if (state.screen === "profile-detail") {
        renderProfileDetailScreen();
      }
      showToast(userFacingApiError(err, tr("profile_partial_loaded")));
    } finally {
      state.profile.loading = false;
    }
  }

  async function saveProfileData(changes, successText) {
    const next = normalizeProfileData(Object.assign({}, state.profile.data || {}, changes || {}));
    state.profile.data = next;
    persistLocalProfileSettingsFromData();
    applyUiLanguage();
    renderProfileScreen();
    renderProfileDetailScreen();

    if (state.profile.saving) return;
    state.profile.saving = true;
    renderProfileDetailScreen();
    try {
      const payload = await postJsonWithFallback("profile", changes || {});
      const profileData = payload && payload.profile && typeof payload.profile === "object" ? payload.profile : {};
      if (payload && typeof payload.member_name === "string") {
        profileData.member_name = payload.member_name;
      }
      if (payload && payload.latest_review && typeof payload.latest_review === "object") {
        profileData.latest_review = payload.latest_review;
      }
      state.profile.data = normalizeProfileData(Object.assign({}, state.profile.data || {}, profileData));
      persistLocalProfileSettingsFromData();
      applyUiLanguage();
      renderProfileScreen();
      renderProfileDetailScreen();
      showToast(successText || tr("saved"));
    } catch (err) {
      console.error("profile save failed", err);
      showToast(userFacingApiError(err, tr("save_failed")));
    } finally {
      state.profile.saving = false;
      renderProfileDetailScreen();
    }
  }

  async function saveProfilePersonalInfo() {
    const displayName = String(els.profileDetailDisplayNameInput.value || "").trim();
    const phone = String(els.profileDetailPhoneInput.value || "").trim();
    const email = String(els.profileDetailEmailInput.value || "").trim();
    const birthDate = normalizeBirthDateForStorage(String(els.profileDetailBirthDateInput.value || "").trim());

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast(tr("email_check"));
      return;
    }
    if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      showToast(tr("birth_date_invalid"));
      return;
    }

    await saveProfileData(
      {
        display_name: displayName,
        phone,
        email,
        birth_date: birthDate,
      },
      tr("personal_saved")
    );
  }

  async function saveProfileSettingsPage() {
    const currency = normalizeCurrencyCode(els.profileDetailCurrencySelect.value);
    const language = normalizeLanguageCode(els.profileDetailLanguageSelect.value);
    await saveProfileData({ currency, language }, tr("settings_saved"));
  }

  async function sendProfileSupport() {
    const kind = state.profile.supportKind === "bug" ? "bug" : "message";
    const message = String(els.profileDetailSupportMessageInput.value || "").trim();
    const supportPhotos = kind === "bug" ? supportPhotoItems() : [];
    const hasPhoto = kind === "bug" && supportPhotos.length > 0;
    if (!message && !(kind === "bug" && hasPhoto)) {
      showToast(kind === "bug" ? tr("support_describe_bug") : tr("support_enter_message"));
      return;
    }
    if (state.profile.saving) return;
    state.profile.saving = true;
    renderProfileDetailScreen();
    try {
      await postJsonWithFallback("support", {
        kind,
        message:
          message ||
          (kind === "bug" && hasPhoto
            ? (currentLanguageCode() === "ru"
                ? "Фото без описания"
                : currentLanguageCode() === "uz"
                  ? "Tavsifsiz foto"
                  : "Photo without description")
            : ""),
        photos:
          kind === "bug"
            ? supportPhotos.map((photo) => ({
                photo_base64: String((photo && photo.dataUrl) || ""),
                photo_name: String((photo && photo.name) || "bug-report.jpg"),
                photo_mime: String((photo && photo.mime) || "image/jpeg"),
              }))
            : [],
      });
      state.profile.supportMessage = "";
      els.profileDetailSupportMessageInput.value = "";
      if (kind === "bug") {
        clearSupportPhoto();
      }
      showToast(kind === "bug" ? tr("support_sent_bug") : tr("support_sent_message"));
    } catch (err) {
      console.error("support send failed", err);
      showToast(userFacingApiError(err, tr("support_send_failed")));
    } finally {
      state.profile.saving = false;
      renderProfileDetailScreen();
    }
  }

  async function submitProfileReview() {
    const rating = Number(state.profile.reviewRating || 0);
    const comment = String(els.profileDetailReviewCommentInput.value || "").trim();
    if (rating < 1 || rating > 5) {
      showToast(tr("review_choose_rating"));
      return;
    }
    if (state.profile.saving) return;
    state.profile.saving = true;
    renderProfileDetailScreen();
    try {
      const payload = await postJsonWithFallback("review", { rating, comment });
      const review = payload && payload.review && typeof payload.review === "object" ? payload.review : null;
      const next = normalizeProfileData(state.profile.data || {});
      if (review) {
        next.latest_review = {
          rating: Number(review.rating || rating),
          comment: String(review.comment || comment || ""),
          created_at: String(review.created_at || ""),
        };
      }
      state.profile.data = next;
      state.profile.reviewComment = comment;
      state.profile.reviewLoadedFromServer = true;
      state.profile.reviewEditMode = false;
      renderProfileScreen();
      renderProfileDetailScreen();
      showToast(tr("review_thanks"));
    } catch (err) {
      console.error("review submit failed", err);
      showToast(userFacingApiError(err, tr("review_send_failed")));
    } finally {
      state.profile.saving = false;
      renderProfileDetailScreen();
    }
  }

  async function submitProfileDetail() {
    const page = state.profile.detailPage || "";
    if (page === "info") {
      await saveProfilePersonalInfo();
      return;
    }
    if (page === "settings") {
      await saveProfileSettingsPage();
      return;
    }
    if (page === "support-message" || page === "support-bug") {
      state.profile.supportMessage = String(els.profileDetailSupportMessageInput.value || "");
      await sendProfileSupport();
      return;
    }
    if (page === "review") {
      if (!state.profile.reviewEditMode && (state.profile.data || {}).latest_review) {
        state.profile.reviewEditMode = true;
        renderProfileDetailScreen();
        return;
      }
      state.profile.reviewComment = String(els.profileDetailReviewCommentInput.value || "");
      await submitProfileReview();
    }
  }

  async function openProfileDetail(page) {
    const normalized =
      page === "settings" ||
      page === "support" ||
      page === "support-message" ||
      page === "support-bug" ||
      page === "review" ||
      page === "info"
        ? page
        : "info";
    state.profile.detailPage = normalized;
    if (normalized === "review") {
      state.profile.reviewLoadedFromServer = false;
      state.profile.reviewEditMode = false;
    }
    els.navAdd.classList.remove("hidden");
    showScreen("profile-detail");
    renderProfileDetailScreen();
    if (!state.profile.loaded) {
      await loadProfile();
    }
  }

  async function openProfileScreen() {
    els.screenTitle.textContent = tr("profile");
    state.profile.detailPage = "";
    els.navAdd.classList.remove("hidden");
    showScreen("profile");
    renderProfileScreen();
    await loadProfile();
  }

  function showScreen(name) {
    const prevScreen = state.screen;
    if (prevScreen === "analytics" && name !== "analytics") {
      const restoreScope = String(state.analyticsPage.scopeBeforeOpen || "").trim();
      if (restoreScope) {
        state.scope = restoreScope;
      const restoreOption = (state.scopeOptions || []).find((item) => String(item.key || "") === restoreScope);
      if (restoreOption && els.scopeLabel) {
          els.scopeLabel.textContent = String(restoreOption.label || tr("scope_all"));
      }
      }
      state.analyticsPage.scopeBeforeOpen = null;
    }
    state.screen = name;
    const isAddScreen = name === "add";
    const isAnalyticsScreen = name === "analytics";
    const isProfileScreen = name === "profile";
    const isProfileDetailScreen = name === "profile-detail";
    els.appRoot.classList.toggle("is-add-screen", isAddScreen);
    els.appRoot.classList.toggle("is-analytics-screen", isAnalyticsScreen);
    els.appRoot.classList.toggle("is-profile-screen", isProfileScreen);
    els.appRoot.classList.toggle("is-profile-detail-screen", isProfileDetailScreen);
    els.homeScreen.classList.toggle("hidden", name !== "home");
    els.transactionsScreen.classList.toggle("hidden", name !== "transactions");
    els.analyticsScreen.classList.toggle("hidden", name !== "analytics");
    els.addScreen.classList.toggle("hidden", name !== "add");
    els.profileScreen.classList.toggle("hidden", name !== "profile");
    els.profileDetailScreen.classList.toggle("hidden", name !== "profile-detail");
    els.placeholderScreen.classList.toggle("hidden", name !== "placeholder");
    els.profileDetailActionsBar.classList.toggle("hidden", name !== "profile-detail");

    els.navHome.classList.toggle("active", name === "home");
    els.navTransactions.classList.toggle("active", name === "transactions");
    els.navAdd.classList.toggle("active", name === "add");
    els.navConverter.classList.toggle("active", name === "analytics");
    els.navProfile.classList.toggle("active", name === "profile" || name === "profile-detail");
    els.navAdd.classList.toggle("hidden", name === "add" || name === "profile-detail");

    if (isAddScreen || isAnalyticsScreen || isProfileScreen || isProfileDetailScreen) {
      closeScopeMenu();
      closeDateSheet();
      setStatusBanner("", "info");
    }
  }

  function showPlaceholder(title) {
    els.placeholderTitle.textContent = title;
    state.screen = "placeholder";
    els.appRoot.classList.remove("is-add-screen", "is-analytics-screen", "is-profile-screen", "is-profile-detail-screen");
    els.homeScreen.classList.add("hidden");
    els.transactionsScreen.classList.add("hidden");
    els.analyticsScreen.classList.add("hidden");
    els.addScreen.classList.add("hidden");
    els.profileScreen.classList.add("hidden");
    els.profileDetailScreen.classList.add("hidden");
    els.placeholderScreen.classList.remove("hidden");
    els.profileDetailActionsBar.classList.add("hidden");

    els.navHome.classList.remove("active");
    els.navTransactions.classList.remove("active");
    els.navAdd.classList.remove("hidden");
    els.navAdd.classList.toggle("active", title === "+");
    els.navConverter.classList.toggle("active", title === tr("analytics"));
    els.navProfile.classList.toggle("active", title === tr("profile"));
  }

  function renderScopeMenu() {
    const selected = state.scope;
    els.scopeMenu.innerHTML = "";
    const options = Array.isArray(state.scopeOptions) ? state.scopeOptions : [];
    if (options.length === 0) {
      const row = document.createElement("div");
      row.className = "scope-empty";
      row.textContent = tr("scope_no_options");
      els.scopeMenu.appendChild(row);
      return;
    }
    options.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "scope-option" + (item.key === selected ? " active" : "");
      btn.textContent = item.label;
      btn.addEventListener("click", () => {
        state.scope = item.key;
        els.scopeLabel.textContent = item.label;
        closeScopeMenu();
        void reloadDataForCurrentScreen();
      });
      els.scopeMenu.appendChild(btn);
    });
  }

  function openScopeMenu() {
    renderScopeMenu();
    els.scopeMenu.classList.remove("hidden");
  }

  function closeScopeMenu() {
    els.scopeMenu.classList.add("hidden");
  }

  function openDateSheet() {
    els.customStartDate.value = state.start || "";
    els.customEndDate.value = state.end || "";
    document.querySelectorAll(".quick-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.period === state.period);
    });
    els.dateSheet.classList.remove("hidden");
  }

  function closeDateSheet() {
    els.dateSheet.classList.add("hidden");
  }

  function parseScopeUserId(key) {
    const value = String(key || "").trim();
    const match = /^user:(\d+)$/.exec(value);
    if (!match) return null;
    const userId = Number(match[1]);
    if (!Number.isFinite(userId) || userId <= 0) return null;
    return userId;
  }

  function extractMemberOptions(scopeOptions) {
    const items = [];
    (scopeOptions || []).forEach((option) => {
      const userId = parseScopeUserId(option && option.key);
      if (!userId) return;
      const fallbackMember =
        currentLanguageCode() === "ru"
          ? `Участник ${userId}`
          : currentLanguageCode() === "uz"
            ? `Ishtirokchi ${userId}`
            : `Member ${userId}`;
      const label = String((option && option.label) || fallbackMember).trim() || fallbackMember;
      items.push({ id: userId, label });
    });
    return items;
  }

  function transferRecipients() {
    return (state.memberOptions || []).filter((item) => Number(item.id) !== Number(state.currentUserId || 0));
  }

  function renderTransferRecipients() {
    const recipients = transferRecipients();
    const currentValue = String(state.addForm.recipientUserId || "");
    els.addTransferRecipientSelect.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = recipients.length ? tr("select_member") : tr("no_second_member");
    els.addTransferRecipientSelect.appendChild(placeholder);

    recipients.forEach((member) => {
      const option = document.createElement("option");
      option.value = String(member.id);
      option.textContent = member.label;
      els.addTransferRecipientSelect.appendChild(option);
    });

    if (currentValue && recipients.some((item) => String(item.id) === currentValue)) {
      els.addTransferRecipientSelect.value = currentValue;
    } else if (recipients.length === 1) {
      const onlyId = String(recipients[0].id);
      state.addForm.recipientUserId = onlyId;
      els.addTransferRecipientSelect.value = onlyId;
    } else {
      state.addForm.recipientUserId = "";
      els.addTransferRecipientSelect.value = "";
    }
  }

  function categoryOptions(kind) {
    const fromApi = state.categoriesByKind && Array.isArray(state.categoriesByKind[kind])
      ? state.categoriesByKind[kind]
      : [];
    if (fromApi.length) return fromApi;
    return fallbackCategories[kind] || [];
  }

  function setAddKind(kind) {
    state.addForm.kind = kind === "income" ? "income" : "expense";
    if (state.addForm.mode === "transaction") {
      state.addForm.categoryManual = false;
      state.addForm.categoryKey = "";
      state.addForm.categoryLabel = "";
    }
    els.addKindExpenseBtn.classList.toggle("active", state.addForm.kind === "expense");
    els.addKindIncomeBtn.classList.toggle("active", state.addForm.kind === "income");
    renderAddCategoryValue();
    if (state.addForm.mode === "transaction") {
      triggerAutoCategoryDebounced();
    }
  }

  function setAddMode(mode) {
    state.addForm.mode = mode === "transfer" ? "transfer" : "transaction";
    const isTransfer = state.addForm.mode === "transfer";

    els.addModeTransactionBtn.classList.toggle("active", !isTransfer);
    els.addModeTransferBtn.classList.toggle("active", isTransfer);
    els.addKindRow.classList.toggle("hidden", isTransfer);
    els.addCategoryField.classList.toggle("hidden", isTransfer);
    els.addTransferRecipientField.classList.toggle("hidden", !isTransfer);

    els.addDescriptionLabel.textContent = isTransfer
      ? tr("add_description_transfer")
      : tr("add_description_tx");
    els.addDescriptionInput.placeholder = isTransfer
      ? tr("add_description_placeholder_transfer")
      : tr("add_description_placeholder_tx");

    els.addSaveBtn.innerHTML = isTransfer
      ? `${lucideSvg("repeat-2")}${tr("save_transfer")}`
      : `${lucideSvg("check-circle-2")}${tr("save")}`;

    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }

    if (isTransfer) {
      renderTransferRecipients();
    } else if (!state.addForm.categoryManual) {
      triggerAutoCategoryDebounced();
    }
  }

  function renderAddCategoryValue() {
    const label = state.addForm.categoryLabel || tr("add_category_auto");
    els.addCategoryValue.textContent = label;
  }

  function setDefaultAddDateTime() {
    const nowParts = nowLocalDateTimeParts();
    state.addForm.dateValue = nowParts.date;
    state.addForm.timeValue = nowParts.time;
    els.addDateInput.max = nowParts.date;
    els.addDateInput.value = nowParts.date;
    els.addTimeInput.value = nowParts.time;
  }

  async function loadCategoriesForAdd() {
    try {
      const payload = await fetchJsonWithFallback("categories");
      const categories = (payload && payload.categories) || {};
      if (Array.isArray(categories.expense)) {
        state.categoriesByKind.expense = categories.expense;
      }
      if (Array.isArray(categories.income)) {
        state.categoriesByKind.income = categories.income;
      }
    } catch (err) {
      console.error("categories fetch failed", err);
    }
  }

  function openCategorySheet() {
    const items = categoryOptions(state.addForm.kind);
    els.categorySheetList.innerHTML = "";
    items.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "category-sheet-item";
      btn.textContent = item.label;
      btn.addEventListener("click", () => {
        state.addForm.categoryManual = true;
        state.addForm.categoryKey = item.key;
        state.addForm.categoryLabel = item.label;
        renderAddCategoryValue();
        closeCategorySheet();
      });
      els.categorySheetList.appendChild(btn);
    });
    els.categorySheet.classList.remove("hidden");
  }

  function closeCategorySheet() {
    els.categorySheet.classList.add("hidden");
  }

  async function requestAutoCategory() {
    const description = String(state.addForm.description || "").trim();
    const amount = parseAmountInput(state.addForm.amountText || "");
    if (!description || amount <= 0) {
      if (!state.addForm.categoryManual) {
        state.addForm.categoryKey = "";
        state.addForm.categoryLabel = "";
        renderAddCategoryValue();
      }
      return;
    }
    try {
      const payload = await postJsonWithFallback("suggest_category", {
        kind: state.addForm.kind,
        amount,
        description,
      });
      const category = payload && payload.category ? payload.category : null;
      if (category && typeof category.key === "string" && typeof category.label === "string") {
        if (!state.addForm.categoryManual) {
          state.addForm.categoryKey = category.key;
          state.addForm.categoryLabel = category.label;
          renderAddCategoryValue();
        }
      }
    } catch (err) {
      console.error("suggest category failed", err);
    }
  }

  function triggerAutoCategoryDebounced() {
    if (state.addForm.mode !== "transaction") return;
    if (state.addForm.categoryManual) return;
    if (suggestDebounceTimer) {
      clearTimeout(suggestDebounceTimer);
    }
    suggestDebounceTimer = setTimeout(() => {
      requestAutoCategory();
    }, 480);
  }

  function addFormDateTimeIso() {
    return `${state.addForm.dateValue}T${state.addForm.timeValue}`;
  }

  function validateAddForm() {
    const amount = parseAmountInput(state.addForm.amountText);
    if (amount <= 0) return tr("amount_gt_zero");
    if (!state.addForm.dateValue || !state.addForm.timeValue) return tr("pick_date_time");

    if (state.addForm.mode === "transfer") {
      const recipientId = Number(state.addForm.recipientUserId || 0);
      if (!recipientId) return tr("pick_transfer_recipient");
      if (recipientId === Number(state.currentUserId || 0)) {
        return tr("no_self_transfer");
      }
    } else {
      if (!String(state.addForm.description || "").trim()) return tr("enter_tx_name");
      if (!state.addForm.kind) return tr("pick_tx_type");
    }

    const now = new Date();
    const selected = new Date(addFormDateTimeIso());
    if (Number.isNaN(selected.getTime())) return tr("invalid_datetime");
    if (selected > now) return tr("future_datetime_forbidden");
    return null;
  }

  async function submitAddTransaction() {
    const err = validateAddForm();
    if (err) {
      showToast(err);
      return;
    }

    state.addSubmitting = true;
    els.addSaveBtn.disabled = true;
    try {
      const amount = parseAmountInput(state.addForm.amountText);
      if (state.addForm.mode === "transfer") {
        const transferPayload = {
          amount,
          recipient_user_id: Number(state.addForm.recipientUserId || 0),
          description: String(state.addForm.description || "").trim(),
          datetime_local: addFormDateTimeIso(),
        };
        await postJsonWithFallback("create_transfer", transferPayload);
        showToast(tr("transfer_saved"));
      } else {
        const payload = {
          kind: state.addForm.kind,
          amount,
          description: String(state.addForm.description || "").trim(),
          category: state.addForm.categoryKey || undefined,
          datetime_local: addFormDateTimeIso(),
        };
        await postJsonWithFallback("create_transaction", payload);
        showToast(tr("create_saved"));
      }

      state.addForm.amountText = "";
      state.addForm.description = "";
      state.addForm.categoryKey = "";
      state.addForm.categoryLabel = "";
      state.addForm.categoryManual = false;
      state.addForm.mode = "transaction";
      state.addForm.recipientUserId = "";
      els.addAmountInput.value = "";
      els.addDescriptionInput.value = "";
      setDefaultAddDateTime();
      setAddMode("transaction");
      renderAddCategoryValue();
      await loadOverview();
      els.screenTitle.textContent = tr("home");
      showScreen("home");
    } catch (submitErr) {
      console.error("create transaction failed", submitErr);
      showToast(`${tr("create_error_prefix")}${String(submitErr.message || tr("create_error_fallback"))}`);
    } finally {
      state.addSubmitting = false;
      els.addSaveBtn.disabled = false;
    }
  }

  function openAddScreen(initialKind) {
    if (state.addForm.mode === "transaction" && (initialKind === "income" || initialKind === "expense")) {
      setAddKind(initialKind);
    }
    setAddMode(state.addForm.mode || "transaction");
    renderTransferRecipients();
    if (!state.addForm.dateValue || !state.addForm.timeValue) {
      setDefaultAddDateTime();
    } else {
      const nowParts = nowLocalDateTimeParts();
      els.addDateInput.max = nowParts.date;
      const clamped = clampFutureDateTime(state.addForm.dateValue, state.addForm.timeValue);
      state.addForm.dateValue = clamped.date;
      state.addForm.timeValue = clamped.time;
      els.addDateInput.value = state.addForm.dateValue;
      els.addTimeInput.value = state.addForm.timeValue;
    }
    els.addAmountInput.value = state.addForm.amountText;
    els.addDescriptionInput.value = state.addForm.description;
    els.addTransferRecipientSelect.value = String(state.addForm.recipientUserId || "");
    renderAddCategoryValue();
    els.screenTitle.textContent = tr("add_transaction_title");
    showScreen("add");
  }

  function parseIsoDateTime(value) {
    const dt = new Date(value || "");
    return Number.isNaN(dt.getTime()) ? new Date(0) : dt;
  }

  function sortTransactionsByTime(items) {
    return [...(items || [])].sort(
      (a, b) => parseIsoDateTime(b.created_at_iso).getTime() - parseIsoDateTime(a.created_at_iso).getTime()
    );
  }

  function buildBreakdownByType(kind) {
    const rows = (state.currentTransactions || []).filter((tx) => String(tx.kind || "") === kind);
    const grouped = new Map();
    rows.forEach((row) => {
      const label = String(row.category_label || tr("other")).trim() || tr("other");
      const key = normalizeCategoryKey(label);
      const amount = Number(row.amount || 0);
      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          label,
          amount: 0,
          color: stableColorByCategory(label),
        });
      }
      grouped.get(key).amount += amount;
    });
    const items = Array.from(grouped.values())
      .filter((item) => item.amount > 0)
      .sort((a, b) => b.amount - a.amount);
    const total = items.reduce((acc, item) => acc + Number(item.amount || 0), 0);
    return {
      items: items.map((item) => ({
        key: item.key,
        label: item.label,
        amount: Number(item.amount || 0),
        color: item.color,
        percent: total > 0 ? (Number(item.amount || 0) / total) * 100 : 0,
      })),
      total,
    };
  }

  function getRecentByType(kind, limit) {
    const rows = sortTransactionsByTime(state.currentTransactions || []);
    if (kind === "all") {
      return rows.slice(0, limit);
    }
    return rows.filter((tx) => String(tx.kind || "") === kind).slice(0, limit);
  }

  function renderRecent(items, kind) {
    els.recentList.innerHTML = "";
    if (!items || items.length === 0) {
      const wrap = document.createElement("div");
      wrap.className = "empty-wrap";
      const empty = document.createElement("div");
      empty.className = "empty";
      if (kind === "income") {
        empty.textContent = tr("recent_empty_income");
      } else if (kind === "expense") {
        empty.textContent = tr("recent_empty_expense");
      } else {
        empty.textContent = tr("recent_empty_all");
      }
      wrap.appendChild(empty);
      if (kind === "income" || kind === "expense") {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "empty-action-btn";
        btn.textContent = kind === "income" ? tr("add_income") : tr("add_expense");
        btn.addEventListener("click", () => {
          openAddScreen(kind);
        });
        wrap.appendChild(btn);
      }
      els.recentList.appendChild(wrap);
      return;
    }
    items.forEach((item) => {
      const txKind = String(item.kind || "expense");
      const title = escapeHtml(
        item.description ||
          item.category_label ||
          (currentLanguageCode() === "ru"
            ? "Операция"
            : currentLanguageCode() === "uz"
              ? "Operatsiya"
              : "Transaction")
      );
      const label = escapeHtml(item.category_label || tr("other"));
      const amountClass = txKind === "income" ? "income" : "expense";
      const sign = txKind === "income" ? "+" : "-";
      const tx = document.createElement("article");
      tx.className = "tx-item";
      tx.innerHTML = `
        <div class="tx-icon ${amountClass}">${lucideSvg(categoryIconName(item.category_label, txKind))}</div>
        <div class="tx-main">
          <div class="tx-title">${title}</div>
          <div class="tx-meta">${label} • ${fmtDateTime(item.created_at_iso)}</div>
        </div>
        <div class="tx-amount ${amountClass}">${sign}${fmtMoney(item.amount, false)}</div>
      `;
      els.recentList.appendChild(tx);
    });
  }

  function renderChartFromBreakdown(parsedBreakdown) {
    const parsed = parsedBreakdown || { items: [], total: 0 };
    state.chartItems = parsed.items;
    state.chartTotal = Number(parsed.total || 0);
    if (!state.chartItems.some((item) => item.key === state.activeCategoryKey)) {
      state.activeCategoryKey = null;
    }
    renderInteractiveChart();
  }

  function buildTrendSeries(items, startIso, endIso) {
    const start = parseDateOnly(startIso);
    const end = parseDateOnly(endIso);
    if (!start || !end || start.getTime() > end.getTime()) {
      return { labels: [], income: [], expense: [] };
    }

    const days = [];
    const income = [];
    const expense = [];
    const dayMap = new Map();
    let cursor = new Date(start);
    while (cursor.getTime() <= end.getTime()) {
      const key = toDateOnlyIso(cursor);
      days.push(key);
      income.push(0);
      expense.push(0);
      dayMap.set(key, days.length - 1);
      cursor = addDays(cursor, 1);
    }

    (items || []).forEach((row) => {
      const dt = parseIsoDateTime(row.created_at_iso);
      if (Number.isNaN(dt.getTime())) return;
      const key = toDateOnlyIso(new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()));
      if (!dayMap.has(key)) return;
      const idx = dayMap.get(key);
      const amount = Number(row.amount || 0);
      if (String(row.kind || "") === "income") {
        income[idx] += amount;
      } else if (String(row.kind || "") === "expense") {
        expense[idx] += amount;
      }
    });

    return { labels: days, income, expense };
  }

  function buildPolylinePath(values, xOf, yOf) {
    return values
      .map((value, idx) => `${idx === 0 ? "M" : "L"} ${xOf(idx).toFixed(2)} ${yOf(value).toFixed(2)}`)
      .join(" ");
  }

  function renderBalanceTrendChart(items, startIso, endIso) {
    if (!els.balanceTrendSvg || !els.balanceTrendLegend) return;
    const series = buildTrendSeries(items, startIso, endIso);
    if (!series.labels.length) {
      els.balanceTrendSvg.innerHTML = "";
      els.balanceTrendLegend.innerHTML = "";
      return;
    }

    const width = 320;
    const height = 160;
    const padding = { left: 14, right: 8, top: 8, bottom: 18 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    const maxIncome = Math.max(...series.income, 0);
    const maxExpense = Math.max(...series.expense, 0);
    const maxY = Math.max(maxIncome, maxExpense, 1);
    const xOf = (idx) =>
      padding.left + (series.labels.length <= 1 ? chartW / 2 : (idx / (series.labels.length - 1)) * chartW);
    const yOf = (val) => padding.top + chartH - (Number(val || 0) / maxY) * chartH;

    const incomePath = buildPolylinePath(series.income, xOf, yOf);
    const expensePath = buildPolylinePath(series.expense, xOf, yOf);
    const grid = [0, 1, 2, 3]
      .map((step) => {
        const y = padding.top + (chartH / 3) * step;
        return `<line class="trend-grid-line" x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}"></line>`;
      })
      .join("");

    const incomeDots = series.income
      .map(
        (v, idx) =>
          `<circle class="trend-dot income" cx="${xOf(idx)}" cy="${yOf(v)}" r="${series.labels.length > 14 ? 1.8 : 2.5}"></circle>`
      )
      .join("");
    const expenseDots = series.expense
      .map(
        (v, idx) =>
          `<circle class="trend-dot expense" cx="${xOf(idx)}" cy="${yOf(v)}" r="${series.labels.length > 14 ? 1.8 : 2.5}"></circle>`
      )
      .join("");

    els.balanceTrendSvg.innerHTML = `
      ${grid}
      <path class="trend-line income" d="${incomePath}"></path>
      <path class="trend-line expense" d="${expensePath}"></path>
      ${incomeDots}
      ${expenseDots}
    `;
    els.balanceTrendLegend.innerHTML = `
      <span class="trend-legend-item"><span class="trend-legend-dot income"></span>${escapeHtml(tr("home_income"))}</span>
      <span class="trend-legend-item"><span class="trend-legend-dot expense"></span>${escapeHtml(tr("home_expense"))}</span>
    `;
  }

  function setAnalyticsTab(type) {
    state.selectedAnalytics = type === "income" ? "income" : "expense";
    state.activeCategoryKey = null;
    els.tabIncome.classList.toggle("active", state.selectedAnalytics === "income");
    els.tabExpense.classList.toggle("active", state.selectedAnalytics === "expense");
  }

  function renderAnalytics(summary, periodObj) {
    const tab = state.selectedAnalytics === "income" ? "income" : "expense";
    els.analyticsPanel.classList.remove("analytics-switch");
    els.recentPanel.classList.remove("analytics-switch");
    void els.analyticsPanel.offsetWidth;
    els.analyticsPanel.classList.add("analytics-switch");
    els.recentPanel.classList.add("analytics-switch");

    if (els.breakdownView) {
      els.breakdownView.classList.remove("hidden");
    }
    if (tab === "income") {
      els.chartSectionTitle.textContent = tr("home_breakdown_income");
      els.recentSectionTitle.textContent = tr("home_recent_income");
      renderChartFromBreakdown(buildBreakdownByType("income"));
      renderRecent(getRecentByType("income", 5), "income");
      return;
    }

    els.chartSectionTitle.textContent = tr("home_breakdown_expense");
    els.recentSectionTitle.textContent = tr("home_recent_expenses");
    renderChartFromBreakdown(buildBreakdownByType("expense"));
    renderRecent(getRecentByType("expense", 5), "expense");
  }

  function summaryFromCurrentTransactions() {
    const income = Number(
      (state.currentTransactions || [])
        .filter((x) => String(x.kind || "") === "income")
        .reduce((acc, x) => acc + Number(x.amount || 0), 0)
    );
    const expense = Number(
      (state.currentTransactions || [])
        .filter((x) => String(x.kind || "") === "expense")
        .reduce((acc, x) => acc + Number(x.amount || 0), 0)
    );
    return { income, expense, balance: income - expense, transfer_total: 0 };
  }

  function applyOverviewMeta(payload) {
    const scopeObj = payload && payload.scope ? payload.scope : { selected: state.scope, options: state.scopeOptions };
    const selectedScope = scopeObj.selected || state.scope || "all";
    const scopeOptions = Array.isArray(scopeObj.options) && scopeObj.options.length
      ? scopeObj.options
      : state.scopeOptions;
    const scopeItem = scopeOptions.find((x) => x.key === selectedScope);
    state.scope = selectedScope;
    state.scopeOptions = scopeOptions;
    state.memberOptions = extractMemberOptions(scopeOptions);
    renderTransferRecipients();
    els.scopeLabel.textContent = scopeItem ? scopeItem.label : tr("scope_all");

    const periodObj = payload && payload.period ? payload.period : {};
    state.period = periodObj.mode || state.period;
    state.start = periodObj.start || state.start;
    state.end = periodObj.end || state.end;
    updatePeriodLabel();

    return { scopeObj, periodObj };
  }

  function renderOverview(payload) {
    applyOverviewMeta(payload);

    const summary = payload && payload.summary ? payload.summary : summaryFromCurrentTransactions();
    els.incomeValue.textContent = fmtMoney(summary.income || 0, false);
    els.expenseValue.textContent = fmtMoney(summary.expense || 0, false);
    if (els.familyTransfersValue) {
      els.familyTransfersValue.textContent = fmtMoney(summary.transfer_total || 0, false);
    }
    renderAnalytics(summary, payload.period || { start: state.start, end: state.end });
    setStatusBanner("", "info");
  }

  function renderTransactions(items) {
    els.transactionsList.innerHTML = "";
    const typeFilter = state.transactionsTypeFilter || "all";
    const filtered = (items || []).filter((item) => {
      if (typeFilter === "all") return true;
      return String(item.kind || "") === typeFilter;
    });

    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent =
        typeFilter === "income"
          ? (currentLanguageCode() === "ru" ? "Нет доходов за выбранный период." : currentLanguageCode() === "uz" ? "Tanlangan davr uchun daromadlar yo'q." : "No income for the selected period.")
          : typeFilter === "expense"
            ? (currentLanguageCode() === "ru" ? "Нет расходов за выбранный период." : currentLanguageCode() === "uz" ? "Tanlangan davr uchun xarajatlar yo'q." : "No expenses for the selected period.")
            : (currentLanguageCode() === "ru" ? "Нет транзакций за выбранный период." : currentLanguageCode() === "uz" ? "Tanlangan davr uchun tranzaksiyalar yo'q." : "No transactions for the selected period.");
      els.transactionsList.appendChild(empty);
      return;
    }

    filtered.forEach((item) => {
      const tx = document.createElement("article");
      const amountCls = item.kind === "income" ? "income" : "expense";
      const sign = item.kind === "income" ? "+" : "-";
      const title = escapeHtml(
        item.description ||
          item.category_label ||
          (currentLanguageCode() === "ru"
            ? "Операция"
            : currentLanguageCode() === "uz"
              ? "Operatsiya"
              : "Transaction")
      );
      const label = escapeHtml(item.category_label || tr("other"));
      tx.className = "tx-item";
      tx.innerHTML = `
        <div class="tx-icon ${amountCls}">${lucideSvg(
          categoryIconName(item.category_label, item.kind)
        )}</div>
        <div class="tx-main">
          <div class="tx-title">${title}</div>
          <div class="tx-meta">${label} • ${fmtDateTime(item.created_at_iso)}</div>
        </div>
        <div class="tx-amount ${amountCls}">${sign}${fmtMoney(item.amount, false)}</div>
      `;
      els.transactionsList.appendChild(tx);
    });
  }

  function analyticsUtils() {
    if (!window.FinAnalyticsUtils || typeof window.FinAnalyticsUtils.buildAnalyticsReport !== "function") {
      return null;
    }
    return window.FinAnalyticsUtils;
  }

  function analyticsEmptyHtml(text) {
    const fallback =
      currentLanguageCode() === "ru"
        ? "Нет данных за выбранный период."
        : currentLanguageCode() === "uz"
          ? "Tanlangan davr uchun ma'lumot yo'q."
          : "No data for the selected period.";
    return `<div class="empty">${escapeHtml(text || fallback)}</div>`;
  }

  function renderAnalyticsHero(report) {
    if (!els.analyticsHero) return;
    const hero = report && report.hero ? report.hero : null;
    if (!hero) {
      els.analyticsHero.innerHTML = analyticsEmptyHtml(
        currentLanguageCode() === "ru"
          ? "Нет главного вывода за выбранный период."
          : currentLanguageCode() === "uz"
            ? "Tanlangan davr uchun asosiy xulosa yo'q."
            : "No key insight for the selected period."
      );
      return;
    }
    const tone = String(hero.tone || "neutral");
    let valueText = "";
    if (hero.valueType === "money") {
      valueText =
        (currentLanguageCode() === "ru" ? "на " : currentLanguageCode() === "uz" ? "" : "by ") +
        fmtMoney(hero.value || 0, false);
    } else if (hero.valueType === "percent") {
      valueText =
        (currentLanguageCode() === "ru" ? "на " : currentLanguageCode() === "uz" ? "" : "by ") +
        `${fmtPercent(Math.abs(Number(hero.value || 0)))}%`;
    } else {
      valueText = String(hero.valueText || "—");
    }
    const iconName = tone === "positive" ? "badge-check" : tone === "warning" ? "triangle-alert" : "sparkles";
    els.analyticsHero.innerHTML = `
      <div class="analytics-hero-card ${tone}">
        <div class="analytics-hero-icon ${tone}">${lucideSvg(iconName, { width: 18, height: 18 })}</div>
        <div class="analytics-hero-body">
          <div class="analytics-hero-title">${escapeHtml(hero.title || (currentLanguageCode() === "ru" ? "Главный вывод" : currentLanguageCode() === "uz" ? "Asosiy xulosa" : "Key insight"))}</div>
          <div class="analytics-hero-value ${tone}">${escapeHtml(valueText)}</div>
          <div class="analytics-hero-sub">${escapeHtml(hero.subtitle || "")}</div>
        </div>
      </div>
    `;
  }

  function renderAnalyticsStatus(report) {
    if (!els.analyticsStatus) return;
    const status = report && report.financialStatus ? report.financialStatus : null;
    const game = report && report.gamification ? report.gamification : null;
    if (!status) {
      els.analyticsStatus.innerHTML = "";
      return;
    }
    const tone = String(status.tone || "neutral");
    const iconName = tone === "stable" ? "shield-check" : tone === "warning" ? "circle-alert" : tone === "danger" ? "octagon-alert" : "info";
    els.analyticsStatus.innerHTML = `
      <div class="analytics-status-card ${tone}">
        <div class="analytics-status-head">
          <div class="analytics-status-main">
            <span class="analytics-status-icon ${tone}">${lucideSvg(iconName, { width: 14, height: 14 })}</span>
            <span class="analytics-status-label">${escapeHtml(status.label || (currentLanguageCode() === "ru" ? "Финансовое состояние" : currentLanguageCode() === "uz" ? "Moliyaviy holat" : "Financial status"))}</span>
          </div>
          ${game && game.badgeText ? `<span class="analytics-status-badge">${escapeHtml(game.badgeText)}</span>` : ""}
        </div>
        <div class="analytics-status-text">${escapeHtml(status.description || "")}</div>
      </div>
    `;
  }

  function renderAnalyticsForecast(report) {
    if (!els.analyticsForecast) return;
    const forecast = report && report.forecast ? report.forecast : null;
    if (!forecast || !forecast.applicable) {
      els.analyticsForecast.innerHTML = "";
      return;
    }
    if (Number(forecast.avgExpensePerDay || 0) <= 0) {
      els.analyticsForecast.innerHTML = `
        <div class="analytics-forecast-card">
          <div class="analytics-forecast-title">${escapeHtml(currentLanguageCode() === "ru" ? "Прогноз до конца месяца" : currentLanguageCode() === "uz" ? "Oy oxirigacha prognoz" : "Forecast to month end")}</div>
          <div class="analytics-forecast-text">${escapeHtml(currentLanguageCode() === "ru" ? "Пока недостаточно расходов, чтобы построить прогноз." : currentLanguageCode() === "uz" ? "Prognoz tuzish uchun hozircha xarajatlar yetarli emas." : "Not enough expenses yet to build a forecast.")}</div>
        </div>
      `;
      return;
    }
    const remainingDays = Number(forecast.remainingDaysInMonth || 0);
    const projected = Number(forecast.projectedExpenseToMonthEnd || 0);
    const income = Number((report && report.totals && report.totals.income) || 0);
    const forecastWarn = projected > income && projected > 0;
    els.analyticsForecast.innerHTML = `
      <div class="analytics-forecast-card ${forecastWarn ? "warning" : "positive"}">
        <div class="analytics-forecast-title">${escapeHtml(currentLanguageCode() === "ru" ? "Прогноз до конца месяца" : currentLanguageCode() === "uz" ? "Oy oxirigacha prognoz" : "Forecast to month end")}</div>
        <div class="analytics-forecast-text">
          ${escapeHtml(currentLanguageCode() === "ru" ? "Если сохранится текущий темп, расходы составят ~" : currentLanguageCode() === "uz" ? "Hozirgi sur'at saqlansa, xarajatlar taxminan" : "If the current pace continues, expenses will be about")} ${fmtMoney(projected, false)}
        </div>
        <div class="analytics-forecast-note ${forecastWarn ? "warning" : "positive"}">
          ${forecastWarn
            ? (currentLanguageCode() === "ru" ? "При текущем темпе вы уйдёте в минус" : currentLanguageCode() === "uz" ? "Hozirgi sur'atda balans manfiy bo'ladi" : "At the current pace you may go negative")
            : (currentLanguageCode() === "ru" ? "Вы останетесь в плюсе при текущем темпе" : currentLanguageCode() === "uz" ? "Hozirgi sur'atda ijobiy balans saqlanadi" : "You stay positive at the current pace")}
        </div>
        <div class="analytics-forecast-meta">
          ${remainingDays > 0
            ? (currentLanguageCode() === "ru" ? `Осталось ${remainingDays} дн.` : currentLanguageCode() === "uz" ? `${remainingDays} kun qoldi` : `${remainingDays} days left`)
            : (currentLanguageCode() === "ru" ? "Сегодня последний день месяца" : currentLanguageCode() === "uz" ? "Bugun oyning oxirgi kuni" : "Today is the last day of the month")}
        </div>
      </div>
    `;
  }

  function renderAnalyticsTrendChanges(report) {
    if (!els.analyticsTrendChanges) return;
    const prev = report && report.previousTotals ? report.previousTotals : { expense: 0, income: 0 };
    const showExpense = Number(prev.expense || 0) > 0;
    const showIncome = Number(prev.income || 0) > 0;
    if (!showExpense && !showIncome) {
      els.analyticsTrendChanges.innerHTML = "";
      els.analyticsTrendChanges.classList.add("hidden");
      return;
    }
    els.analyticsTrendChanges.classList.remove("hidden");
    const expenseClass = analyticsPctClass(report && report.trendChange ? report.trendChange.expensePct : 0, false);
    const incomeClass = analyticsPctClass(report && report.trendChange ? report.trendChange.incomePct : 0, true);
    const blocks = [];
    if (showExpense) {
      blocks.push(`
        <div class="analytics-delta-card">
        <div class="analytics-delta-label">${escapeHtml(currentLanguageCode() === "ru" ? "Расходы к прошлому периоду" : currentLanguageCode() === "uz" ? "Xarajatlar oldingi davrga nisbatan" : "Expenses vs previous period")}</div>
        <div class="analytics-delta-value ${expenseClass}">
          ${fmtSignedPercentNullable(report && report.trendChange ? report.trendChange.expensePct : null)}
        </div>
      </div>`);
    }
    if (showIncome) {
      blocks.push(`
        <div class="analytics-delta-card">
        <div class="analytics-delta-label">${escapeHtml(currentLanguageCode() === "ru" ? "Доходы к прошлому периоду" : currentLanguageCode() === "uz" ? "Daromadlar oldingi davrga nisbatan" : "Income vs previous period")}</div>
        <div class="analytics-delta-value ${incomeClass}">
          ${fmtSignedPercentNullable(report && report.trendChange ? report.trendChange.incomePct : null)}
        </div>
      </div>`);
    }
    els.analyticsTrendChanges.innerHTML = blocks.join("");
  }

  function renderAnalyticsComparisonCard(report) {
    if (!els.analyticsComparisonCard) return;
    const hasPreviousData = Boolean(report && report.hasPreviousPeriodData);
    if (els.analyticsComparisonSection) {
      els.analyticsComparisonSection.classList.toggle("hidden", !hasPreviousData);
    }
    if (!hasPreviousData) {
      els.analyticsComparisonCard.innerHTML = "";
      return;
    }
    const cmp = report && report.comparison ? report.comparison : null;
    if (!cmp || !cmp.metrics) {
      els.analyticsComparisonCard.innerHTML = analyticsEmptyHtml(
        currentLanguageCode() === "ru"
          ? "Нет данных для сравнения периодов."
          : currentLanguageCode() === "uz"
            ? "Davrlarni solishtirish uchun ma'lumot yo'q."
            : "No data for period comparison."
      );
      return;
    }
    const metrics = cmp.metrics || {};

    const rowHtml = (label, key, showPct) => {
      const metric = metrics[key] || { deltaAbs: 0, deltaPct: null, direction: "neutral" };
      const cls = analyticsDirectionClass(metric.direction);
      const pctPart = showPct && metric.deltaPct !== null
        ? `<span class="analytics-compact-delta-pct ${cls}">(${fmtSignedPercentNullable(metric.deltaPct)})</span>`
        : "";
      return `
        <div class="analytics-compact-delta-row">
          <span class="analytics-compact-delta-name">${label}</span>
          <span class="analytics-compact-delta-values">
            <span class="analytics-compact-delta-money ${cls}">${fmtMoney(Number(metric.deltaAbs || 0), true)}</span>
            ${pctPart}
          </span>
        </div>
      `;
    };

    els.analyticsComparisonCard.innerHTML = `
      <div class="analytics-compact-delta-card">
        ${rowHtml(currentLanguageCode() === "ru" ? "Расходы" : currentLanguageCode() === "uz" ? "Xarajatlar" : "Expenses", "expense", true)}
        ${rowHtml(currentLanguageCode() === "ru" ? "Доходы" : currentLanguageCode() === "uz" ? "Daromadlar" : "Income", "income", true)}
        ${rowHtml(currentLanguageCode() === "ru" ? "Баланс" : currentLanguageCode() === "uz" ? "Balans" : "Balance", "balance", false)}
      </div>
    `;
  }

  function renderAnalyticsTopCategories(report) {
    if (!els.analyticsTopCategories) return;
    const focus = report && report.categoryFocus ? report.categoryFocus : null;
    const primary = focus && focus.primary ? focus.primary : null;
    const secondary = Array.isArray(focus && focus.secondary) ? focus.secondary : [];
    if (!primary) {
      els.analyticsTopCategories.innerHTML = analyticsEmptyHtml(
        currentLanguageCode() === "ru"
          ? "Нет расходов за выбранный период."
          : currentLanguageCode() === "uz"
            ? "Tanlangan davrda xarajatlar yo'q."
            : "No expenses for the selected period."
      );
      return;
    }

    const primaryTrendClass = analyticsDirectionClass(primary.trendDirection);
    const primaryTrendText = primary.deltaPct === null ? "" : fmtSignedPercentNullable(primary.deltaPct);

    els.analyticsTopCategories.innerHTML = `
      <div class="analytics-focus-card">
        <div class="analytics-focus-title">
          ${escapeHtml(currentLanguageCode() === "ru" ? "Основной источник расходов" : currentLanguageCode() === "uz" ? "Asosiy xarajat manbai" : "Main expense source")} — ${escapeHtml(primary.label || tr("other"))} (${Math.round(Number(primary.sharePct || 0))}%)
        </div>
        <div class="analytics-focus-value">${fmtMoney(primary.amount || 0, false)}</div>
        <div class="analytics-focus-meta">
          ${primaryTrendText ? `<span class="analytics-chip ${primaryTrendClass}">${primaryTrendText}</span>` : ""}
          <span class="analytics-chip">${fmtMoney(primary.deltaAbs || 0, true)} ${escapeHtml(periodComparisonLabel(state.period))}</span>
        </div>
      </div>
      ${secondary.length ? `
        <div class="analytics-compact-list">
          ${secondary.map((row) => `
            <div class="analytics-compact-row">
              <div class="analytics-compact-row-main">
                <span class="analytics-compact-row-name">${escapeHtml(row.label || tr("other"))}</span>
                <span class="analytics-compact-row-share">${Math.round(Number(row.sharePct || 0))}%</span>
              </div>
              <div class="analytics-compact-row-side">${fmtMoney(row.amount || 0, false)}</div>
            </div>
          `).join("")}
        </div>
      ` : ""}
    `;
  }

  function renderAnalyticsParticipants(report) {
    if (!els.analyticsParticipants) return;
    const participants = report && report.participants ? report.participants : { rows: [] };
    const rows = Array.isArray(participants.rows) ? participants.rows : [];
    const familyBehavior = report && report.familyBehavior ? report.familyBehavior : null;
    if (!rows.length) {
      els.analyticsParticipants.innerHTML = analyticsEmptyHtml(
        currentLanguageCode() === "ru"
          ? "Нет данных по участникам для выбранного периода."
          : currentLanguageCode() === "uz"
            ? "Tanlangan davr uchun ishtirokchilar bo'yicha ma'lumot yo'q."
            : "No participant data for the selected period."
      );
      return;
    }
    const leader = (familyBehavior && familyBehavior.leader) || rows[0];
    const dominant = Boolean(familyBehavior && familyBehavior.dominant);
    const statement = String((familyBehavior && familyBehavior.statement) || "").trim();
    const others = (familyBehavior && Array.isArray(familyBehavior.others) ? familyBehavior.others : rows.slice(1)).slice(0, 2);

    els.analyticsParticipants.innerHTML = `
      <div class="analytics-family-card ${dominant ? "dominant" : ""}">
        ${statement ? `<div class="analytics-family-statement">${escapeHtml(statement)}</div>` : ""}
        <div class="analytics-family-leader">
          <div class="analytics-row-head">
            <div class="analytics-row-title">${escapeHtml((leader && leader.name) || (currentLanguageCode() === "ru" ? "Участник" : currentLanguageCode() === "uz" ? "Ishtirokchi" : "Member"))}</div>
            <div class="analytics-row-value">${fmtMoney((leader && leader.expense) || 0, false)}</div>
          </div>
          <div class="analytics-family-meta">
            <span>${Math.round(Number((leader && leader.sharePct) || 0))}% ${escapeHtml(currentLanguageCode() === "ru" ? "семейных расходов" : currentLanguageCode() === "uz" ? "oilaviy xarajatlar" : "of family expenses")}</span>
            <span class="muted">${escapeHtml(currentLanguageCode() === "ru" ? "Средний чек" : currentLanguageCode() === "uz" ? "O'rtacha chek" : "Average check")} ${fmtMoney((leader && leader.avgCheck) || 0, false)}</span>
            <span class="muted">${Number((leader && leader.txCount) || 0)} ${escapeHtml(currentLanguageCode() === "ru" ? "транз." : currentLanguageCode() === "uz" ? "tranz." : "tx")}</span>
          </div>
        </div>
      </div>
      ${others.length ? `
        <div class="analytics-compact-list">
          ${others.map((row) => `
            <div class="analytics-compact-row">
              <div class="analytics-compact-row-main">
                <span class="analytics-compact-row-name">${escapeHtml(row.name || (currentLanguageCode() === "ru" ? "Участник" : currentLanguageCode() === "uz" ? "Ishtirokchi" : "Member"))}</span>
                <span class="analytics-compact-row-share">${Math.round(Number(row.sharePct || 0))}%</span>
              </div>
              <div class="analytics-compact-row-side">${fmtMoney(row.expense || 0, false)}</div>
            </div>
          `).join("")}
        </div>
      ` : ""}
    `;
  }

  function renderAnalyticsInsights(report) {
    if (!els.analyticsInsights) return;
    const insights = Array.isArray(report && report.insights) ? report.insights : [];
    if (!insights.length) {
      els.analyticsInsights.innerHTML = analyticsEmptyHtml(
        currentLanguageCode() === "ru"
          ? "Недостаточно данных для инсайтов."
          : currentLanguageCode() === "uz"
            ? "Insightlar uchun ma'lumot yetarli emas."
            : "Not enough data for insights."
      );
      return;
    }

    function insightIcon(item) {
      if (item.key === "category-share") return "pie-chart";
      if (item.key === "max-day") return "calendar-range";
      if (item.key === "avg-day-expense") return "gauge";
      return item.kind === "positive" ? "trending-down" : "trending-up";
    }

    function insightTitle(item) {
      if (item.key === "category-share") {
        return `${Math.round(Number(item.sharePct || 0))}% ${
          currentLanguageCode() === "ru" ? "расходов приходится на" : currentLanguageCode() === "uz" ? "xarajatlar ulushi" : "of expenses come from"
        } ${item.categoryLabel || (currentLanguageCode() === "ru" ? "основную категорию" : currentLanguageCode() === "uz" ? "asosiy kategoriya" : "the main category")}`;
      }
      if (item.key === "category-growth") {
        return `${item.categoryLabel || (currentLanguageCode() === "ru" ? "Категория" : currentLanguageCode() === "uz" ? "Kategoriya" : "Category")}: ${currentLanguageCode() === "ru" ? "рост расходов" : currentLanguageCode() === "uz" ? "xarajatlar o'sishi" : "expense growth"}`;
      }
      if (item.key === "category-drop") {
        return `${item.categoryLabel || (currentLanguageCode() === "ru" ? "Категория" : currentLanguageCode() === "uz" ? "Kategoriya" : "Category")}: ${currentLanguageCode() === "ru" ? "снижение расходов" : currentLanguageCode() === "uz" ? "xarajatlar kamayishi" : "expense decrease"}`;
      }
      if (item.key === "max-day") {
        return `${formatDateLabel(item.dateIso)} — ${currentLanguageCode() === "ru" ? "самый затратный день" : currentLanguageCode() === "uz" ? "eng ko'p xarajat qilingan kun" : "highest-spending day"}`;
      }
      if (item.key === "avg-day-expense") {
        return currentLanguageCode() === "ru" ? "В среднем вы тратите в день" : currentLanguageCode() === "uz" ? "Kuniga o'rtacha xarajat" : "Average daily spending";
      }
      return String(item.title || (currentLanguageCode() === "ru" ? "Инсайт" : currentLanguageCode() === "uz" ? "Insight" : "Insight"));
    }

    function insightText(item) {
      if (item.key === "category-share") {
        return "";
      }
      if (item.key === "category-growth") {
        const pctText = fmtSignedPercentNullable(item.pct);
        return `${fmtMoney(item.amount || 0, true)} (${pctText}) ${periodComparisonLabel(state.period)}.`;
      }
      if (item.key === "category-drop") {
        const pctText = fmtSignedPercentNullable(item.pct);
        return `${
          currentLanguageCode() === "ru" ? "Меньше на" : currentLanguageCode() === "uz" ? "Kamroq:" : "Lower by"
        } ${fmtMoney(item.amount || 0, false)} (${pctText}) ${periodComparisonLabel(state.period)}.`;
      }
      if (item.key === "max-day") {
        return `${fmtMoney(item.amount || 0, false)} ${currentLanguageCode() === "ru" ? "расходов." : currentLanguageCode() === "uz" ? "xarajat." : "spent."}`;
      }
      if (item.key === "avg-day-expense") {
        return `${fmtMoney(item.amount || 0, false)} ${currentLanguageCode() === "ru" ? "в день." : currentLanguageCode() === "uz" ? "kuniga." : "per day."}`;
      }
      return "";
    }

    els.analyticsInsights.innerHTML = insights
      .slice(0, 3)
      .map((item) => `
        <div class="analytics-insight-card">
          <div class="analytics-insight-icon ${escapeHtml(item.kind || "neutral")}">${lucideSvg(insightIcon(item), { width: 16, height: 16 })}</div>
          <div>
            <div class="analytics-insight-title">${escapeHtml(insightTitle(item))}</div>
            ${insightText(item) ? `<div class="analytics-insight-text">${escapeHtml(insightText(item))}</div>` : ""}
          </div>
        </div>
      `)
      .join("");
  }

  function renderAnalyticsPageEmpty(message) {
    if (els.balanceTrendSvg) els.balanceTrendSvg.innerHTML = "";
    if (els.balanceTrendLegend) els.balanceTrendLegend.innerHTML = "";
    if (els.analyticsHero) els.analyticsHero.innerHTML = analyticsEmptyHtml(message);
    if (els.analyticsStatus) els.analyticsStatus.innerHTML = "";
    if (els.analyticsForecast) els.analyticsForecast.innerHTML = analyticsEmptyHtml(message);
    if (els.analyticsTrendChanges) els.analyticsTrendChanges.innerHTML = analyticsEmptyHtml(message);
    if (els.analyticsTrendChanges) els.analyticsTrendChanges.classList.remove("hidden");
    if (els.analyticsComparisonSection) els.analyticsComparisonSection.classList.remove("hidden");
    if (els.analyticsComparisonCard) els.analyticsComparisonCard.innerHTML = analyticsEmptyHtml(message);
    if (els.analyticsTopCategories) els.analyticsTopCategories.innerHTML = analyticsEmptyHtml(message);
    if (els.analyticsParticipants) els.analyticsParticipants.innerHTML = analyticsEmptyHtml(message);
    if (els.analyticsInsights) els.analyticsInsights.innerHTML = analyticsEmptyHtml(message);
  }

  function renderAnalyticsPage(report) {
    if (!report) {
      renderAnalyticsPageEmpty();
      return;
    }
    renderAnalyticsHero(report);
    renderAnalyticsStatus(report);
    renderAnalyticsForecast(report);
    renderAnalyticsTrendChanges(report);
    renderAnalyticsComparisonCard(report);
    renderAnalyticsTopCategories(report);
    renderAnalyticsParticipants(report);
    renderAnalyticsInsights(report);
  }

  async function loadOverview() {
    if (!state.chatId) {
      setStatusBanner(tr("status_need_chat"), "error");
      els.recentList.innerHTML = `<div class="empty">${escapeHtml(tr("empty_no_chat"))}</div>`;
      return;
    }
    state.isLoading = true;
    try {
      const payload = await fetchJsonWithFallback("overview");
      const periodObj = payload && payload.period ? payload.period : {};
      const txPayload = await fetchJsonWithFallback("transactions", {
        scope: payload && payload.scope ? payload.scope.selected || state.scope : state.scope,
        period: periodObj.mode || state.period,
        start: periodObj.start || state.start,
        end: periodObj.end || state.end,
      });

      state.currentTransactions = Array.isArray(txPayload && txPayload.items) ? txPayload.items : [];

      const compareRange = getComparisonRange(
        periodObj.mode || state.period,
        periodObj.start || state.start,
        periodObj.end || state.end
      );
      state.comparison = null;
      if (compareRange) {
        try {
          const prevOverview = await fetchJsonWithFallback("overview", {
            scope: payload && payload.scope ? payload.scope.selected || state.scope : state.scope,
            period: "custom",
            start: compareRange.start,
            end: compareRange.end,
          });
          const prevSummary = (prevOverview && prevOverview.summary) || {};
          state.comparison = {
            prevBalance: Number(prevSummary.balance || 0),
            label: compareRange.label,
          };
        } catch (comparisonError) {
          state.comparison = null;
          console.error("comparison overview fetch failed", comparisonError);
        }
      }

      state.apiUnavailable = false;
      renderOverview(payload);
    } catch (err) {
      state.apiUnavailable = true;
      setStatusBanner(
        tr("status_api_overview_error"),
        "error"
      );
      els.recentList.innerHTML = `<div class="empty">${escapeHtml(tr("empty_overview_error"))}</div>`;
      console.error("overview fetch failed", err);
      return;
    } finally {
      state.isLoading = false;
    }
  }

  async function loadTransactions() {
    if (!state.chatId) {
      setStatusBanner(tr("status_need_chat"), "error");
      els.transactionsList.innerHTML = `<div class="empty">${escapeHtml(tr("empty_no_chat"))}</div>`;
      return;
    }
    state.isLoading = true;
    try {
      const payload = await fetchJsonWithFallback("transactions");
      state.apiUnavailable = false;
      const items = Array.isArray(payload && payload.items) ? payload.items : [];
      state.currentTransactions = items;
      renderTransactions(items);
      setStatusBanner("", "info");
    } catch (err) {
      state.apiUnavailable = true;
      setStatusBanner(
        tr("status_api_transactions_error"),
        "error"
      );
      els.transactionsList.innerHTML = `<div class="empty">${escapeHtml(tr("empty_transactions_error"))}</div>`;
      console.error("transactions fetch failed", err);
      return;
    } finally {
      state.isLoading = false;
    }
  }

  async function fetchTransactionsItems(overrides) {
    const payload = await fetchJsonWithFallback("transactions", overrides);
    return Array.isArray(payload && payload.items) ? payload.items : [];
  }

  async function fetchOverviewPayload(overrides) {
    return fetchJsonWithFallback("overview", overrides);
  }

  async function loadAnalyticsParticipantBuckets(periodObj) {
    const members = Array.isArray(state.memberOptions) ? state.memberOptions : [];
    if (!members.length) return [];
    const periodMode = periodObj && periodObj.mode ? periodObj.mode : state.period;
    const periodStart = periodObj && periodObj.start ? periodObj.start : state.start;
    const periodEnd = periodObj && periodObj.end ? periodObj.end : state.end;

    const tasks = members.map(async (member) => {
      try {
        const items = await fetchTransactionsItems({
          scope: `user:${member.id}`,
          period: periodMode,
          start: periodStart,
          end: periodEnd,
        });
        return { userId: member.id, name: member.label, items };
      } catch (err) {
        console.error("analytics member transactions fetch failed", member && member.id, err);
        return { userId: member.id, name: member.label, items: [] };
      }
    });
    return Promise.all(tasks);
  }

  async function loadAnalyticsPositiveBalanceStreak(periodObj, currentBalance) {
    const start = String((periodObj && periodObj.start) || state.start || "").trim();
    const end = String((periodObj && periodObj.end) || state.end || "").trim();
    const mode = String((periodObj && periodObj.mode) || state.period || "custom");
    if (Number(currentBalance || 0) <= 0 || !start || !end) return 0;

    let streak = 1;
    let cursorStart = start;
    let cursorEnd = end;
    const maxChecks = 5;

    for (let i = 0; i < maxChecks; i += 1) {
      const prevRange = getComparisonRange(mode, cursorStart, cursorEnd);
      if (!prevRange) break;
      try {
        const prevOverview = await fetchOverviewPayload({
          scope: "all",
          period: "custom",
          start: prevRange.start,
          end: prevRange.end,
        });
        const prevSummary = prevOverview && prevOverview.summary ? prevOverview.summary : {};
        const prevBalance = Number(prevSummary.balance || 0);
        if (prevBalance <= 0) break;
        streak += 1;
        cursorStart = prevRange.start;
        cursorEnd = prevRange.end;
      } catch (err) {
        console.error("analytics streak fetch failed", err);
        break;
      }
    }

    return streak;
  }

  async function loadAnalyticsPage() {
    if (!state.chatId) {
      setStatusBanner(tr("status_need_chat"), "error");
      renderAnalyticsPageEmpty(tr("empty_no_chat"));
      return;
    }
    const utils = analyticsUtils();
    if (!utils) {
      setStatusBanner(tr("api_module_missing"), "error");
      renderAnalyticsPageEmpty(tr("api_module_unavailable"));
      return;
    }

    state.isLoading = true;
    try {
      const overviewPayload = await fetchOverviewPayload({ scope: "all" });
      const { periodObj } = applyOverviewMeta(overviewPayload);

      const currentItems = await fetchTransactionsItems({
        scope: "all",
        period: periodObj.mode || state.period,
        start: periodObj.start || state.start,
        end: periodObj.end || state.end,
      });

      const compareRange = getComparisonRange(
        periodObj.mode || state.period,
        periodObj.start || state.start,
        periodObj.end || state.end
      );
      let previousItems = [];
      if (compareRange) {
        previousItems = await fetchTransactionsItems({
          scope: "all",
          period: "custom",
          start: compareRange.start,
          end: compareRange.end,
        });
      }

      const participantBuckets = await loadAnalyticsParticipantBuckets(periodObj);
      state.currentTransactions = currentItems;
      const currentSummary = overviewPayload && overviewPayload.summary ? overviewPayload.summary : {};
      const positiveBalanceStreak = await loadAnalyticsPositiveBalanceStreak(periodObj, Number(currentSummary.balance || 0));

      const report = utils.buildAnalyticsReport({
        currentItems,
        previousItems,
        startIso: periodObj.start || state.start,
        endIso: periodObj.end || state.end,
        periodMode: periodObj.mode || state.period,
        participantBuckets,
        positiveBalanceStreak,
      });

      state.analyticsPage.report = report;
      state.apiUnavailable = false;
      renderAnalyticsPage(report);
      renderBalanceTrendChart(currentItems, report.period.start, report.period.end);
      setStatusBanner("", "info");
    } catch (err) {
      state.apiUnavailable = true;
      state.analyticsPage.report = null;
      setStatusBanner(
        tr("status_api_analytics_error"),
        "error"
      );
      renderAnalyticsPageEmpty(tr("empty_analytics_error"));
      console.error("analytics load failed", err);
      return;
    } finally {
      state.isLoading = false;
    }
  }

  async function openAnalyticsScreen() {
    els.screenTitle.textContent = tr("analytics");
    els.navAdd.classList.remove("hidden");
    if (state.screen !== "analytics" && !state.analyticsPage.scopeBeforeOpen) {
      state.analyticsPage.scopeBeforeOpen = state.scope;
    }
    showScreen("analytics");
    if (!state.analyticsPage.initialized) {
      state.analyticsPage.initialized = true;
      state.period = "month";
      state.start = null;
      state.end = null;
      updatePeriodLabel();
    }
    await loadAnalyticsPage();
  }

  async function reloadDataForCurrentScreen() {
    if (state.screen === "transactions") {
      await loadTransactions();
      return;
    }
    if (state.screen === "analytics") {
      await loadAnalyticsPage();
      return;
    }
    if (state.screen === "home") {
      await loadOverview();
    }
  }

  function bindEvents() {
    els.tabIncome.addEventListener("click", () => {
      if (state.isLoading) return;
      setAnalyticsTab("income");
      renderAnalytics(summaryFromCurrentTransactions(), { start: state.start, end: state.end });
    });
    els.tabExpense.addEventListener("click", () => {
      if (state.isLoading) return;
      setAnalyticsTab("expense");
      renderAnalytics(summaryFromCurrentTransactions(), { start: state.start, end: state.end });
    });

    els.addModeTransactionBtn.addEventListener("click", () => setAddMode("transaction"));
    els.addModeTransferBtn.addEventListener("click", () => setAddMode("transfer"));
    els.addKindExpenseBtn.addEventListener("click", () => setAddKind("expense"));
    els.addKindIncomeBtn.addEventListener("click", () => setAddKind("income"));
    els.addTransferRecipientSelect.addEventListener("change", () => {
      state.addForm.recipientUserId = String(els.addTransferRecipientSelect.value || "");
    });

    els.addAmountInput.addEventListener("input", () => {
      const formatted = formatAmountInput(els.addAmountInput.value);
      state.addForm.amountText = formatted;
      els.addAmountInput.value = formatted;
      if (state.addForm.mode === "transaction" && !state.addForm.categoryManual) {
        triggerAutoCategoryDebounced();
      }
    });

    els.addDescriptionInput.addEventListener("input", () => {
      state.addForm.description = els.addDescriptionInput.value || "";
      if (state.addForm.mode === "transaction" && !state.addForm.categoryManual) {
        triggerAutoCategoryDebounced();
      }
    });

    els.addDateInput.addEventListener("change", () => {
      state.addForm.dateValue = els.addDateInput.value || state.addForm.dateValue;
      const clamped = clampFutureDateTime(state.addForm.dateValue, state.addForm.timeValue || "00:00");
      state.addForm.dateValue = clamped.date;
      state.addForm.timeValue = clamped.time;
      els.addDateInput.value = clamped.date;
      els.addTimeInput.value = clamped.time;
    });

    els.addTimeInput.addEventListener("change", () => {
      state.addForm.timeValue = els.addTimeInput.value || state.addForm.timeValue;
      const clamped = clampFutureDateTime(state.addForm.dateValue, state.addForm.timeValue);
      state.addForm.dateValue = clamped.date;
      state.addForm.timeValue = clamped.time;
      els.addDateInput.value = clamped.date;
      els.addTimeInput.value = clamped.time;
    });

    els.addChangeCategoryBtn.addEventListener("click", openCategorySheet);
    els.closeCategorySheetBtn.addEventListener("click", closeCategorySheet);
    els.categorySheet.addEventListener("click", (e) => {
      if (e.target === els.categorySheet) closeCategorySheet();
    });
    els.addSaveBtn.addEventListener("click", submitAddTransaction);

    els.openScopeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (state.isLoading) return;
      if (els.scopeMenu.classList.contains("hidden")) {
        openScopeMenu();
      } else {
        closeScopeMenu();
      }
    });
    document.addEventListener("click", () => closeScopeMenu());

    els.openDatePanelBtn.addEventListener("click", openDateSheet);
    els.periodBadgeBtn.addEventListener("click", openDateSheet);
    els.closeDateSheetBtn.addEventListener("click", closeDateSheet);
    els.dateSheet.addEventListener("click", (e) => {
      if (e.target === els.dateSheet) closeDateSheet();
    });

    document.querySelectorAll(".quick-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (state.isLoading) return;
        state.period = btn.dataset.period;
        state.start = null;
        state.end = null;
        updatePeriodLabel();
        closeDateSheet();
        await reloadDataForCurrentScreen();
      });
    });

    els.applyCustomPeriodBtn.addEventListener("click", async () => {
      if (state.isLoading) return;
      const startVal = els.customStartDate.value;
      const endVal = els.customEndDate.value;
      if (!startVal || !endVal) return;
      state.period = "custom";
      state.start = startVal;
      state.end = endVal;
      updatePeriodLabel();
      closeDateSheet();
      await reloadDataForCurrentScreen();
    });

    els.viewAllBtn.addEventListener("click", async () => {
      els.screenTitle.textContent = tr("transactions");
      if (state.selectedAnalytics === "income" || state.selectedAnalytics === "expense") {
        state.transactionsTypeFilter = state.selectedAnalytics;
      } else {
        state.transactionsTypeFilter = "all";
      }
      showScreen("transactions");
      await loadTransactions();
    });

    els.navHome.addEventListener("click", async () => {
      els.screenTitle.textContent = tr("home");
      els.navAdd.classList.remove("hidden");
      showScreen("home");
      await loadOverview();
    });

    els.navTransactions.addEventListener("click", async () => {
      els.screenTitle.textContent = tr("transactions");
      state.transactionsTypeFilter = "all";
      els.navAdd.classList.remove("hidden");
      showScreen("transactions");
      await loadTransactions();
    });

    els.navAdd.addEventListener("click", () => {
      const defaultKind = state.selectedAnalytics === "income" ? "income" : "expense";
      openAddScreen(defaultKind);
    });

    els.navConverter.addEventListener("click", async () => {
      await openAnalyticsScreen();
    });

    els.navProfile.addEventListener("click", async () => {
      await openProfileScreen();
    });

    els.profileInfoBtn.addEventListener("click", async () => {
      await openProfileDetail("info");
    });
    els.profileSettingsBtn.addEventListener("click", async () => {
      await openProfileDetail("settings");
    });
    els.profileSupportBtn.addEventListener("click", async () => {
      await openProfileDetail("support");
    });
    els.profileRateBtn.addEventListener("click", async () => {
      await openProfileDetail("review");
    });

    els.profileDetailBackBtn.addEventListener("click", async () => {
      const page = String(state.profile.detailPage || "");
      if (page === "support-message" || page === "support-bug") {
        await openProfileDetail("support");
        return;
      }
      await openProfileScreen();
    });
    els.profileDetailSaveBtn.addEventListener("click", async () => {
      await submitProfileDetail();
    });

    els.profileDetailOpenDevSupportBtn.addEventListener("click", async () => {
      state.profile.supportKind = "message";
      await openProfileDetail("support-message");
    });
    els.profileDetailOpenBugSupportBtn.addEventListener("click", async () => {
      state.profile.supportKind = "bug";
      await openProfileDetail("support-bug");
    });

    els.profileDetailSupportMessageInput.addEventListener("input", () => {
      state.profile.supportMessage = String(els.profileDetailSupportMessageInput.value || "");
    });

    els.profileDetailSupportAttachPhotoBtn.addEventListener("click", () => {
      if (state.profile.supportKind !== "bug") return;
      els.profileDetailSupportPhotoInput.click();
    });

    els.profileDetailSupportRemovePhotoBtn.addEventListener("click", () => {
      clearSupportPhoto();
    });

    els.profileDetailSupportPhotoInput.addEventListener("change", () => {
      const selectedFiles = Array.from(els.profileDetailSupportPhotoInput.files || []);
      if (!selectedFiles.length) {
        if (els.profileDetailSupportPhotoInput) {
          els.profileDetailSupportPhotoInput.value = "";
        }
        return;
      }
      const currentPhotos = supportPhotoItems();
      const freeSlots = Math.max(0, supportBugPhotoLimit - currentPhotos.length);
      if (freeSlots <= 0) {
        showToast(tr("photos_limit_max", { limit: supportBugPhotoLimit }));
        els.profileDetailSupportPhotoInput.value = "";
        return;
      }

      const candidates = selectedFiles.slice(0, freeSlots);
      if (selectedFiles.length > freeSlots) {
        showToast(tr("photos_added_partial", { count: freeSlots, limit: supportBugPhotoLimit }));
      }

      const invalidType = candidates.find((file) => !String(file.type || "").toLowerCase().startsWith("image/"));
      if (invalidType) {
        showToast(tr("only_images"));
        els.profileDetailSupportPhotoInput.value = "";
        return;
      }
      const tooLarge = candidates.find((file) => Number(file.size || 0) > supportBugPhotoMaxBytes);
      if (tooLarge) {
        showToast(tr("photo_size_limit"));
        els.profileDetailSupportPhotoInput.value = "";
        return;
      }

      Promise.all(
        candidates.map(async (file) => ({
          dataUrl: await readImageFileAsDataUrl(file),
          name: String(file.name || "bug-report.jpg"),
          mime: String(file.type || "").toLowerCase() || "image/jpeg",
        }))
      )
        .then((loadedPhotos) => {
          const photos = supportPhotoItems();
          photos.push(...loadedPhotos.slice(0, Math.max(0, supportBugPhotoLimit - photos.length)));
          if (els.profileDetailSupportPhotoInput) {
            els.profileDetailSupportPhotoInput.value = "";
          }
          renderSupportPhotoState();
        })
        .catch((err) => {
          showToast(String((err && err.message) || "").trim() || tr("photo_read_error"));
          if (els.profileDetailSupportPhotoInput) {
            els.profileDetailSupportPhotoInput.value = "";
          }
        });
    });

    els.profileDetailReviewCommentInput.addEventListener("input", () => {
      state.profile.reviewComment = String(els.profileDetailReviewCommentInput.value || "");
    });

    els.profileDetailReviewAgainBtn.addEventListener("click", () => {
      state.profile.reviewEditMode = true;
      renderProfileDetailScreen();
    });

    Array.from(els.profileDetailRatingStars.querySelectorAll("[data-rating]")).forEach((btn) => {
      btn.addEventListener("click", () => {
        setProfileReviewRating(Number(btn.dataset.rating || 0));
        renderProfileDetailScreen();
      });
    });

  }

  async function init() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
    bindEvents();
    setAnalyticsTab(state.selectedAnalytics);
    setAddKind("expense");
    setAddMode("transaction");
    renderTransferRecipients();
    setDefaultAddDateTime();
    renderAddCategoryValue();
    applyUiLanguage();
    renderProfileScreen();
    await loadCategoriesForAdd();
    updatePeriodLabel();
    els.scopeLabel.textContent = tr("scope_all");
    showScreen("home");
    await loadOverview();

    document.addEventListener("visibilitychange", async () => {
      if (document.hidden) return;
      if (state.screen === "transactions") {
        await loadTransactions();
      } else if (state.screen === "profile" || state.screen === "profile-detail") {
        await loadProfile();
      } else if (state.screen === "analytics") {
        await loadAnalyticsPage();
      } else if (state.screen === "home") {
        await loadOverview();
      }
    });

    setInterval(async () => {
      if (document.hidden || state.isLoading) return;
      if (state.screen === "transactions") {
        await loadTransactions();
      } else if (state.screen === "profile" || state.screen === "profile-detail") {
        await loadProfile();
      } else if (state.screen === "analytics") {
        await loadAnalyticsPage();
      } else if (state.screen === "home") {
        await loadOverview();
      }
    }, 15000);
  }

  init();
})();
