(() => {
const CURRENCY_FORMATTER = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

const PERCENT_FORMATTER = new Intl.NumberFormat("en-CA", {
  maximumFractionDigits: 2,
});

const INTEGER_FORMATTER = new Intl.NumberFormat("en-CA", {
  maximumFractionDigits: 0,
});

const FREQUENCY_OPTIONS = {
  monthly: {
    key: "monthly",
    label: "Monthly",
    paymentsPerYear: 12,
    daysPerPayment: 365.2425 / 12,
    family: "standard",
  },
  semimonthly: {
    key: "semimonthly",
    label: "Semi-monthly",
    paymentsPerYear: 24,
    daysPerPayment: 365.2425 / 24,
    family: "standard",
  },
  biweekly: {
    key: "biweekly",
    label: "Bi-weekly",
    paymentsPerYear: 26,
    daysPerPayment: 14,
    family: "standard",
  },
  "accelerated-biweekly": {
    key: "accelerated-biweekly",
    label: "Accelerated bi-weekly",
    paymentsPerYear: 26,
    daysPerPayment: 14,
    family: "accelerated-biweekly",
  },
  weekly: {
    key: "weekly",
    label: "Weekly",
    paymentsPerYear: 52,
    daysPerPayment: 7,
    family: "standard",
  },
  "accelerated-weekly": {
    key: "accelerated-weekly",
    label: "Accelerated weekly",
    paymentsPerYear: 52,
    daysPerPayment: 7,
    family: "accelerated-weekly",
  },
};

const DEFAULT_FORM_STATE = {
  inputMode: "loan",
  loanAmount: "480000",
  homePrice: "620000",
  downPayment: "140000",
  annualRate: "5.25",
  amortizationYears: "25",
  termYears: "5",
  paymentFrequency: "monthly",
  extraPerPayment: "0",
  startDate: "2026-04-01",
  compounding: "semi-annual",
  prepaymentCapPercent: "0",
  investingReturn: "6",
  lumpSums: [
    { amount: "", month: "" },
  ],
};

const SAMPLE_FORM_STATE = {
  inputMode: "purchase",
  loanAmount: "480000",
  homePrice: "685000",
  downPayment: "145000",
  annualRate: "4.89",
  amortizationYears: "25",
  termYears: "5",
  paymentFrequency: "accelerated-biweekly",
  extraPerPayment: "125",
  startDate: "2026-05-01",
  compounding: "semi-annual",
  prepaymentCapPercent: "15",
  investingReturn: "6",
  lumpSums: [
    { amount: "5000", month: "12" },
    { amount: "7500", month: "36" },
  ],
};

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const cleaned = String(value).replace(/[$,%\s,]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function coercePositiveInteger(value, fallback = 0) {
  const parsed = Math.round(toNumber(value));
  return parsed > 0 ? parsed : fallback;
}

function normalizeDate(value) {
  if (!value) {
    return new Date("2026-04-01T00:00:00");
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return new Date("2026-04-01T00:00:00");
  }

  return parsed;
}

function formatDate(date) {
  return date.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatMonth(date) {
  return date.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
  });
}

function formatCurrency(value) {
  return CURRENCY_FORMATTER.format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value) {
  return `${PERCENT_FORMATTER.format(Number.isFinite(value) ? value : 0)}%`;
}

function formatInteger(value) {
  return INTEGER_FORMATTER.format(Number.isFinite(value) ? value : 0);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getCompoundingPeriods(compounding) {
  if (compounding === "monthly") {
    return 12;
  }

  if (compounding === "annual") {
    return 1;
  }

  return 2;
}

function computePeriodicRate(annualRateDecimal, paymentsPerYear, compoundingPeriodsPerYear) {
  if (annualRateDecimal <= 0) {
    return 0;
  }

  return (1 + annualRateDecimal / compoundingPeriodsPerYear) ** (compoundingPeriodsPerYear / paymentsPerYear) - 1;
}

function calculatePaymentAmount({
  principal,
  annualRateDecimal,
  amortizationYears,
  frequencyKey,
  compoundingPeriodsPerYear,
}) {
  const frequency = FREQUENCY_OPTIONS[frequencyKey] || FREQUENCY_OPTIONS.monthly;
  const totalPayments = amortizationYears * frequency.paymentsPerYear;

  if (totalPayments <= 0) {
    return 0;
  }

  if (frequency.family === "accelerated-biweekly" || frequency.family === "accelerated-weekly") {
    const monthlyRate = computePeriodicRate(annualRateDecimal, 12, compoundingPeriodsPerYear);
    const monthlyPayments = amortizationYears * 12;
    const monthlyPayment = monthlyRate === 0
      ? principal / monthlyPayments
      : principal * monthlyRate / (1 - (1 + monthlyRate) ** (-monthlyPayments));
    return frequency.family === "accelerated-biweekly" ? monthlyPayment / 2 : monthlyPayment / 4;
  }

  const periodicRate = computePeriodicRate(
    annualRateDecimal,
    frequency.paymentsPerYear,
    compoundingPeriodsPerYear,
  );

  if (periodicRate === 0) {
    return principal / totalPayments;
  }

  return principal * periodicRate / (1 - (1 + periodicRate) ** (-totalPayments));
}

function buildLumpPeriods(lumpSums, paymentsPerYear) {
  return lumpSums
    .filter((item) => item.amount > 0 && item.month > 0)
    .map((item, index) => ({
      index,
      amount: item.amount,
      month: item.month,
      period: Math.max(1, Math.ceil((item.month / 12) * paymentsPerYear)),
    }))
    .sort((left, right) => left.period - right.period);
}

function buildYearlySchedule(paymentSchedule, principal) {
  const yearly = [];
  let currentYear = null;
  let bucket = null;

  paymentSchedule.forEach((row) => {
    const year = row.date.getFullYear();
    if (year !== currentYear) {
      currentYear = year;
      bucket = {
        year,
        paymentCount: 0,
        payments: 0,
        principal: 0,
        interest: 0,
        extra: 0,
        endingBalance: principal,
      };
      yearly.push(bucket);
    }

    bucket.paymentCount += 1;
    bucket.payments += row.totalPayment;
    bucket.principal += row.principalPaid;
    bucket.interest += row.interestPaid;
    bucket.extra += row.extraPaid;
    bucket.endingBalance = row.endingBalance;
  });

  return yearly;
}

function buildBalanceSeries(paymentSchedule, principal) {
  const series = [{ label: "Start", value: principal, period: 0 }];

  paymentSchedule.forEach((row, index) => {
    if (index === paymentSchedule.length - 1 || row.period % row.paymentsPerYear === 0) {
      series.push({
        label: index === paymentSchedule.length - 1 ? "Paid off" : String(row.date.getFullYear()),
        value: row.endingBalance,
        period: row.period,
      });
    }
  });

  return series;
}

function buildMonthlyEquivalent(paymentAmount, paymentsPerYear) {
  return paymentAmount * paymentsPerYear / 12;
}

function formatDurationFromPeriods(periods, paymentsPerYear) {
  const totalMonths = Math.round((periods * 12) / paymentsPerYear);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  if (years > 0 && months > 0) {
    return `${years} yr ${months} mo`;
  }

  if (years > 0) {
    return years === 1 ? "1 year" : `${years} years`;
  }

  if (months > 0) {
    return months === 1 ? "1 month" : `${months} months`;
  }

  return `${periods} payments`;
}

function findTermSnapshot(paymentSchedule, termPeriods, principal) {
  if (termPeriods <= 0) {
    return {
      balance: principal,
      principalPaid: 0,
      interestPaid: 0,
      extraPaid: 0,
    };
  }

  const termRows = paymentSchedule.filter((row) => row.period <= termPeriods);
  if (termRows.length === 0) {
    return {
      balance: principal,
      principalPaid: 0,
      interestPaid: 0,
      extraPaid: 0,
    };
  }

  return {
    balance: termRows[termRows.length - 1].endingBalance,
    principalPaid: termRows.reduce((sum, row) => sum + row.principalPaid, 0),
    interestPaid: termRows.reduce((sum, row) => sum + row.interestPaid, 0),
    extraPaid: termRows.reduce((sum, row) => sum + row.extraPaid, 0),
  };
}

function summarizeScenario({
  scenarioName,
  principal,
  scheduledPayment,
  paymentSchedule,
  paymentsPerYear,
  startDate,
  termYears,
}) {
  const payoffPeriods = paymentSchedule.length;
  const totalInterest = paymentSchedule.reduce((sum, row) => sum + row.interestPaid, 0);
  const totalPaid = paymentSchedule.reduce((sum, row) => sum + row.totalPayment, 0);
  const totalExtra = paymentSchedule.reduce((sum, row) => sum + row.extraPaid, 0);
  const totalRequestedExtra = paymentSchedule.reduce((sum, row) => sum + row.requestedExtraPaid, 0);
  const totalBlockedExtra = paymentSchedule.reduce((sum, row) => sum + row.blockedExtraPaid, 0);
  const totalPrincipal = paymentSchedule.reduce((sum, row) => sum + row.principalPaid, 0);
  const yearlySchedule = buildYearlySchedule(paymentSchedule, principal);
  const balanceSeries = buildBalanceSeries(paymentSchedule, principal);
  const frequency = paymentSchedule[0]?.frequency || FREQUENCY_OPTIONS.monthly;
  const finalDate = paymentSchedule[paymentSchedule.length - 1]?.date || startDate;
  const termPeriods = Math.round(termYears * paymentsPerYear);
  const termSnapshot = findTermSnapshot(paymentSchedule, termPeriods, principal);

  return {
    scenarioName,
    scheduledPayment,
    formattedScheduledPayment: formatCurrency(scheduledPayment),
    paymentMonthlyEquivalent: buildMonthlyEquivalent(scheduledPayment, paymentsPerYear),
    formattedMonthlyEquivalent: formatCurrency(buildMonthlyEquivalent(scheduledPayment, paymentsPerYear)),
    payoffPeriods,
    payoffLabel: formatDurationFromPeriods(payoffPeriods, paymentsPerYear),
    payoffDate: finalDate,
    payoffDateLabel: formatDate(finalDate),
    totalInterest,
    totalPaid,
    totalExtra,
    totalRequestedExtra,
    totalBlockedExtra,
    totalPrincipal,
    formattedTotalInterest: formatCurrency(totalInterest),
    formattedTotalPaid: formatCurrency(totalPaid),
    formattedTotalExtra: formatCurrency(totalExtra),
    formattedTotalRequestedExtra: formatCurrency(totalRequestedExtra),
    formattedTotalBlockedExtra: formatCurrency(totalBlockedExtra),
    formattedTotalPrincipal: formatCurrency(totalPrincipal),
    yearlySchedule,
    paymentSchedule,
    balanceSeries,
    termSnapshot,
    formattedTermBalance: formatCurrency(termSnapshot.balance),
    formattedTermPrincipalPaid: formatCurrency(termSnapshot.principalPaid),
    formattedTermInterestPaid: formatCurrency(termSnapshot.interestPaid),
    formattedTermExtraPaid: formatCurrency(termSnapshot.extraPaid),
    paymentsPerYear,
    frequency,
    prepaymentCap: paymentSchedule.prepaymentCap || null,
  };
}

function getAnnualExtraBudget(inputs) {
  const frequency = FREQUENCY_OPTIONS[inputs.paymentFrequency] || FREQUENCY_OPTIONS.monthly;
  return Math.max(0, inputs.extraPerPayment * frequency.paymentsPerYear);
}

function createPrepaymentCapTracker(principal, prepaymentCapPercent) {
  const enabled = prepaymentCapPercent > 0;
  const annualCapAmount = enabled ? principal * (prepaymentCapPercent / 100) : Number.POSITIVE_INFINITY;
  const usageByYear = new Map();

  return {
    enabled,
    annualCapAmount,
    usageByYear,
    totalRequestedExtra: 0,
    totalAppliedExtra: 0,
    cappedExtraTotal: 0,
    capYearsReached: new Set(),
  };
}

function getRemainingCap(capTracker, yearIndex) {
  if (!capTracker.enabled) {
    return Number.POSITIVE_INFINITY;
  }

  const used = capTracker.usageByYear.get(yearIndex) || 0;
  return Math.max(0, capTracker.annualCapAmount - used);
}

function applyCapAmount(capTracker, yearIndex, requestedAmount, reason) {
  const safeRequested = Math.max(0, requestedAmount);
  capTracker.totalRequestedExtra += safeRequested;
  const remainingCap = getRemainingCap(capTracker, yearIndex);
  const applied = Math.min(safeRequested, remainingCap);

  if (applied > 0 && capTracker.enabled) {
    capTracker.usageByYear.set(yearIndex, (capTracker.usageByYear.get(yearIndex) || 0) + applied);
  }

  capTracker.totalAppliedExtra += applied;

  if (capTracker.enabled && safeRequested > applied) {
    capTracker.cappedExtraTotal += safeRequested - applied;
    capTracker.capYearsReached.add(yearIndex);
  }

  return {
    applied,
    capped: Math.max(0, safeRequested - applied),
    reason,
  };
}

function finalizePrepaymentCap(capTracker) {
  if (!capTracker.enabled) {
    return {
      enabled: false,
      annualCapAmount: 0,
      formattedAnnualCapAmount: formatCurrency(0),
      totalRequestedExtra: 0,
      totalAppliedExtra: 0,
      cappedExtraTotal: 0,
      formattedCappedExtraTotal: formatCurrency(0),
      capYearsReached: 0,
      yearlyUsage: [],
    };
  }

  const yearlyUsage = [...capTracker.usageByYear.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([yearIndex, used]) => ({
      yearIndex,
      used,
      remaining: Math.max(0, capTracker.annualCapAmount - used),
      hitCap: used >= capTracker.annualCapAmount - 0.01,
    }));

  return {
    enabled: true,
    annualCapAmount: capTracker.annualCapAmount,
    formattedAnnualCapAmount: formatCurrency(capTracker.annualCapAmount),
    totalRequestedExtra: capTracker.totalRequestedExtra,
    totalAppliedExtra: capTracker.totalAppliedExtra,
    cappedExtraTotal: capTracker.cappedExtraTotal,
    formattedCappedExtraTotal: formatCurrency(capTracker.cappedExtraTotal),
    capYearsReached: capTracker.capYearsReached.size,
    yearlyUsage,
  };
}

function simulateMortgage({
  principal,
  annualRateDecimal,
  amortizationYears,
  termYears,
  frequencyKey,
  extraPerPayment,
  lumpSums,
  startDate,
  compoundingPeriodsPerYear,
  prepaymentCapPercent,
  annualExtraBudget,
  includeExtras,
}) {
  const frequency = FREQUENCY_OPTIONS[frequencyKey] || FREQUENCY_OPTIONS.monthly;
  const paymentsPerYear = frequency.paymentsPerYear;
  const periodicRate = computePeriodicRate(annualRateDecimal, paymentsPerYear, compoundingPeriodsPerYear);
  const scheduledPayment = calculatePaymentAmount({
    principal,
    annualRateDecimal,
    amortizationYears,
    frequencyKey,
    compoundingPeriodsPerYear,
  });

  if (scheduledPayment <= 0) {
    return {
      errors: ["Payment amount could not be calculated from the current inputs."],
      summary: null,
    };
  }

  const lumps = buildLumpPeriods(lumpSums, paymentsPerYear);
  const appliedLumpIndexes = new Set();
  const maxPeriods = paymentsPerYear * 100;
  const paymentSchedule = [];
  const capTracker = createPrepaymentCapTracker(principal, prepaymentCapPercent);
  const derivedExtraPerPayment = annualExtraBudget > 0
    ? annualExtraBudget / paymentsPerYear
    : extraPerPayment;
  let balance = principal;

  for (let period = 1; period <= maxPeriods && balance > 0.01; period += 1) {
    const currentDate = addDays(startDate, Math.round((period - 1) * frequency.daysPerPayment));
    const interestPaid = balance * periodicRate;
    const scheduledPrincipal = Math.max(0, Math.min(balance, scheduledPayment - interestPaid));
    const regularPayment = interestPaid + scheduledPrincipal;
    let remainingBalance = Math.max(0, balance - scheduledPrincipal);
    const mortgageYear = Math.floor((period - 1) / paymentsPerYear) + 1;

    const requestedRecurringExtraRaw = includeExtras ? derivedExtraPerPayment : 0;
    const requestedRecurringExtra = Math.min(remainingBalance, requestedRecurringExtraRaw);
    const recurringCap = applyCapAmount(capTracker, mortgageYear, requestedRecurringExtra, "recurring");
    const recurringExtra = Math.min(remainingBalance, recurringCap.applied);
    remainingBalance = Math.max(0, remainingBalance - recurringExtra);

    let lumpPaid = 0;
    let requestedLumpPaid = 0;
    let requestedLumpPaidRaw = 0;
    let cappedExtra = recurringCap.capped;
    if (includeExtras) {
      lumps.forEach((lump) => {
        if (!appliedLumpIndexes.has(lump.index) && period >= lump.period) {
          const requested = Math.min(remainingBalance, lump.amount);
          const requestedRaw = lump.amount;
          requestedLumpPaid += requested;
          requestedLumpPaidRaw += requestedRaw;
          const cappedLump = applyCapAmount(capTracker, mortgageYear, requested, "lump");
          const applied = Math.min(remainingBalance, cappedLump.applied);
          lumpPaid += applied;
          remainingBalance -= applied;
          cappedExtra += cappedLump.capped;
          appliedLumpIndexes.add(lump.index);
        }
      });
    }

    const totalPayment = regularPayment + recurringExtra + lumpPaid;

    paymentSchedule.push({
      period,
      date: currentDate,
      dateLabel: formatDate(currentDate),
      monthLabel: formatMonth(currentDate),
      startingBalance: balance,
      scheduledPayment,
      interestPaid,
      principalPaid: scheduledPrincipal + recurringExtra + lumpPaid,
      scheduledPrincipal,
      extraPaid: recurringExtra + lumpPaid,
      requestedExtraPaid: requestedRecurringExtraRaw + requestedLumpPaidRaw,
      balanceLimitedRequestedExtraPaid: requestedRecurringExtra + requestedLumpPaid,
      blockedExtraPaid: cappedExtra,
      recurringExtraPaid: recurringExtra,
      requestedRecurringExtraPaid: requestedRecurringExtra,
      requestedRecurringExtraPaidRaw: requestedRecurringExtraRaw,
      lumpPaid,
      requestedLumpPaid,
      requestedLumpPaidRaw,
      cappedExtra,
      totalPayment,
      endingBalance: remainingBalance,
      paymentsPerYear,
      frequency,
    });

    balance = remainingBalance;
  }

  paymentSchedule.prepaymentCap = finalizePrepaymentCap(capTracker);

  if (balance > 0.01) {
    return {
      errors: ["This input combination does not fully pay off within 100 years. Check the interest rate and payment assumptions."],
      summary: null,
    };
  }

  return {
    errors: [],
    summary: summarizeScenario({
      scenarioName: includeExtras ? "With extras" : "Baseline",
      principal,
      scheduledPayment,
      paymentSchedule,
      paymentsPerYear,
      startDate,
      termYears,
    }),
  };
}

function normalizeInputs(rawInputs) {
  const inputMode = rawInputs.inputMode === "purchase" ? "purchase" : "loan";
  const homePrice = toNumber(rawInputs.homePrice);
  const downPayment = toNumber(rawInputs.downPayment);
  const manualLoanAmount = toNumber(rawInputs.loanAmount);
  const principal = inputMode === "purchase"
    ? Math.max(0, homePrice - downPayment)
    : Math.max(0, manualLoanAmount);
  const annualRate = Math.max(0, toNumber(rawInputs.annualRate));
  const amortizationYears = coercePositiveInteger(rawInputs.amortizationYears, 25);
  const termYears = coercePositiveInteger(rawInputs.termYears, 5);
  const extraPerPayment = Math.max(0, toNumber(rawInputs.extraPerPayment));
  const paymentFrequency = FREQUENCY_OPTIONS[rawInputs.paymentFrequency]
    ? rawInputs.paymentFrequency
    : "monthly";
  const compounding = ["semi-annual", "monthly", "annual"].includes(rawInputs.compounding)
    ? rawInputs.compounding
    : "semi-annual";
  const prepaymentCapPercent = Math.max(0, toNumber(rawInputs.prepaymentCapPercent));
  const investingReturn = Math.max(0, toNumber(rawInputs.investingReturn));
  const startDate = normalizeDate(rawInputs.startDate);
  const downPaymentPercent = homePrice > 0 ? (downPayment / homePrice) * 100 : 0;
  const hasExtras = extraPerPayment > 0
    || (Array.isArray(rawInputs.lumpSums) && rawInputs.lumpSums.some((item) => toNumber(item.amount) > 0));
  const lumpSums = Array.isArray(rawInputs.lumpSums)
    ? rawInputs.lumpSums.map((item) => ({
      amount: Math.max(0, toNumber(item.amount)),
      month: Math.max(0, Math.round(toNumber(item.month))),
    }))
    : [];

  return {
    inputMode,
    homePrice,
    downPayment,
    principal,
    annualRate,
    annualRateDecimal: annualRate / 100,
    amortizationYears,
    termYears,
    paymentFrequency,
    extraPerPayment,
    compounding,
    prepaymentCapPercent,
    investingReturn,
    compoundingPeriodsPerYear: getCompoundingPeriods(compounding),
    startDate,
    startDateLabel: formatDate(startDate),
    lumpSums,
    hasExtras,
    downPaymentPercent,
  };
}

function buildFrequencyComparison(inputs) {
  const annualExtraBudget = getAnnualExtraBudget(inputs);
  return Object.keys(FREQUENCY_OPTIONS).map((frequencyKey) => {
    const baselineRun = simulateMortgage({
      ...inputs,
      frequencyKey,
      annualExtraBudget,
      includeExtras: false,
    });
    const extrasRun = simulateMortgage({
      ...inputs,
      frequencyKey,
      annualExtraBudget,
      includeExtras: true,
    });

    const baseline = baselineRun.summary;
    const withExtras = extrasRun.summary;

    return {
      key: frequencyKey,
      label: FREQUENCY_OPTIONS[frequencyKey].label,
      scheduledPayment: baseline?.scheduledPayment || 0,
      formattedScheduledPayment: baseline?.formattedScheduledPayment || formatCurrency(0),
      monthlyEquivalent: baseline?.paymentMonthlyEquivalent || 0,
      formattedMonthlyEquivalent: baseline?.formattedMonthlyEquivalent || formatCurrency(0),
      totalInterest: baseline?.totalInterest || 0,
      formattedTotalInterest: baseline?.formattedTotalInterest || formatCurrency(0),
      payoffLabel: baseline?.payoffLabel || "n/a",
      extrasPayoffLabel: withExtras?.payoffLabel || "n/a",
      interestSavedWithExtras: baseline && withExtras
        ? Math.max(0, baseline.totalInterest - withExtras.totalInterest)
        : 0,
      formattedInterestSavedWithExtras: baseline && withExtras
        ? formatCurrency(Math.max(0, baseline.totalInterest - withExtras.totalInterest))
        : formatCurrency(0),
      normalizedExtraPerPayment: annualExtraBudget / FREQUENCY_OPTIONS[frequencyKey].paymentsPerYear,
      formattedNormalizedExtraPerPayment: formatCurrency(annualExtraBudget / FREQUENCY_OPTIONS[frequencyKey].paymentsPerYear),
    };
  });
}

function calculateFutureValueOfCashFlows(cashFlows, annualReturnDecimal, endDate) {
  if (annualReturnDecimal <= 0 || cashFlows.length === 0) {
    return cashFlows.reduce((sum, flow) => sum + flow.amount, 0);
  }

  return cashFlows.reduce((sum, flow) => {
    const remainingDays = Math.max(0, (endDate - flow.date) / (1000 * 60 * 60 * 24));
    const years = remainingDays / 365.2425;
    return sum + (flow.amount * (1 + annualReturnDecimal) ** years);
  }, 0);
}

function buildInvestingCrossover(inputs, baseline, withExtras, comparison) {
  const cashFlows = withExtras.paymentSchedule
    .filter((row) => row.requestedExtraPaid > 0)
    .map((row) => ({
      date: row.date,
      amount: row.requestedExtraPaid,
    }));

  const annualReturnDecimal = inputs.investingReturn / 100;
  const baselinePayoffFutureValue = calculateFutureValueOfCashFlows(
    cashFlows,
    annualReturnDecimal,
    baseline.payoffDate,
  );
  const termEndDate = addDays(inputs.startDate, Math.round(inputs.termYears * 365.2425));
  const termEndFutureValue = calculateFutureValueOfCashFlows(
    cashFlows,
    annualReturnDecimal,
    termEndDate,
  );
  const crossoverDifference = baselinePayoffFutureValue - comparison.interestSaved;

  return {
    annualReturn: inputs.investingReturn,
    annualReturnLabel: formatPercent(inputs.investingReturn),
    totalExtraContributions: withExtras.totalExtra,
    totalExtraContributionsLabel: withExtras.formattedTotalExtra,
    totalRequestedExtraContributions: withExtras.totalRequestedExtra,
    totalRequestedExtraContributionsLabel: withExtras.formattedTotalRequestedExtra,
    totalBlockedExtraContributions: withExtras.totalBlockedExtra,
    totalBlockedExtraContributionsLabel: withExtras.formattedTotalBlockedExtra,
    futureValueAtBaselinePayoff: baselinePayoffFutureValue,
    futureValueAtBaselinePayoffLabel: formatCurrency(baselinePayoffFutureValue),
    futureValueAtTermEnd: termEndFutureValue,
    futureValueAtTermEndLabel: formatCurrency(termEndFutureValue),
    crossoverDifference,
    crossoverDifferenceLabel: formatCurrency(Math.abs(crossoverDifference)),
    headline: crossoverDifference >= 0
      ? "Investing the same extra cash could outgrow the interest saved by payoff."
      : "Paying down the mortgage saves more than the modeled investing path by payoff.",
  };
}

function runMortgageCalculation(rawInputs) {
  const inputs = normalizeInputs(rawInputs);
  const errors = [];

  if (inputs.principal <= 0) {
    errors.push("Enter a mortgage amount above $0.");
  }

  if (inputs.inputMode === "purchase" && inputs.homePrice <= 0) {
    errors.push("Enter a home price to calculate the mortgage from purchase details.");
  }

  if (inputs.inputMode === "purchase" && inputs.downPayment > inputs.homePrice) {
    errors.push("Down payment cannot be larger than the home price.");
  }

  if (inputs.annualRate < 0) {
    errors.push("Interest rate cannot be negative.");
  }

  if (errors.length > 0) {
    return {
      errors,
      inputs,
      baseline: null,
      withExtras: null,
      comparison: null,
      frequencyInsight: null,
      assumptions: [],
    };
  }

  const baselineRun = simulateMortgage({
    ...inputs,
    frequencyKey: inputs.paymentFrequency,
    annualExtraBudget: getAnnualExtraBudget(inputs),
    includeExtras: false,
  });

  const extrasRun = simulateMortgage({
    ...inputs,
    frequencyKey: inputs.paymentFrequency,
    annualExtraBudget: getAnnualExtraBudget(inputs),
    includeExtras: true,
  });

  const monthlyReferenceRun = inputs.paymentFrequency === "monthly"
    ? baselineRun
    : simulateMortgage({
      ...inputs,
      frequencyKey: "monthly",
      annualExtraBudget: getAnnualExtraBudget(inputs),
      includeExtras: false,
    });

  if (baselineRun.errors.length > 0) {
    return {
      errors: baselineRun.errors,
      inputs,
      baseline: null,
      withExtras: null,
      comparison: null,
      frequencyInsight: null,
      assumptions: [],
    };
  }

  const baseline = baselineRun.summary;
  const withExtras = extrasRun.summary;
  const monthlyReference = monthlyReferenceRun.summary;
  const interestSaved = Math.max(0, baseline.totalInterest - withExtras.totalInterest);
  const paymentsSaved = Math.max(0, baseline.payoffPeriods - withExtras.payoffPeriods);
  const termBalanceSaved = Math.max(0, baseline.termSnapshot.balance - withExtras.termSnapshot.balance);
  const comparison = {
    interestSaved,
    paymentsSaved,
    timeSavedLabel: formatDurationFromPeriods(paymentsSaved, baseline.paymentsPerYear),
    payoffDateShiftDays: Math.max(0, Math.round((baseline.payoffDate - withExtras.payoffDate) / (1000 * 60 * 60 * 24))),
    interestSavedLabel: formatCurrency(interestSaved),
    termBalanceSavedLabel: formatCurrency(termBalanceSaved),
    payoffDateImprovement: withExtras.payoffDateLabel,
    paymentsSavedLabel: paymentsSaved > 0 ? `${formatInteger(paymentsSaved)} fewer payments` : "No change",
  };
  const frequencyComparison = buildFrequencyComparison(inputs);
  const investingCrossover = buildInvestingCrossover(inputs, baseline, withExtras, comparison);
  const frequencyInsight = monthlyReference && inputs.paymentFrequency !== "monthly"
    ? {
      referenceLabel: monthlyReference.frequency.label,
      selectedLabel: baseline.frequency.label,
      selectedPaymentLabel: baseline.formattedScheduledPayment,
      monthlyEquivalentLabel: baseline.formattedMonthlyEquivalent,
      payoffDifferencePeriods: Math.max(0, monthlyReference.payoffPeriods - baseline.payoffPeriods),
      payoffDifferenceLabel: formatDurationFromPeriods(
        Math.max(0, monthlyReference.payoffPeriods - baseline.payoffPeriods),
        baseline.paymentsPerYear,
      ),
      interestDifference: Math.max(0, monthlyReference.totalInterest - baseline.totalInterest),
      interestDifferenceLabel: formatCurrency(Math.max(0, monthlyReference.totalInterest - baseline.totalInterest)),
    }
    : null;

  const assumptions = [
    inputs.compounding === "semi-annual"
      ? "Interest converts from a nominal annual rate compounded semi-annually, which is common for Canadian mortgages."
      : `Interest converts from a nominal annual rate compounded ${inputs.compounding}.`,
    "Semi-monthly timing uses 24 equal payment periods per year. Weekly and bi-weekly timing use fixed 7-day and 14-day intervals.",
    "Accelerated bi-weekly uses half of the standard monthly payment. Accelerated weekly uses one quarter of the standard monthly payment.",
    "Lump-sum timing is modeled by month-from-start and applies on the first payment that lands in or after that month.",
  ];

  if (inputs.prepaymentCapPercent > 0) {
    assumptions.push(`Extra payments are capped at ${formatPercent(inputs.prepaymentCapPercent)} of the original principal per mortgage year.`);
  }

  return {
    errors: extrasRun.errors,
    inputs,
    baseline,
    withExtras,
    comparison,
    frequencyComparison,
    frequencyInsight,
    investingCrossover,
    assumptions,
    helpers: {
      principalLabel: formatCurrency(inputs.principal),
      downPaymentPercentLabel: formatPercent(inputs.downPaymentPercent),
      annualRateLabel: formatPercent(inputs.annualRate),
      frequencyLabel: FREQUENCY_OPTIONS[inputs.paymentFrequency].label,
      startDateLabel: inputs.startDateLabel,
      prepaymentCapLabel: inputs.prepaymentCapPercent > 0
        ? formatPercent(inputs.prepaymentCapPercent)
        : "No annual cap",
    },
  };
}

window.SimpleKitMortgageCalculator = {
  DEFAULT_FORM_STATE,
  SAMPLE_FORM_STATE,
  FREQUENCY_OPTIONS,
  formatCurrency,
  formatDate,
  formatInteger,
  formatPercent,
  runMortgageCalculation,
};
})();
