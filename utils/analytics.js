(function (global) {
  "use strict";

  function normalizeLangCode(value) {
    const raw = String(value || "").toLowerCase();
    if (raw === "uz") return "uz";
    if (raw === "en") return "en";
    return "ru";
  }

  const L10N = {
    ru: {
      other: "Прочее",
      member: "Участник",
      insight_category_growth: "Категория с наибольшим ростом",
      insight_category_drop: "Самое заметное снижение расходов",
      insight_max_day: "Самый затратный день",
      insight_avg_day_expense: "Средний расход в день",
      period_today: "Сегодня",
      period_week: "На этой неделе",
      period_month: "В этом месяце",
      period_year: "В этом году",
      period_custom: "За выбранный период",
      hero_positive_title: "{period} вы в плюсе",
      hero_positive_subtitle: "Вы тратите меньше, чем зарабатываете",
      hero_expense_up_title: "Расходы выросли",
      hero_income_down_title: "Доходы снизились",
      hero_compare_subtitle: "по сравнению с прошлым периодом",
      hero_negative_title: "{period} вы в минусе",
      hero_negative_subtitle: "Расходы превышают доходы",
      hero_stable_title: "{period} без резких изменений",
      hero_stable_value: "Стабильно",
      hero_stable_subtitle: "Сильных отклонений не видно",
      family_dominant: "{name} — основной источник расходов в семье",
      family_even: "Расходы распределены равномерно",
      financial_danger_label: "Финансовое состояние: Расходы превышают доходы",
      financial_danger_desc: "Текущий темп расходов выше вашего дохода.",
      financial_warning_label: "Финансовое состояние: Есть риск роста расходов",
      financial_warning_desc: "Прогноз расходов близок к уровню дохода.",
      financial_stable_label: "Финансовое состояние: Стабильное",
      financial_stable_desc: "Доход покрывает текущий темп расходов.",
      financial_neutral_label: "Финансовое состояние: Нейтральное",
      financial_neutral_desc: "Нужны данные за больший период для уверенной оценки.",
      streak_month_1: "месяц",
      streak_month_2_4: "месяца",
      streak_month_5: "месяцев",
      streak_week_1: "неделя",
      streak_week_2_4: "недели",
      streak_week_5: "недель",
      streak_year_1: "год",
      streak_year_2_4: "года",
      streak_year_5: "лет",
      streak_day_1: "день",
      streak_day_2_4: "дня",
      streak_day_5: "дней",
      streak_period_1: "период",
      streak_period_2_4: "периода",
      streak_period_5: "периодов",
      gamification_badge: "{count} {periodLabel} подряд в плюсе",
    },
    uz: {
      other: "Boshqa",
      member: "Ishtirokchi",
      insight_category_growth: "Eng ko'p o'sgan kategoriya",
      insight_category_drop: "Xarajatlar eng ko'p kamaygan kategoriya",
      insight_max_day: "Eng ko'p xarajat qilingan kun",
      insight_avg_day_expense: "Kunlik o'rtacha xarajat",
      period_today: "Bugun",
      period_week: "Shu haftada",
      period_month: "Shu oyda",
      period_year: "Shu yilda",
      period_custom: "Tanlangan davrda",
      hero_positive_title: "{period} ijobiy balansdasiz",
      hero_positive_subtitle: "Siz daromaddan kamroq xarajat qilyapsiz",
      hero_expense_up_title: "Xarajatlar oshdi",
      hero_income_down_title: "Daromadlar kamaydi",
      hero_compare_subtitle: "oldingi davrga nisbatan",
      hero_negative_title: "{period} manfiy balansdasiz",
      hero_negative_subtitle: "Xarajatlar daromaddan yuqori",
      hero_stable_title: "{period} keskin o'zgarish yo'q",
      hero_stable_value: "Barqaror",
      hero_stable_subtitle: "Kuchli og'ishlar ko'rinmadi",
      family_dominant: "{name} — oiladagi asosiy xarajat manbai",
      family_even: "Xarajatlar teng taqsimlangan",
      financial_danger_label: "Moliyaviy holat: Xarajatlar daromaddan yuqori",
      financial_danger_desc: "Joriy xarajat sur'ati daromadingizdan yuqori.",
      financial_warning_label: "Moliyaviy holat: Xarajatlar o'sish xavfi bor",
      financial_warning_desc: "Xarajatlar prognozi daromad darajasiga yaqin.",
      financial_stable_label: "Moliyaviy holat: Barqaror",
      financial_stable_desc: "Daromad joriy xarajat sur'atini qoplaydi.",
      financial_neutral_label: "Moliyaviy holat: Neytral",
      financial_neutral_desc: "Ishonchli baho uchun ko'proq davr ma'lumoti kerak.",
      gamification_badge: "{count} {periodLabel} ketma-ket ijobiy balans",
    },
    en: {
      other: "Other",
      member: "Member",
      insight_category_growth: "Category with the biggest increase",
      insight_category_drop: "Most noticeable expense decrease",
      insight_max_day: "Highest-spending day",
      insight_avg_day_expense: "Average daily expense",
      period_today: "Today",
      period_week: "This week",
      period_month: "This month",
      period_year: "This year",
      period_custom: "Selected period",
      hero_positive_title: "{period} you are in the positive",
      hero_positive_subtitle: "You spend less than you earn",
      hero_expense_up_title: "Expenses increased",
      hero_income_down_title: "Income decreased",
      hero_compare_subtitle: "compared to the previous period",
      hero_negative_title: "{period} you are in the negative",
      hero_negative_subtitle: "Expenses exceed income",
      hero_stable_title: "{period} without sharp changes",
      hero_stable_value: "Stable",
      hero_stable_subtitle: "No significant deviations detected",
      family_dominant: "{name} is the main source of family expenses",
      family_even: "Expenses are distributed evenly",
      financial_danger_label: "Financial status: Expenses exceed income",
      financial_danger_desc: "Your current spending pace is above your income.",
      financial_warning_label: "Financial status: Risk of rising expenses",
      financial_warning_desc: "Projected expenses are close to your income level.",
      financial_stable_label: "Financial status: Stable",
      financial_stable_desc: "Income covers the current spending pace.",
      financial_neutral_label: "Financial status: Neutral",
      financial_neutral_desc: "More data is needed for a confident assessment.",
      gamification_badge: "{count} {periodLabel} in a row with positive balance",
    },
  };

  function t(lang, key, vars) {
    const code = normalizeLangCode(lang);
    const pack = L10N[code] || L10N.ru;
    let text = Object.prototype.hasOwnProperty.call(pack, key) ? pack[key] : (L10N.ru[key] || key);
    if (vars && typeof text === "string") {
      Object.keys(vars).forEach((name) => {
        text = text.split(`{${name}}`).join(String(vars[name]));
      });
    }
    return String(text || key);
  }

  function parseDateOnly(value) {
    if (!value) return null;
    const dt = new Date(`${value}T00:00:00`);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  function parseIsoDateTime(value) {
    const dt = new Date(value);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  function toDateOnlyIso(dt) {
    if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return "";
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function addDays(dt, days) {
    const next = new Date(dt);
    next.setDate(next.getDate() + Number(days || 0));
    return next;
  }

  function diffDaysInclusive(startIso, endIso) {
    const start = parseDateOnly(startIso);
    const end = parseDateOnly(endIso);
    if (!start || !end) return 1;
    const diff = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
    return Math.max(1, diff);
  }

  function sum(items, predicate) {
    return (Array.isArray(items) ? items : []).reduce((acc, row) => {
      if (typeof predicate === "function" && !predicate(row)) return acc;
      return acc + Number(row && row.amount ? row.amount : 0);
    }, 0);
  }

  function kindOf(row) {
    return String((row && row.kind) || "");
  }

  function amountOf(row) {
    return Number((row && row.amount) || 0);
  }

  function categoryLabelOf(row, lang) {
    const fallback = t(lang, "other");
    return String((row && row.category_label) || fallback).trim() || fallback;
  }

  function normalizeCategoryKey(label) {
    return String(label || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function buildTotals(items) {
    const income = sum(items, (row) => kindOf(row) === "income");
    const expense = sum(items, (row) => kindOf(row) === "expense");
    return {
      income,
      expense,
      balance: income - expense,
      txCount: Array.isArray(items) ? items.length : 0,
      expenseTxCount: (Array.isArray(items) ? items : []).filter((row) => kindOf(row) === "expense").length,
    };
  }

  function percentChange(currentValue, previousValue) {
    const current = Number(currentValue || 0);
    const prev = Number(previousValue || 0);
    if (prev === 0) {
      if (current === 0) return 0;
      return null;
    }
    return ((current - prev) / prev) * 100;
  }

  function ratioPercent(part, total) {
    const totalNum = Number(total || 0);
    if (totalNum <= 0) return 0;
    return (Number(part || 0) / totalNum) * 100;
  }

  function dayKeyFromTx(row) {
    const dt = parseIsoDateTime(row && row.created_at_iso);
    if (!dt) return "";
    return toDateOnlyIso(new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()));
  }

  function buildDailySums(items, startIso, endIso) {
    const start = parseDateOnly(startIso);
    const end = parseDateOnly(endIso);
    if (!start || !end || start.getTime() > end.getTime()) {
      return { labels: [], income: [], expense: [] };
    }

    const labels = [];
    const income = [];
    const expense = [];
    const dayIndex = new Map();

    let cursor = new Date(start);
    while (cursor.getTime() <= end.getTime()) {
      const key = toDateOnlyIso(cursor);
      dayIndex.set(key, labels.length);
      labels.push(key);
      income.push(0);
      expense.push(0);
      cursor = addDays(cursor, 1);
    }

    (Array.isArray(items) ? items : []).forEach((row) => {
      const key = dayKeyFromTx(row);
      if (!dayIndex.has(key)) return;
      const idx = Number(dayIndex.get(key));
      const amount = amountOf(row);
      if (kindOf(row) === "income") {
        income[idx] += amount;
      } else if (kindOf(row) === "expense") {
        expense[idx] += amount;
      }
    });

    return { labels, income, expense };
  }

  function groupExpensesByCategory(items, lang) {
    const grouped = new Map();
    (Array.isArray(items) ? items : []).forEach((row) => {
      if (kindOf(row) !== "expense") return;
      const amount = amountOf(row);
      if (amount <= 0) return;
      const label = categoryLabelOf(row, lang);
      const key = normalizeCategoryKey(label);
      const bucket = grouped.get(key) || { key, label, amount: 0 };
      bucket.amount += amount;
      grouped.set(key, bucket);
    });
    return Array.from(grouped.values()).sort((a, b) => b.amount - a.amount);
  }

  function buildTopCategories(currentItems, previousItems, limit, lang) {
    const current = groupExpensesByCategory(currentItems, lang);
    const previous = groupExpensesByCategory(previousItems, lang);
    const prevMap = new Map(previous.map((row) => [row.key, Number(row.amount || 0)]));
    const totalExpense = current.reduce((acc, row) => acc + Number(row.amount || 0), 0);
    return current.slice(0, Math.max(0, Number(limit || 3))).map((row) => {
      const previousAmount = Number(prevMap.get(row.key) || 0);
      const deltaAbs = Number(row.amount || 0) - previousAmount;
      return {
        key: row.key,
        label: row.label,
        amount: Number(row.amount || 0),
        sharePct: ratioPercent(row.amount, totalExpense),
        previousAmount,
        deltaAbs,
        deltaPct: percentChange(row.amount, previousAmount),
        // For expenses: lower spending is an improvement.
        trendDirection: deltaAbs < 0 ? "improved" : deltaAbs > 0 ? "worse" : "neutral",
      };
    });
  }

  function buildMetricDelta(currentValue, previousValue, betterWhenHigher) {
    const current = Number(currentValue || 0);
    const previous = Number(previousValue || 0);
    const deltaAbs = current - previous;
    const deltaPct = percentChange(current, previous);
    let direction = "neutral";
    if (deltaAbs !== 0) {
      const better = betterWhenHigher ? deltaAbs > 0 : deltaAbs < 0;
      direction = better ? "improved" : "worse";
    }
    return { current, previous, deltaAbs, deltaPct, direction };
  }

  function buildPeriodComparison(currentItems, previousItems) {
    const currentTotals = buildTotals(currentItems);
    const previousTotals = buildTotals(previousItems);
    return {
      current: currentTotals,
      previous: previousTotals,
      metrics: {
        expense: buildMetricDelta(currentTotals.expense, previousTotals.expense, false),
        income: buildMetricDelta(currentTotals.income, previousTotals.income, true),
        balance: buildMetricDelta(currentTotals.balance, previousTotals.balance, true),
      },
    };
  }

  function buildParticipants(memberBuckets, lang) {
    const uiLang = normalizeLangCode(lang);
    const rows = (Array.isArray(memberBuckets) ? memberBuckets : []).map((bucket) => {
      const items = Array.isArray(bucket && bucket.items) ? bucket.items : [];
      const expenseItems = items.filter((row) => kindOf(row) === "expense");
      const expenseTotal = expenseItems.reduce((acc, row) => acc + amountOf(row), 0);
      const expenseTxCount = expenseItems.length;
      const avgCheck = expenseTxCount > 0 ? expenseTotal / expenseTxCount : 0;
      return {
        userId: Number((bucket && bucket.userId) || 0),
        name: String((bucket && bucket.name) || t(uiLang, "member")),
        expense: expenseTotal,
        txCount: expenseTxCount,
        avgCheck,
      };
    });

    rows.sort((a, b) => b.expense - a.expense || a.name.localeCompare(b.name, uiLang));
    const totalFamilyExpense = rows.reduce((acc, row) => acc + Number(row.expense || 0), 0);
    const topUserId = rows.length ? Number(rows[0].userId || 0) : 0;

    return {
      totalFamilyExpense,
      topUserId,
      rows: rows.map((row) => ({
        userId: row.userId,
        name: row.name,
        expense: row.expense,
        txCount: row.txCount,
        avgCheck: row.avgCheck,
        sharePct: ratioPercent(row.expense, totalFamilyExpense),
        isTopSpender: topUserId > 0 && row.userId === topUserId && row.expense > 0,
      })),
    };
  }

  function buildExpenseDayStats(items, startIso, endIso) {
    const daily = buildDailySums(items, startIso, endIso);
    let maxDay = { date: "", amount: 0 };
    daily.labels.forEach((dateIso, idx) => {
      const amount = Number(daily.expense[idx] || 0);
      if (amount > maxDay.amount) {
        maxDay = { date: dateIso, amount };
      }
    });
    return {
      daily,
      maxDay,
      avgExpensePerDay: (buildTotals(items).expense || 0) / Math.max(1, diffDaysInclusive(startIso, endIso)),
    };
  }

  function monthForecastFromAverage(avgExpensePerDay, endIso) {
    const end = parseDateOnly(endIso);
    if (!end) {
      return {
        applicable: false,
        remainingDaysInMonth: 0,
        projectedExpenseToMonthEnd: 0,
        monthEndIso: "",
      };
    }
    const monthEnd = new Date(end.getFullYear(), end.getMonth() + 1, 0);
    const remainingDaysInMonth = Math.max(0, monthEnd.getDate() - end.getDate());
    return {
      applicable: true,
      remainingDaysInMonth,
      projectedExpenseToMonthEnd: Number(avgExpensePerDay || 0) * remainingDaysInMonth,
      monthEndIso: toDateOnlyIso(monthEnd),
    };
  }

  function buildBiggestExpenseCategoryChange(currentItems, previousItems, lang) {
    const current = groupExpensesByCategory(currentItems, lang);
    const previous = groupExpensesByCategory(previousItems, lang);
    const prevMap = new Map(previous.map((row) => [row.key, row]));
    let bestGrowth = null;
    let bestDrop = null;

    current.forEach((row) => {
      const prev = prevMap.get(row.key);
      const prevAmount = Number((prev && prev.amount) || 0);
      const deltaAbs = Number(row.amount || 0) - prevAmount;
      const deltaPct = percentChange(row.amount, prevAmount);
      const candidate = {
        key: row.key,
        label: row.label,
        currentAmount: Number(row.amount || 0),
        previousAmount: prevAmount,
        deltaAbs,
        deltaPct,
      };
      if (deltaAbs > 0 && (!bestGrowth || deltaAbs > bestGrowth.deltaAbs)) {
        bestGrowth = candidate;
      }
      if (deltaAbs < 0 && (!bestDrop || deltaAbs < bestDrop.deltaAbs)) {
        bestDrop = candidate;
      }
    });

    return { bestGrowth, bestDrop };
  }

  function biggestTransaction(items) {
    let found = null;
    (Array.isArray(items) ? items : []).forEach((row) => {
      const amount = amountOf(row);
      if (!found || amount > found.amount) {
        found = {
          amount,
          kind: kindOf(row),
          categoryLabel: categoryLabelOf(row),
          description: String((row && row.description) || ""),
          createdAtIso: String((row && row.created_at_iso) || ""),
        };
      }
    });
    return found;
  }

  function buildInsights(currentItems, previousItems, startIso, endIso, lang) {
    const uiLang = normalizeLangCode(lang);
    const totals = buildTotals(currentItems);
    const dayStats = buildExpenseDayStats(currentItems, startIso, endIso);
    const catChange = buildBiggestExpenseCategoryChange(currentItems, previousItems, uiLang);
    const insights = [];

    if (catChange.bestGrowth) {
      insights.push({
        key: "category-growth",
        kind: "warning",
        title: t(uiLang, "insight_category_growth"),
        value: catChange.bestGrowth.label,
        amount: catChange.bestGrowth.deltaAbs,
        pct: catChange.bestGrowth.deltaPct,
      });
    } else if (catChange.bestDrop) {
      insights.push({
        key: "category-drop",
        kind: "positive",
        title: t(uiLang, "insight_category_drop"),
        value: catChange.bestDrop.label,
        amount: Math.abs(catChange.bestDrop.deltaAbs),
        pct: catChange.bestDrop.deltaPct,
      });
    }

    if (dayStats.maxDay.date && dayStats.maxDay.amount > 0) {
      insights.push({
        key: "max-day",
        kind: "neutral",
        title: t(uiLang, "insight_max_day"),
        value: dayStats.maxDay.date,
        amount: dayStats.maxDay.amount,
      });
    }

    if (totals.expense > 0) {
      insights.push({
        key: "avg-day-expense",
        kind: "neutral",
        title: t(uiLang, "insight_avg_day_expense"),
        amount: dayStats.avgExpensePerDay,
      });
    }

    return insights.slice(0, 3);
  }

  function heroPeriodPhrase(periodMode, lang) {
    const uiLang = normalizeLangCode(lang);
    if (periodMode === "today") return t(uiLang, "period_today");
    if (periodMode === "week") return t(uiLang, "period_week");
    if (periodMode === "month") return t(uiLang, "period_month");
    if (periodMode === "year") return t(uiLang, "period_year");
    return t(uiLang, "period_custom");
  }

  function buildHeroSummary(currentTotals, trendChange, periodMode, lang) {
    const uiLang = normalizeLangCode(lang);
    const balance = Number((currentTotals && currentTotals.balance) || 0);
    const expensePct = trendChange ? Number(trendChange.expensePct || 0) : 0;
    const incomePct = trendChange ? trendChange.incomePct : null;
    const periodText = heroPeriodPhrase(periodMode, uiLang);

    if (balance > 0) {
      return {
        tone: "positive",
        title: t(uiLang, "hero_positive_title", { period: periodText }),
        valueType: "money",
        value: balance,
        subtitle: t(uiLang, "hero_positive_subtitle"),
      };
    }

    if (Number.isFinite(expensePct) && expensePct > 10) {
      return {
        tone: "warning",
        title: t(uiLang, "hero_expense_up_title"),
        valueType: "percent",
        value: expensePct,
        subtitle: t(uiLang, "hero_compare_subtitle"),
      };
    }

    if (incomePct !== null && Number.isFinite(Number(incomePct)) && Number(incomePct) < 0) {
      return {
        tone: "warning",
        title: t(uiLang, "hero_income_down_title"),
        valueType: "percent",
        value: Math.abs(Number(incomePct)),
        subtitle: t(uiLang, "hero_compare_subtitle"),
      };
    }

    if (balance < 0) {
      return {
        tone: "warning",
        title: t(uiLang, "hero_negative_title", { period: periodText }),
        valueType: "money",
        value: Math.abs(balance),
        subtitle: t(uiLang, "hero_negative_subtitle"),
      };
    }

    return {
      tone: "neutral",
      title: t(uiLang, "hero_stable_title", { period: periodText }),
      valueType: "text",
      valueText: t(uiLang, "hero_stable_value"),
      subtitle: t(uiLang, "hero_stable_subtitle"),
    };
  }

  function buildCategoryFocus(topCategories) {
    const rows = Array.isArray(topCategories) ? topCategories : [];
    return {
      primary: rows.length ? rows[0] : null,
      secondary: rows.slice(1, 3),
    };
  }

  function buildFamilyBehavior(participants, lang) {
    const uiLang = normalizeLangCode(lang);
    const model = participants && typeof participants === "object" ? participants : { rows: [] };
    const rows = Array.isArray(model.rows) ? model.rows : [];
    const leader = rows.length ? rows[0] : null;
    const leaderSharePct = Number((leader && leader.sharePct) || 0);
    const dominant = Boolean(leader && leaderSharePct > 70);

    let statement = "";
    if (leader && Number(leader.expense || 0) > 0) {
      if (dominant) {
        statement = t(uiLang, "family_dominant", { name: leader.name });
      } else {
        statement = t(uiLang, "family_even");
      }
    }

    return {
      dominant,
      leader,
      leaderSharePct,
      statement,
      others: leader ? rows.slice(1) : rows,
    };
  }

  function buildForecast(dayStats, endIso) {
    const avgExpensePerDay = Number((dayStats && dayStats.avgExpensePerDay) || 0);
    const monthForecast = monthForecastFromAverage(avgExpensePerDay, endIso);
    const currentExpense = Number((dayStats && dayStats.currentExpenseTotal) || 0);
    const projectedAdditionalExpense = Number(monthForecast.projectedExpenseToMonthEnd || 0);
    const projectedExpenseToMonthEnd = currentExpense + projectedAdditionalExpense;
    return {
      avgExpensePerDay: Math.round(avgExpensePerDay),
      remainingDaysInMonth: Number(monthForecast.remainingDaysInMonth || 0),
      projectedAdditionalExpense: Math.round(projectedAdditionalExpense),
      projectedExpenseToMonthEnd: Math.round(projectedExpenseToMonthEnd),
      applicable: Boolean(monthForecast.applicable),
      monthEndIso: String(monthForecast.monthEndIso || ""),
    };
  }

  function buildFinancialStatus(currentTotals, forecast, lang) {
    const uiLang = normalizeLangCode(lang);
    const income = Number((currentTotals && currentTotals.income) || 0);
    const expense = Number((currentTotals && currentTotals.expense) || 0);
    const balance = Number((currentTotals && currentTotals.balance) || 0);
    const projected = Number((forecast && forecast.projectedExpenseToMonthEnd) || 0);
    const incomeThreshold = income > 0 ? income * 0.85 : 0;

    if (expense > income || projected > income) {
      return {
        tone: "danger",
        label: t(uiLang, "financial_danger_label"),
        description: t(uiLang, "financial_danger_desc"),
      };
    }

    if (balance > 0 && income > 0 && projected > incomeThreshold) {
      return {
        tone: "warning",
        label: t(uiLang, "financial_warning_label"),
        description: t(uiLang, "financial_warning_desc"),
      };
    }

    if (balance > 0 && projected <= income) {
      return {
        tone: "stable",
        label: t(uiLang, "financial_stable_label"),
        description: t(uiLang, "financial_stable_desc"),
      };
    }

    return {
      tone: "neutral",
      label: t(uiLang, "financial_neutral_label"),
      description: t(uiLang, "financial_neutral_desc"),
    };
  }

  function streakPeriodLabel(periodMode, count, lang) {
    const uiLang = normalizeLangCode(lang);
    const n = Number(count || 0);
    if (uiLang === "uz") {
      if (periodMode === "month") return "oy";
      if (periodMode === "week") return "hafta";
      if (periodMode === "year") return "yil";
      if (periodMode === "today") return "kun";
      return "davr";
    }
    if (uiLang === "en") {
      const plural = n === 1 ? "" : "s";
      if (periodMode === "month") return `month${plural}`;
      if (periodMode === "week") return `week${plural}`;
      if (periodMode === "year") return `year${plural}`;
      if (periodMode === "today") return `day${plural}`;
      return `period${plural}`;
    }
    if (periodMode === "month") return n >= 5 ? t(uiLang, "streak_month_5") : n >= 2 && n <= 4 ? t(uiLang, "streak_month_2_4") : t(uiLang, "streak_month_1");
    if (periodMode === "week") return n >= 5 || n === 0 ? t(uiLang, "streak_week_5") : n >= 2 && n <= 4 ? t(uiLang, "streak_week_2_4") : t(uiLang, "streak_week_1");
    if (periodMode === "year") return n >= 5 ? t(uiLang, "streak_year_5") : n >= 2 && n <= 4 ? t(uiLang, "streak_year_2_4") : t(uiLang, "streak_year_1");
    if (periodMode === "today") return n >= 5 || n === 0 ? t(uiLang, "streak_day_5") : n >= 2 && n <= 4 ? t(uiLang, "streak_day_2_4") : t(uiLang, "streak_day_1");
    return n >= 5 || n === 0 ? t(uiLang, "streak_period_5") : n >= 2 && n <= 4 ? t(uiLang, "streak_period_2_4") : t(uiLang, "streak_period_1");
  }

  function buildGamification(periodMode, positiveBalanceStreak, lang) {
    const uiLang = normalizeLangCode(lang);
    const count = Number(positiveBalanceStreak || 0);
    if (!Number.isFinite(count) || count < 2) return null;
    return {
      positiveBalanceStreak: count,
      badgeText: t(uiLang, "gamification_badge", {
        count,
        periodLabel: streakPeriodLabel(periodMode, count, uiLang),
      }),
    };
  }

  function buildInterpretationInsights(baseInsights, categoryFocus) {
    const rows = Array.isArray(baseInsights) ? baseInsights : [];
    const mapped = [];
    const primary = categoryFocus && categoryFocus.primary ? categoryFocus.primary : null;
    if (primary && Number(primary.sharePct || 0) > 0) {
      mapped.push({
        key: "category-share",
        kind: "neutral",
        categoryLabel: String(primary.label || ""),
        sharePct: Math.round(Number(primary.sharePct || 0)),
      });
    }

    rows.forEach((item) => {
      if (item.key === "max-day") {
        mapped.push({
          key: "max-day",
          kind: "neutral",
          dateIso: String(item.value || ""),
          amount: Math.round(Number(item.amount || 0)),
        });
      } else if (item.key === "avg-day-expense") {
        mapped.push({
          key: "avg-day-expense",
          kind: "neutral",
          amount: Math.round(Number(item.amount || 0)),
        });
      } else if (item.key === "category-growth" && !primary) {
        mapped.push({
          key: "category-growth",
          kind: "warning",
          categoryLabel: String(item.value || ""),
          pct: item.pct,
          amount: Math.round(Number(item.amount || 0)),
        });
      }
    });

    return mapped.slice(0, 3);
  }

  function buildAnalyticsReport(options) {
    const lang = normalizeLangCode(options && options.lang);
    const currentItems = Array.isArray(options && options.currentItems) ? options.currentItems : [];
    const previousItems = Array.isArray(options && options.previousItems) ? options.previousItems : [];
    const startIso = String((options && options.startIso) || "");
    const endIso = String((options && options.endIso) || "");
    const periodMode = String((options && options.periodMode) || "custom");
    const participantBuckets = Array.isArray(options && options.participantBuckets) ? options.participantBuckets : [];
    const positiveBalanceStreak = Number((options && options.positiveBalanceStreak) || 0);

    const currentTotals = buildTotals(currentItems);
    const previousTotals = buildTotals(previousItems);
    const comparison = buildPeriodComparison(currentItems, previousItems);
    const topCategories = buildTopCategories(currentItems, previousItems, 3, lang);
    const categoryFocus = buildCategoryFocus(topCategories);
    const participants = buildParticipants(participantBuckets, lang);
    const dayStats = buildExpenseDayStats(currentItems, startIso, endIso);
    dayStats.currentExpenseTotal = currentTotals.expense;
    const trendChange = {
      expensePct: percentChange(currentTotals.expense, previousTotals.expense),
      incomePct: percentChange(currentTotals.income, previousTotals.income),
    };
    const forecast = buildForecast(dayStats, endIso);
    const insights = buildInterpretationInsights(
      buildInsights(currentItems, previousItems, startIso, endIso, lang),
      categoryFocus
    );
    const previousPeriodTotal = Number(previousTotals.expense || 0) + Number(previousTotals.income || 0);

    return {
      period: {
        mode: periodMode,
        start: startIso,
        end: endIso,
        daysCount: diffDaysInclusive(startIso, endIso),
      },
      totals: currentTotals,
      previousTotals,
      hasPreviousPeriodData: previousPeriodTotal > 0,
      trendChange,
      comparison,
      topCategories,
      categoryFocus,
      participants,
      familyBehavior: buildFamilyBehavior(participants, lang),
      hero: buildHeroSummary(currentTotals, trendChange, periodMode, lang),
      forecast,
      financialStatus: buildFinancialStatus(currentTotals, forecast, lang),
      gamification: buildGamification(periodMode, positiveBalanceStreak, lang),
      insights,
    };
  }

  global.FinAnalyticsUtils = {
    buildAnalyticsReport,
    buildTotals,
    buildPeriodComparison,
    buildTopCategories,
    buildParticipants,
    buildInsights,
    buildHeroSummary,
    buildDailySums,
    percentChange,
    diffDaysInclusive,
  };
})(window);
