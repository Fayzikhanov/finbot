(function () {
  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  if (tg) {
    tg.ready();
    tg.expand();
  }

  const query = new URLSearchParams(window.location.search);
  const chatId = Number(query.get("chat_id") || "0");
  const apiBaseParam = String(query.get("api_base") || "").trim();

  const state = {
    chatId,
    scope: "all",
    period: "today",
    start: null,
    end: null,
    scopeOptions: [
      { key: "all", label: "Общие расходы" },
      { key: "family", label: "Семейные расходы" },
    ],
    screen: "home",
    isLoading: false,
    apiUnavailable: false,
  };

  const els = {
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
    incomeValue: document.getElementById("incomeValue"),
    expenseValue: document.getElementById("expenseValue"),
    balanceValue: document.getElementById("balanceValue"),
    donut: document.getElementById("donut"),
    donutTotal: document.getElementById("donutTotal"),
    chartLegend: document.getElementById("chartLegend"),
    recentList: document.getElementById("recentList"),
    viewAllBtn: document.getElementById("viewAllBtn"),
    transactionsList: document.getElementById("transactionsList"),
    homeScreen: document.getElementById("homeScreen"),
    transactionsScreen: document.getElementById("transactionsScreen"),
    placeholderScreen: document.getElementById("placeholderScreen"),
    placeholderTitle: document.getElementById("placeholderTitle"),
    navHome: document.getElementById("navHome"),
    navTransactions: document.getElementById("navTransactions"),
    navAdd: document.getElementById("navAdd"),
    navConverter: document.getElementById("navConverter"),
    navProfile: document.getElementById("navProfile"),
  };

  const chartColors = ["#9d92f0", "#9db5ef", "#a7d7c7", "#eec9a4", "#e6b4be", "#cfd4e1"];

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

  function formatDateLabel(value) {
    if (!value) return "";
    const dt = new Date(`${value}T00:00:00`);
    if (Number.isNaN(dt.getTime())) return value;
    return dt.toLocaleDateString("ru-RU");
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

  function fmtShortMoney(amount) {
    const n = Number(amount || 0);
    if (n >= 1000000) {
      return `${Math.round((n / 1000000) * 10) / 10}M`;
    }
    if (n >= 1000) {
      return `${Math.round((n / 1000) * 10) / 10}K`;
    }
    return String(n);
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

  function getApiQuery() {
    const params = new URLSearchParams();
    params.set("chat_id", String(state.chatId));
    params.set("scope", state.scope);
    params.set("period", state.period);
    if (state.period === "custom" && state.start && state.end) {
      params.set("start", state.start);
      params.set("end", state.end);
    }
    return params.toString();
  }

  async function fetchJsonWithFallback(endpoint) {
    const suffix = endpoint.replace(/^\/+/, "");
    const qs = getApiQuery();
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

  function showScreen(name) {
    state.screen = name;
    els.homeScreen.classList.toggle("hidden", name !== "home");
    els.transactionsScreen.classList.toggle("hidden", name !== "transactions");
    els.placeholderScreen.classList.toggle("hidden", name !== "placeholder");

    els.navHome.classList.toggle("active", name === "home");
    els.navTransactions.classList.toggle("active", name === "transactions");
    els.navAdd.classList.toggle("active", false);
    els.navConverter.classList.toggle("active", false);
    els.navProfile.classList.toggle("active", false);
  }

  function showPlaceholder(title) {
    els.placeholderTitle.textContent = title;
    state.screen = "placeholder";
    els.homeScreen.classList.add("hidden");
    els.transactionsScreen.classList.add("hidden");
    els.placeholderScreen.classList.remove("hidden");

    els.navHome.classList.remove("active");
    els.navTransactions.classList.remove("active");
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

  function renderRecent(items) {
    els.recentList.innerHTML = "";
    if (!items || items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "За выбранный период расходов нет.";
      els.recentList.appendChild(empty);
      return;
    }
    items.forEach((item) => {
      const title = escapeHtml(item.description || item.category_label || "Операция");
      const label = escapeHtml(item.category_label || "Прочее");
      const tx = document.createElement("article");
      tx.className = "tx-item";
      tx.innerHTML = `
        <div class="tx-icon expense">${lucideSvg(categoryIconName(item.category_label, "expense"))}</div>
        <div class="tx-main">
          <div class="tx-title">${title}</div>
          <div class="tx-meta">${label} • ${fmtDateTime(item.created_at_iso)}</div>
        </div>
        <div class="tx-amount expense">-${fmtMoney(item.amount, false)}</div>
      `;
      els.recentList.appendChild(tx);
    });
  }

  function renderChart(chart) {
    const items = (chart && chart.items) || [];
    if (!items.length) {
      els.donut.style.background = "conic-gradient(#dedeee 0deg 360deg)";
      els.chartLegend.innerHTML = `<div class="empty">Нет данных по категориям.</div>`;
      els.donutTotal.textContent = "0";
      return;
    }

    let total = 0;
    items.forEach((item) => {
      total += Number(item.amount || 0);
    });
    total = total || 1;

    let angle = 0;
    const parts = items.map((item, idx) => {
      const color = chartColors[idx % chartColors.length];
      const slice = (Number(item.amount || 0) / total) * 360;
      const start = angle;
      const end = angle + slice;
      angle = end;
      return `${color} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`;
    });

    els.donut.style.background = `conic-gradient(${parts.join(", ")})`;
    els.donutTotal.textContent = `${fmtShortMoney(chart.total_expense || 0)}`;

    els.chartLegend.innerHTML = "";
    items.forEach((item, idx) => {
      const label = escapeHtml(item.label || "Прочее");
      const color = chartColors[idx % chartColors.length];
      const row = document.createElement("div");
      row.className = "legend-item";
      row.innerHTML = `
        <span class="legend-icon" style="color:${color}">${lucideSvg(
          categoryIconName(item.label, "expense"),
          { width: 16, height: 16 }
        )}</span>
        <span>${label}</span>
        <strong>${fmtMoney(item.amount, false)}</strong>
      `;
      els.chartLegend.appendChild(row);
    });
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
    els.scopeLabel.textContent = scopeItem ? scopeItem.label : "Общие расходы";

    const periodObj = payload && payload.period ? payload.period : {};
    state.period = periodObj.mode || state.period;
    state.start = periodObj.start || state.start;
    state.end = periodObj.end || state.end;
    updatePeriodLabel();

    const summary = payload && payload.summary ? payload.summary : {};
    els.incomeValue.textContent = fmtMoney(summary.income || 0, false);
    els.expenseValue.textContent = fmtMoney(summary.expense || 0, false);
    els.balanceValue.textContent = fmtMoney(summary.balance || 0, true);

    renderChart(payload.chart || { items: [], total_expense: 0 });
    renderRecent(payload.recent_expenses || []);
    setStatusBanner("", "info");
  }

  function renderTransactions(items) {
    els.transactionsList.innerHTML = "";
    if (!items || items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "Нет транзакций за выбранный период.";
      els.transactionsList.appendChild(empty);
      return;
    }

    items.forEach((item) => {
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
      renderTransactions(payload.items || []);
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
      showScreen("transactions");
      await loadTransactions();
    });

    els.navHome.addEventListener("click", async () => {
      els.screenTitle.textContent = "Главная";
      showScreen("home");
      await loadOverview();
    });

    els.navTransactions.addEventListener("click", async () => {
      els.screenTitle.textContent = "Транзакции";
      showScreen("transactions");
      await loadTransactions();
    });

    els.navAdd.addEventListener("click", () => {
      els.screenTitle.textContent = "Раздел";
      showPlaceholder("+");
    });

    els.navConverter.addEventListener("click", () => {
      els.screenTitle.textContent = "Раздел";
      showPlaceholder("Конвертер");
    });

    els.navProfile.addEventListener("click", () => {
      els.screenTitle.textContent = "Раздел";
      showPlaceholder("Профиль");
    });
  }

  async function init() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
    bindEvents();
    updatePeriodLabel();
    els.scopeLabel.textContent = "Общие расходы";
    showScreen("home");
    await loadOverview();

    document.addEventListener("visibilitychange", async () => {
      if (document.hidden) return;
      if (state.screen === "transactions") {
        await loadTransactions();
      } else {
        await loadOverview();
      }
    });

    setInterval(async () => {
      if (document.hidden || state.isLoading) return;
      if (state.screen === "transactions") {
        await loadTransactions();
      } else {
        await loadOverview();
      }
    }, 15000);
  }

  init();
})();
