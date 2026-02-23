(function (global) {
  "use strict";

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

  function categoryLabelOf(row) {
    return String((row && row.category_label) || "Прочее").trim() || "Прочее";
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

  function groupExpensesByCategory(items) {
    const grouped = new Map();
    (Array.isArray(items) ? items : []).forEach((row) => {
      if (kindOf(row) !== "expense") return;
      const amount = amountOf(row);
      if (amount <= 0) return;
      const label = categoryLabelOf(row);
      const key = normalizeCategoryKey(label);
      const bucket = grouped.get(key) || { key, label, amount: 0 };
      bucket.amount += amount;
      grouped.set(key, bucket);
    });
    return Array.from(grouped.values()).sort((a, b) => b.amount - a.amount);
  }

  function buildTopCategories(currentItems, previousItems, limit) {
    const current = groupExpensesByCategory(currentItems);
    const previous = groupExpensesByCategory(previousItems);
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

  function buildParticipants(memberBuckets) {
    const rows = (Array.isArray(memberBuckets) ? memberBuckets : []).map((bucket) => {
      const items = Array.isArray(bucket && bucket.items) ? bucket.items : [];
      const expenseItems = items.filter((row) => kindOf(row) === "expense");
      const expenseTotal = expenseItems.reduce((acc, row) => acc + amountOf(row), 0);
      const expenseTxCount = expenseItems.length;
      const avgCheck = expenseTxCount > 0 ? expenseTotal / expenseTxCount : 0;
      return {
        userId: Number((bucket && bucket.userId) || 0),
        name: String((bucket && bucket.name) || "Участник"),
        expense: expenseTotal,
        txCount: expenseTxCount,
        avgCheck,
      };
    });

    rows.sort((a, b) => b.expense - a.expense || a.name.localeCompare(b.name, "ru"));
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

  function buildBiggestExpenseCategoryChange(currentItems, previousItems) {
    const current = groupExpensesByCategory(currentItems);
    const previous = groupExpensesByCategory(previousItems);
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

  function buildInsights(currentItems, previousItems, startIso, endIso) {
    const totals = buildTotals(currentItems);
    const dayStats = buildExpenseDayStats(currentItems, startIso, endIso);
    const catChange = buildBiggestExpenseCategoryChange(currentItems, previousItems);
    const maxTx = biggestTransaction(currentItems);
    const insights = [];

    if (catChange.bestGrowth) {
      insights.push({
        key: "category-growth",
        kind: "warning",
        title: "Категория с наибольшим ростом",
        value: catChange.bestGrowth.label,
        amount: catChange.bestGrowth.deltaAbs,
        pct: catChange.bestGrowth.deltaPct,
      });
    } else if (catChange.bestDrop) {
      insights.push({
        key: "category-drop",
        kind: "positive",
        title: "Самое заметное снижение расходов",
        value: catChange.bestDrop.label,
        amount: Math.abs(catChange.bestDrop.deltaAbs),
        pct: catChange.bestDrop.deltaPct,
      });
    }

    if (dayStats.maxDay.date && dayStats.maxDay.amount > 0) {
      insights.push({
        key: "max-day",
        kind: "neutral",
        title: "Самый затратный день",
        value: dayStats.maxDay.date,
        amount: dayStats.maxDay.amount,
      });
    }

    if (totals.expense > 0) {
      insights.push({
        key: "avg-day-expense",
        kind: "neutral",
        title: "Средний расход в день",
        amount: dayStats.avgExpensePerDay,
      });
    }

    if (maxTx && maxTx.amount > 0) {
      insights.push({
        key: "max-transaction",
        kind: maxTx.kind === "income" ? "positive" : "warning",
        title: "Самая большая транзакция",
        value: maxTx.description || maxTx.categoryLabel,
        amount: maxTx.amount,
        txKind: maxTx.kind,
        categoryLabel: maxTx.categoryLabel,
        createdAtIso: maxTx.createdAtIso,
      });
    }

    return insights.slice(0, 3);
  }

  function buildAnalyticsReport(options) {
    const currentItems = Array.isArray(options && options.currentItems) ? options.currentItems : [];
    const previousItems = Array.isArray(options && options.previousItems) ? options.previousItems : [];
    const startIso = String((options && options.startIso) || "");
    const endIso = String((options && options.endIso) || "");
    const periodMode = String((options && options.periodMode) || "custom");
    const participantBuckets = Array.isArray(options && options.participantBuckets) ? options.participantBuckets : [];

    const currentTotals = buildTotals(currentItems);
    const previousTotals = buildTotals(previousItems);
    const comparison = buildPeriodComparison(currentItems, previousItems);
    const topCategories = buildTopCategories(currentItems, previousItems, 3);
    const participants = buildParticipants(participantBuckets);
    const insights = buildInsights(currentItems, previousItems, startIso, endIso);

    return {
      period: {
        mode: periodMode,
        start: startIso,
        end: endIso,
        daysCount: diffDaysInclusive(startIso, endIso),
      },
      totals: currentTotals,
      previousTotals,
      trendChange: {
        expensePct: percentChange(currentTotals.expense, previousTotals.expense),
        incomePct: percentChange(currentTotals.income, previousTotals.income),
      },
      comparison,
      topCategories,
      participants,
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
    buildDailySums,
    percentChange,
    diffDaysInclusive,
  };
})(window);
