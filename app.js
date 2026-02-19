(function () {
  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  if (tg) {
    tg.ready();
    tg.expand();
  }

  const query = new URLSearchParams(window.location.search);
  const chatId = Number(query.get("chat_id") || "0");

  const state = {
    chatId,
    scope: "all",
    period: "today",
    start: null,
    end: null,
    scopeOptions: [],
    screen: "home",
  };

  const els = {
    screenTitle: document.getElementById("screenTitle"),
    scopeLabel: document.getElementById("scopeLabel"),
    scopeMenu: document.getElementById("scopeMenu"),
    openScopeBtn: document.getElementById("openScopeBtn"),
    periodLabel: document.getElementById("periodLabel"),
    openDatePanelBtn: document.getElementById("openDatePanelBtn"),
    periodBadgeBtn: document.getElementById("periodBadgeBtn"),
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

  const chartColors = ["#8f75dd", "#5f9ae6", "#f78f3b", "#36b37e", "#f15b7a", "#4bc0c8", "#c78ef0"];

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
    state.scopeOptions.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "scope-option" + (item.key === selected ? " active" : "");
      btn.textContent = item.label;
      btn.addEventListener("click", () => {
        state.scope = item.key;
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
      const tx = document.createElement("article");
      tx.className = "tx-item";
      tx.innerHTML = `
        <div class="tx-emoji">${item.category_emoji || "📦"}</div>
        <div class="tx-main">
          <div class="tx-title">${item.description || item.category_label || "Операция"}</div>
          <div class="tx-meta">${item.category_label || "Прочее"} • ${fmtDateTime(item.created_at_iso)}</div>
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
      const row = document.createElement("div");
      row.className = "legend-item";
      row.innerHTML = `
        <span class="dot" style="background:${chartColors[idx % chartColors.length]}"></span>
        <span>${item.emoji || "📦"} ${item.label || "Прочее"}</span>
        <strong>${fmtMoney(item.amount, false)}</strong>
      `;
      els.chartLegend.appendChild(row);
    });
  }

  function renderOverview(payload) {
    const selectedScope = payload.scope.selected;
    const scopeItem = payload.scope.options.find((x) => x.key === selectedScope);
    state.scope = selectedScope;
    state.scopeOptions = payload.scope.options;
    els.scopeLabel.textContent = scopeItem ? scopeItem.label : "Общие расходы";

    state.period = payload.period.mode;
    state.start = payload.period.start;
    state.end = payload.period.end;
    els.periodLabel.textContent = payload.period.label;

    els.incomeValue.textContent = fmtMoney(payload.summary.income || 0, false);
    els.expenseValue.textContent = fmtMoney(payload.summary.expense || 0, false);
    els.balanceValue.textContent = fmtMoney(payload.summary.balance || 0, true);

    renderChart(payload.chart || { items: [], total_expense: 0 });
    renderRecent(payload.recent_expenses || []);
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
      tx.className = "tx-item";
      tx.innerHTML = `
        <div class="tx-emoji">${item.category_emoji || "📦"}</div>
        <div class="tx-main">
          <div class="tx-title">${item.description || item.category_label || "Операция"}</div>
          <div class="tx-meta">${item.category_label || "Прочее"} • ${fmtDateTime(item.created_at_iso)}</div>
        </div>
        <div class="tx-amount ${amountCls}">${sign}${fmtMoney(item.amount, false)}</div>
      `;
      els.transactionsList.appendChild(tx);
    });
  }

  async function loadOverview() {
    if (!state.chatId) {
      els.recentList.innerHTML = '<div class="empty">Не передан chat_id для mini-app.</div>';
      return;
    }
    const resp = await fetch(`/miniapp/api/overview?${getApiQuery()}`);
    if (!resp.ok) {
      els.recentList.innerHTML = '<div class="empty">Ошибка загрузки отчёта.</div>';
      return;
    }
    const payload = await resp.json();
    renderOverview(payload);
  }

  async function loadTransactions() {
    if (!state.chatId) {
      els.transactionsList.innerHTML = '<div class="empty">Не передан chat_id для mini-app.</div>';
      return;
    }
    const resp = await fetch(`/miniapp/api/transactions?${getApiQuery()}`);
    if (!resp.ok) {
      els.transactionsList.innerHTML = '<div class="empty">Ошибка загрузки транзакций.</div>';
      return;
    }
    const payload = await resp.json();
    renderTransactions(payload.items || []);
  }

  function bindEvents() {
    els.openScopeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
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
        state.period = btn.dataset.period;
        state.start = null;
        state.end = null;
        closeDateSheet();
        if (state.screen === "transactions") {
          await loadTransactions();
        } else {
          await loadOverview();
        }
      });
    });

    els.applyCustomPeriodBtn.addEventListener("click", async () => {
      const startVal = els.customStartDate.value;
      const endVal = els.customEndDate.value;
      if (!startVal || !endVal) return;
      state.period = "custom";
      state.start = startVal;
      state.end = endVal;
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
    bindEvents();
    showScreen("home");
    await loadOverview();
  }

  init();
})();
