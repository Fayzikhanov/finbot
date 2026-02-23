(function () {
  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
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
      supportPhotoDataUrl: "",
      supportPhotoName: "",
      supportPhotoMime: "",
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
    profileDetailSupportPhotoPreview: document.getElementById("profileDetailSupportPhotoPreview"),
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
  const periodLabels = {
    today: "Сегодня",
    week: "Неделя",
    month: "Месяц",
    year: "Год",
    custom: "Период",
  };
  const profileLocalSettingsKey = "finbot-miniapp-profile-settings-v1";
  const languageLabels = {
    ru: "Русский",
    uz: "O'zbekcha",
    en: "English",
  };
  const currencyLabels = {
    UZS: "UZS",
    USD: "USD",
    EUR: "EUR",
    RUB: "RUB",
  };

  function formatDateLabel(value) {
    if (!value) return "";
    const dt = new Date(`${value}T00:00:00`);
    if (Number.isNaN(dt.getTime())) return value;
    return dt.toLocaleDateString("ru-RU");
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
    els.periodLabel.textContent = periodLabels[state.period] || "Сегодня";
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
    return `${sign}${new Intl.NumberFormat("ru-RU").format(absVal)} сум`;
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
    return String(label || "Прочее")
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
      const amountStr = new Intl.NumberFormat("ru-RU").format(amount);
      const len = amountStr.length;
      els.donutTotal.classList.remove("small", "xsmall");
      if (len >= 11) {
        els.donutTotal.classList.add("xsmall");
      } else if (len >= 9) {
        els.donutTotal.classList.add("small");
      }
      els.donutTotal.innerHTML = `
        <span class="money-amount">${amountStr}</span>
        <span class="money-currency">сум</span>
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
    els.donutSub.textContent = "Всего за период";
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
        <svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Разбивка расходов">
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
      <svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Разбивка расходов">
        <circle class="donut-track" cx="${center}" cy="${center}" r="${(outerRadius + innerRadius) / 2}" />
        ${segments}
      </svg>
    `;
  }

  function renderLegend(items, activeKey) {
    els.chartLegend.innerHTML = "";
    if (!items.length) {
      els.chartLegend.innerHTML = '<div class="empty">Нет данных по категориям.</div>';
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
    if (sameDay) return `Сегодня, ${hh}:${mm}`;
    if (isYesterday) return `Вчера, ${hh}:${mm}`;
    return `${dt.toLocaleDateString("ru-RU")} ${hh}:${mm}`;
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
    return new Intl.NumberFormat("ru-RU").format(Number(digits));
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
    if (!raw) return String(fallbackText || "Ошибка");
    if (/HTTP 404\b/i.test(raw)) {
      return "MiniApp API не обновлён (404). Перезапустите бот и miniapp server.";
    }
    if (/support chat is not configured/i.test(raw)) {
      return "Поддержка не настроена: проверьте ADMIN_CHAT_ID";
    }
    if (/Failed to fetch|NetworkError|api unavailable/i.test(raw)) {
      return "Нет связи с miniapp server";
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
    const source = user.fullName || user.username || "Пользователь";
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
    return `Пользователь ${tgUser.telegramId || ""}`.trim();
  }

  function profileSubtitleValue() {
    const tgUser = profileUserView();
    const parts = [];
    if (tgUser.username) parts.push(`@${tgUser.username}`);
    if (tgUser.telegramId) parts.push(`ID ${tgUser.telegramId}`);
    if (parts.length === 0) return "Данные Telegram";
    return parts.join(" • ");
  }

  function profileFieldValue(value, fallback) {
    const text = String(value || "").trim();
    return text || (fallback || "Не указано");
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

  function renderSupportPhotoState() {
    const isBug = state.profile.supportKind === "bug";
    const hasPhoto = Boolean(state.profile.supportPhotoDataUrl);
    els.profileDetailSupportPhotoWrap.classList.toggle("hidden", !isBug);
    els.profileDetailSupportRemovePhotoBtn.classList.toggle("hidden", !hasPhoto);
    if (hasPhoto) {
      els.profileDetailSupportPhotoMeta.textContent =
        state.profile.supportPhotoName || "Фото выбрано";
      els.profileDetailSupportPhotoPreview.src = state.profile.supportPhotoDataUrl;
      els.profileDetailSupportPhotoPreview.classList.remove("hidden");
    } else {
      els.profileDetailSupportPhotoMeta.textContent = "Фото не выбрано";
      els.profileDetailSupportPhotoPreview.removeAttribute("src");
      els.profileDetailSupportPhotoPreview.classList.add("hidden");
    }
  }

  function clearSupportPhoto() {
    state.profile.supportPhotoDataUrl = "";
    state.profile.supportPhotoName = "";
    state.profile.supportPhotoMime = "";
    if (els.profileDetailSupportPhotoInput) {
      els.profileDetailSupportPhotoInput.value = "";
    }
    renderSupportPhotoState();
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

  function updateProfileSectionMeta() {
    const profileData = normalizeProfileData(state.profile.data || {});
    state.profile.data = profileData;
    const hasPhone = String(profileData.phone || "").trim();
    const hasEmail = String(profileData.email || "").trim();
    const contactsCount = [hasPhone, hasEmail].filter(Boolean).length;
    els.profileInfoMeta.textContent = contactsCount
      ? `Контактов заполнено: ${contactsCount}`
      : "Имя, username и контакты";
    els.profileSettingsMeta.textContent = `${currencyLabels[profileData.currency]} • ${languageLabels[profileData.language]}`;
    els.profileSupportMeta.textContent = "Связь с разработчиком и баг-репорт";

    const latestReview = profileData.latest_review;
    if (latestReview && Number(latestReview.rating || 0) >= 1) {
      els.profileRateBtn.querySelector(".profile-row-meta").textContent = `Текущая оценка: ${latestReview.rating}/5`;
    } else {
      els.profileRateBtn.querySelector(".profile-row-meta").textContent = "Оставить оценку и отзыв";
    }
  }

  function renderProfileScreen() {
    if (!els.profileScreen) return;
    renderProfileHeader();
    updateProfileSectionMeta();
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }

  function profileDetailPageConfig(page) {
    if (page === "support-message") {
      return {
        title: "Связь с разработчиком",
        subtitle: "Напишите сообщение",
        actionLabel: "Отправить",
      };
    }
    if (page === "support-bug") {
      return {
        title: "Сообщить об ошибке",
        subtitle: "Описание и фото (опционально)",
        actionLabel: "Отправить",
      };
    }
    if (page === "settings") {
      return {
        title: "Настройки",
        subtitle: "Язык и валюта",
        actionLabel: "Сохранить",
      };
    }
    if (page === "support") {
      return {
        title: "Поддержка",
        subtitle: "Связь с разработчиком и ошибки",
        actionLabel: "Отправить",
      };
    }
    if (page === "review") {
      return {
        title: "Оценить бота",
        subtitle: "Оценка и комментарий",
        actionLabel: "Отправить оценку",
      };
    }
    return {
      title: "Личная информация",
      subtitle: "Ваши данные профиля",
      actionLabel: "Сохранить",
    };
  }

  function setProfileSupportKind(kind) {
    state.profile.supportKind = kind === "bug" ? "bug" : "message";
    const isBug = state.profile.supportKind === "bug";
    els.profileDetailSupportMessageLabel.textContent = isBug ? "Описание ошибки" : "Сообщение разработчику";
    els.profileDetailSupportMessageInput.placeholder = isBug
      ? "Что произошло, как повторить, что ожидали увидеть"
      : "Напишите сообщение разработчику";
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
        rating > 0 ? `Ваша оценка: ${rating}/5` : "Можно оставить комментарий (необязательно).";
    }
  }

  function syncProfileDetailInputsFromState() {
    const profileData = normalizeProfileData(state.profile.data || {});
    state.profile.data = profileData;
    const user = profileUserView();
    const page = state.profile.detailPage || "";

    if (page === "info") {
      els.profileDetailInfoUsername.textContent = user.username ? `@${user.username}` : "Не указано";
      els.profileDetailInfoTelegramId.textContent = user.telegramId ? String(user.telegramId) : "Не указано";
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
        els.profileDetailExistingReviewComment.textContent = String(latest.comment || "").trim() || "Без комментария";
      }
      els.profileDetailReviewCommentInput.value = String(state.profile.reviewComment || "");
      setProfileReviewRating(state.profile.reviewRating || 0);
      els.profileDetailRatingStars.classList.toggle("hidden", hasExisting && !state.profile.reviewEditMode);
      const reviewCommentField = els.profileDetailReviewCommentInput.closest(".field");
      if (reviewCommentField) {
        reviewCommentField.classList.toggle("hidden", hasExisting && !state.profile.reviewEditMode);
      }
    }
  }

  function renderProfileDetailScreen() {
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
      els.profileDetailSaveBtn.textContent = "Оценить заново";
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
      showToast(userFacingApiError(err, "Профиль загружен частично (без сервера)"));
    } finally {
      state.profile.loading = false;
    }
  }

  async function saveProfileData(changes, successText) {
    const next = normalizeProfileData(Object.assign({}, state.profile.data || {}, changes || {}));
    state.profile.data = next;
    persistLocalProfileSettingsFromData();
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
      renderProfileScreen();
      renderProfileDetailScreen();
      showToast(successText || "Сохранено");
    } catch (err) {
      console.error("profile save failed", err);
      showToast(userFacingApiError(err, "Не удалось сохранить. Попробуйте ещё раз."));
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
      showToast("Проверьте email");
      return;
    }
    if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      showToast("Некорректная дата рождения");
      return;
    }

    await saveProfileData(
      {
        display_name: displayName,
        phone,
        email,
        birth_date: birthDate,
      },
      "Личные данные сохранены"
    );
  }

  async function saveProfileSettingsPage() {
    const currency = normalizeCurrencyCode(els.profileDetailCurrencySelect.value);
    const language = normalizeLanguageCode(els.profileDetailLanguageSelect.value);
    await saveProfileData({ currency, language }, "Настройки сохранены");
  }

  async function sendProfileSupport() {
    const kind = state.profile.supportKind === "bug" ? "bug" : "message";
    const message = String(els.profileDetailSupportMessageInput.value || "").trim();
    const hasPhoto = kind === "bug" && Boolean(state.profile.supportPhotoDataUrl);
    if (!message && !(kind === "bug" && hasPhoto)) {
      showToast(kind === "bug" ? "Опишите ошибку" : "Введите сообщение");
      return;
    }
    if (state.profile.saving) return;
    state.profile.saving = true;
    renderProfileDetailScreen();
    try {
      await postJsonWithFallback("support", {
        kind,
        message: message || (kind === "bug" && hasPhoto ? "Фото без описания" : ""),
        photo_base64: kind === "bug" ? state.profile.supportPhotoDataUrl || "" : "",
        photo_name: kind === "bug" ? state.profile.supportPhotoName || "" : "",
        photo_mime: kind === "bug" ? state.profile.supportPhotoMime || "" : "",
      });
      state.profile.supportMessage = "";
      els.profileDetailSupportMessageInput.value = "";
      if (kind === "bug") {
        clearSupportPhoto();
      }
      showToast(kind === "bug" ? "Ошибка отправлена разработчику" : "Сообщение отправлено");
    } catch (err) {
      console.error("support send failed", err);
      showToast(userFacingApiError(err, "Не удалось отправить сообщение"));
    } finally {
      state.profile.saving = false;
      renderProfileDetailScreen();
    }
  }

  async function submitProfileReview() {
    const rating = Number(state.profile.reviewRating || 0);
    const comment = String(els.profileDetailReviewCommentInput.value || "").trim();
    if (rating < 1 || rating > 5) {
      showToast("Выберите оценку");
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
      showToast("Спасибо за оценку");
    } catch (err) {
      console.error("review submit failed", err);
      showToast(userFacingApiError(err, "Не удалось отправить оценку"));
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
    els.screenTitle.textContent = "Профиль";
    state.profile.detailPage = "";
    els.navAdd.classList.remove("hidden");
    showScreen("profile");
    renderProfileScreen();
    await loadProfile();
  }

  function showScreen(name) {
    state.screen = name;
    const isAddScreen = name === "add";
    const isProfileScreen = name === "profile";
    const isProfileDetailScreen = name === "profile-detail";
    els.appRoot.classList.toggle("is-add-screen", isAddScreen);
    els.appRoot.classList.toggle("is-profile-screen", isProfileScreen);
    els.appRoot.classList.toggle("is-profile-detail-screen", isProfileDetailScreen);
    els.homeScreen.classList.toggle("hidden", name !== "home");
    els.transactionsScreen.classList.toggle("hidden", name !== "transactions");
    els.addScreen.classList.toggle("hidden", name !== "add");
    els.profileScreen.classList.toggle("hidden", name !== "profile");
    els.profileDetailScreen.classList.toggle("hidden", name !== "profile-detail");
    els.placeholderScreen.classList.toggle("hidden", name !== "placeholder");
    els.profileDetailActionsBar.classList.toggle("hidden", name !== "profile-detail");

    els.navHome.classList.toggle("active", name === "home");
    els.navTransactions.classList.toggle("active", name === "transactions");
    els.navAdd.classList.toggle("active", name === "add");
    els.navConverter.classList.toggle("active", false);
    els.navProfile.classList.toggle("active", name === "profile" || name === "profile-detail");
    els.navAdd.classList.toggle("hidden", name === "add" || name === "profile-detail");

    if (isAddScreen || isProfileScreen || isProfileDetailScreen) {
      closeScopeMenu();
      closeDateSheet();
      setStatusBanner("", "info");
    }
  }

  function showPlaceholder(title) {
    els.placeholderTitle.textContent = title;
    state.screen = "placeholder";
    els.appRoot.classList.remove("is-add-screen", "is-profile-screen", "is-profile-detail-screen");
    els.homeScreen.classList.add("hidden");
    els.transactionsScreen.classList.add("hidden");
    els.addScreen.classList.add("hidden");
    els.profileScreen.classList.add("hidden");
    els.profileDetailScreen.classList.add("hidden");
    els.placeholderScreen.classList.remove("hidden");
    els.profileDetailActionsBar.classList.add("hidden");

    els.navHome.classList.remove("active");
    els.navTransactions.classList.remove("active");
    els.navAdd.classList.remove("hidden");
    els.navAdd.classList.toggle("active", title === "+");
    els.navConverter.classList.toggle("active", title === "Конвертер");
    els.navProfile.classList.toggle("active", title === "Профиль");
  }

  function renderScopeMenu() {
    const selected = state.scope;
    els.scopeMenu.innerHTML = "";
    const options = Array.isArray(state.scopeOptions) ? state.scopeOptions : [];
    if (options.length === 0) {
      const row = document.createElement("div");
      row.className = "scope-empty";
      row.textContent = "Нет вариантов";
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
        if (state.screen === "transactions") {
          loadTransactions();
        } else {
          loadOverview();
        }
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
      const label = String((option && option.label) || `Участник ${userId}`).trim() || `Участник ${userId}`;
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
    placeholder.textContent = recipients.length ? "Выберите участника" : "Нет второго участника";
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
      ? "Комментарий (необязательно)"
      : "Название транзакции";
    els.addDescriptionInput.placeholder = isTransfer
      ? "Например: перевод за продукты"
      : "Например: коммуналка";

    els.addSaveBtn.innerHTML = isTransfer
      ? `${lucideSvg("repeat-2")}Сохранить перевод`
      : `${lucideSvg("check-circle-2")}Сохранить`;

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
    const label = state.addForm.categoryLabel || "Определяю автоматически…";
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
    if (amount <= 0) return "Введите сумму больше 0";
    if (!state.addForm.dateValue || !state.addForm.timeValue) return "Укажите дату и время";

    if (state.addForm.mode === "transfer") {
      const recipientId = Number(state.addForm.recipientUserId || 0);
      if (!recipientId) return "Выберите получателя перевода";
      if (recipientId === Number(state.currentUserId || 0)) {
        return "Нельзя переводить самому себе";
      }
    } else {
      if (!String(state.addForm.description || "").trim()) return "Введите название транзакции";
      if (!state.addForm.kind) return "Выберите тип транзакции";
    }

    const now = new Date();
    const selected = new Date(addFormDateTimeIso());
    if (Number.isNaN(selected.getTime())) return "Некорректная дата или время";
    if (selected > now) return "Нельзя выбрать дату/время в будущем";
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
        showToast("Перевод сохранён");
      } else {
        const payload = {
          kind: state.addForm.kind,
          amount,
          description: String(state.addForm.description || "").trim(),
          category: state.addForm.categoryKey || undefined,
          datetime_local: addFormDateTimeIso(),
        };
        await postJsonWithFallback("create_transaction", payload);
        showToast("Сохранено");
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
      els.screenTitle.textContent = "Главная";
      showScreen("home");
    } catch (submitErr) {
      console.error("create transaction failed", submitErr);
      showToast(`Ошибка: ${String(submitErr.message || "не удалось сохранить")}`);
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
    els.screenTitle.textContent = "Добавить транзакцию";
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
      const label = String(row.category_label || "Прочее").trim() || "Прочее";
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
        empty.textContent = "Пока нет доходов за этот период";
      } else if (kind === "expense") {
        empty.textContent = "Пока нет расходов за этот период";
      } else {
        empty.textContent = "Пока нет транзакций за этот период";
      }
      wrap.appendChild(empty);
      if (kind === "income" || kind === "expense") {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "empty-action-btn";
        btn.textContent = kind === "income" ? "Добавить доход" : "Добавить расход";
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
      const title = escapeHtml(item.description || item.category_label || "Операция");
      const label = escapeHtml(item.category_label || "Прочее");
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
      <span class="trend-legend-item"><span class="trend-legend-dot income"></span>Доходы</span>
      <span class="trend-legend-item"><span class="trend-legend-dot expense"></span>Расходы</span>
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
      els.chartSectionTitle.textContent = "Разбивка доходов";
      els.recentSectionTitle.textContent = "Последние доходы";
      renderChartFromBreakdown(buildBreakdownByType("income"));
      renderRecent(getRecentByType("income", 5), "income");
      return;
    }

    els.chartSectionTitle.textContent = "Разбивка расходов";
    els.recentSectionTitle.textContent = "Последние расходы";
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

  function renderOverview(payload) {
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
    els.scopeLabel.textContent = scopeItem ? scopeItem.label : "Общие расходы";

    const periodObj = payload && payload.period ? payload.period : {};
    state.period = periodObj.mode || state.period;
    state.start = periodObj.start || state.start;
    state.end = periodObj.end || state.end;
    updatePeriodLabel();

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
          ? "Нет доходов за выбранный период."
          : typeFilter === "expense"
            ? "Нет расходов за выбранный период."
            : "Нет транзакций за выбранный период.";
      els.transactionsList.appendChild(empty);
      return;
    }

    filtered.forEach((item) => {
      const tx = document.createElement("article");
      const amountCls = item.kind === "income" ? "income" : "expense";
      const sign = item.kind === "income" ? "+" : "-";
      const title = escapeHtml(item.description || item.category_label || "Операция");
      const label = escapeHtml(item.category_label || "Прочее");
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

  async function loadOverview() {
    if (!state.chatId) {
      setStatusBanner("Не передан chat_id. Откройте приложение из группы через кнопку бота.", "error");
      els.recentList.innerHTML = '<div class="empty">Нет данных по текущему чату.</div>';
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
        "Не удалось загрузить данные. Проверьте API mini-app (домен /api).",
        "error"
      );
      els.recentList.innerHTML = '<div class="empty">Ошибка загрузки отчёта.</div>';
      console.error("overview fetch failed", err);
      return;
    } finally {
      state.isLoading = false;
    }
  }

  async function loadTransactions() {
    if (!state.chatId) {
      setStatusBanner("Не передан chat_id. Откройте приложение из группы через кнопку бота.", "error");
      els.transactionsList.innerHTML = '<div class="empty">Нет данных по текущему чату.</div>';
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
        "Не удалось загрузить транзакции. Проверьте API mini-app (домен /api).",
        "error"
      );
      els.transactionsList.innerHTML = '<div class="empty">Ошибка загрузки транзакций.</div>';
      console.error("transactions fetch failed", err);
      return;
    } finally {
      state.isLoading = false;
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
        if (state.screen === "transactions") {
          await loadTransactions();
        } else {
          await loadOverview();
        }
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
      if (state.screen === "transactions") {
        await loadTransactions();
      } else {
        await loadOverview();
      }
    });

    els.viewAllBtn.addEventListener("click", async () => {
      els.screenTitle.textContent = "Транзакции";
      if (state.selectedAnalytics === "income" || state.selectedAnalytics === "expense") {
        state.transactionsTypeFilter = state.selectedAnalytics;
      } else {
        state.transactionsTypeFilter = "all";
      }
      showScreen("transactions");
      await loadTransactions();
    });

    els.navHome.addEventListener("click", async () => {
      els.screenTitle.textContent = "Главная";
      els.navAdd.classList.remove("hidden");
      showScreen("home");
      await loadOverview();
    });

    els.navTransactions.addEventListener("click", async () => {
      els.screenTitle.textContent = "Транзакции";
      state.transactionsTypeFilter = "all";
      els.navAdd.classList.remove("hidden");
      showScreen("transactions");
      await loadTransactions();
    });

    els.navAdd.addEventListener("click", () => {
      const defaultKind = state.selectedAnalytics === "income" ? "income" : "expense";
      openAddScreen(defaultKind);
    });

    els.navConverter.addEventListener("click", () => {
      els.screenTitle.textContent = "Раздел";
      els.navAdd.classList.remove("hidden");
      showPlaceholder("Конвертер");
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
      const file = els.profileDetailSupportPhotoInput.files && els.profileDetailSupportPhotoInput.files[0];
      if (!file) {
        clearSupportPhoto();
        return;
      }
      const mime = String(file.type || "").toLowerCase();
      if (!mime.startsWith("image/")) {
        showToast("Нужен файл изображения");
        clearSupportPhoto();
        return;
      }
      if (Number(file.size || 0) > 4 * 1024 * 1024) {
        showToast("Фото слишком большое (до 4 МБ)");
        clearSupportPhoto();
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        if (!result.startsWith("data:")) {
          showToast("Не удалось прочитать фото");
          clearSupportPhoto();
          return;
        }
        state.profile.supportPhotoDataUrl = result;
        state.profile.supportPhotoName = String(file.name || "bug-report.jpg");
        state.profile.supportPhotoMime = mime || "image/jpeg";
        renderSupportPhotoState();
      };
      reader.onerror = () => {
        showToast("Не удалось прочитать фото");
        clearSupportPhoto();
      };
      reader.readAsDataURL(file);
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
    renderProfileScreen();
    await loadCategoriesForAdd();
    updatePeriodLabel();
    els.scopeLabel.textContent = "Общие расходы";
    showScreen("home");
    await loadOverview();

    document.addEventListener("visibilitychange", async () => {
      if (document.hidden) return;
      if (state.screen === "transactions") {
        await loadTransactions();
      } else if (state.screen === "profile" || state.screen === "profile-detail") {
        await loadProfile();
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
      } else if (state.screen === "home") {
        await loadOverview();
      }
    }, 15000);
  }

  init();
})();
