(() => {
const {
  DEFAULT_FORM_STATE,
  SAMPLE_FORM_STATE,
  FREQUENCY_OPTIONS,
  formatCurrency,
  formatInteger,
  runMortgageCalculation,
} = window.SimpleKitMortgageCalculator;
const { renderBalanceChart, renderBreakdownChart } = window.SimpleKitMortgageCharts;
const selectors = {
  form: "#mortgageForm",
  lumpContainer: "#lumpSumRows",
  derivedMortgage: "#derivedMortgageAmount",
  downPaymentMeta: "#downPaymentMeta",
  purchaseFields: "[data-mode='purchase']",
  manualFields: "[data-mode='loan']",
  resultsStatus: "#resultsStatus",
  baselineCards: "#baselineCards",
  extrasCards: "#extrasCards",
  comparisonCards: "#comparisonCards",
  frequencyCard: "#frequencyImpactCard",
  balanceChart: "#balanceChart",
  breakdownChart: "#breakdownChart",
  yearlyTable: "#yearlySummaryTable",
  paymentDetails: "#paymentDetailTable",
  assumptions: "#assumptionsList",
  methodologyCallout: "#methodologyCallout",
  mobileSummary: "#mobileSummaryGrid",
  mobileHeadline: "#mobileHeadline",
  headlineSummary: "#headlineSummary",
  frequencyComparison: "#frequencyComparison",
  crossover: "#crossoverSection",
  exportYearlyCsvBtn: "#exportYearlyCsvBtn",
  exportPaymentCsvBtn: "#exportPaymentCsvBtn",
  shareFeedback: "#shareFeedback",
};

const appState = {
  formState: cloneState(DEFAULT_FORM_STATE),
  lumpRowIds: ["lump-1"],
  scheduleView: "with-extras",
  lastResult: null,
  inputDebounceId: null,
};

function makeId() {
  return `lump-${Math.random().toString(36).slice(2, 9)}`;
}

function cloneState(source) {
  return {
    ...source,
    lumpSums: Array.isArray(source.lumpSums)
      ? source.lumpSums.map((item) => ({ ...item }))
      : [],
  };
}

function setFormState(nextState) {
  appState.formState = cloneState(nextState);
  appState.lumpRowIds = appState.formState.lumpSums.map(() => makeId());

  if (appState.lumpRowIds.length === 0) {
    appState.lumpRowIds = [makeId()];
    appState.formState.lumpSums = [{ amount: "", month: "" }];
  }
}

function serializeState(formState) {
  const params = new URLSearchParams();
  params.set("mode", formState.inputMode);
  params.set("loan", formState.loanAmount);
  params.set("price", formState.homePrice);
  params.set("down", formState.downPayment);
  params.set("rate", formState.annualRate);
  params.set("amort", formState.amortizationYears);
  params.set("term", formState.termYears);
  params.set("freq", formState.paymentFrequency);
  params.set("extra", formState.extraPerPayment);
  params.set("start", formState.startDate);
  params.set("comp", formState.compounding);
  params.set("cap", formState.prepaymentCapPercent);
  params.set("invest", formState.investingReturn);

  const lumps = (formState.lumpSums || [])
    .filter((item) => item.amount || item.month)
    .map((item) => `${item.amount || 0}:${item.month || 0}`);

  if (lumps.length > 0) {
    params.set("lumps", lumps.join(","));
  }

  return params;
}

function restoreStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if ([...params.keys()].length === 0) {
    setFormState(DEFAULT_FORM_STATE);
    return;
  }

  const lumps = (params.get("lumps") || "")
    .split(",")
    .filter(Boolean)
    .map((entry) => {
      const [amount = "", month = ""] = entry.split(":");
      return { amount, month };
    });

  setFormState({
    inputMode: params.get("mode") || DEFAULT_FORM_STATE.inputMode,
    loanAmount: params.get("loan") || DEFAULT_FORM_STATE.loanAmount,
    homePrice: params.get("price") || DEFAULT_FORM_STATE.homePrice,
    downPayment: params.get("down") || DEFAULT_FORM_STATE.downPayment,
    annualRate: params.get("rate") || DEFAULT_FORM_STATE.annualRate,
    amortizationYears: params.get("amort") || DEFAULT_FORM_STATE.amortizationYears,
    termYears: params.get("term") || DEFAULT_FORM_STATE.termYears,
    paymentFrequency: params.get("freq") || DEFAULT_FORM_STATE.paymentFrequency,
    extraPerPayment: params.get("extra") || DEFAULT_FORM_STATE.extraPerPayment,
    startDate: params.get("start") || DEFAULT_FORM_STATE.startDate,
    compounding: params.get("comp") || DEFAULT_FORM_STATE.compounding,
    prepaymentCapPercent: params.get("cap") || DEFAULT_FORM_STATE.prepaymentCapPercent,
    investingReturn: params.get("invest") || DEFAULT_FORM_STATE.investingReturn,
    lumpSums: lumps.length > 0 ? lumps : cloneState(DEFAULT_FORM_STATE).lumpSums,
  });
}

function syncUrl(formState) {
  const params = serializeState(formState);
  const nextUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, "", nextUrl);
}

function renderLumpRows() {
  const container = document.querySelector(selectors.lumpContainer);
  if (!container) {
    return;
  }

  container.innerHTML = appState.lumpRowIds.map((rowId, index) => {
    const row = appState.formState.lumpSums[index] || { amount: "", month: "" };
    return `
      <div class="lump-row" data-row-id="${rowId}">
        <label class="form-field">
          <span>Lump sum amount</span>
          <div class="input-prefix">
            <span>$</span>
            <input type="number" min="0" step="500" inputmode="decimal" data-lump-field="amount" data-row-id="${rowId}" value="${row.amount || ""}">
          </div>
        </label>
        <label class="form-field">
          <span>Month from start</span>
          <input type="number" min="1" step="1" inputmode="numeric" data-lump-field="month" data-row-id="${rowId}" value="${row.month || ""}">
        </label>
        <button class="btn btn-tertiary" type="button" data-remove-lump="${rowId}" ${appState.lumpRowIds.length === 1 ? "disabled" : ""}>Remove</button>
      </div>
    `;
  }).join("");
}

function applyFormStateToDom() {
  const form = document.querySelector(selectors.form);
  if (!form) {
    return;
  }

  Object.entries(appState.formState).forEach(([key, value]) => {
    if (key === "lumpSums") {
      return;
    }

    const field = form.elements.namedItem(key);
    if (!field) {
      return;
    }

    if (typeof RadioNodeList !== "undefined" && field instanceof RadioNodeList) {
      field.value = value;
      return;
    }

    field.value = value;
  });

  renderLumpRows();
  updateModeVisibility();
}

function readFormStateFromDom() {
  const form = document.querySelector(selectors.form);
  if (!form) {
    return cloneState(DEFAULT_FORM_STATE);
  }

  const radioValue = form.elements.inputMode.value || "loan";
  const lumpSums = appState.lumpRowIds.map((rowId) => ({
    amount: form.querySelector(`[data-lump-field='amount'][data-row-id='${rowId}']`)?.value || "",
    month: form.querySelector(`[data-lump-field='month'][data-row-id='${rowId}']`)?.value || "",
  }));

  return {
    inputMode: radioValue,
    loanAmount: form.elements.loanAmount.value,
    homePrice: form.elements.homePrice.value,
    downPayment: form.elements.downPayment.value,
    annualRate: form.elements.annualRate.value,
    amortizationYears: form.elements.amortizationYears.value,
    termYears: form.elements.termYears.value,
    paymentFrequency: form.elements.paymentFrequency.value,
    extraPerPayment: form.elements.extraPerPayment.value,
    startDate: form.elements.startDate.value,
    compounding: form.elements.compounding.value,
    prepaymentCapPercent: form.elements.prepaymentCapPercent.value,
    investingReturn: form.elements.investingReturn.value,
    lumpSums,
  };
}

function updateStateFromField(target) {
  if (!target) {
    return;
  }

  if (target.dataset.lumpField) {
    const rowId = target.dataset.rowId;
    const fieldKey = target.dataset.lumpField;
    const index = appState.lumpRowIds.indexOf(rowId);
    if (index !== -1 && appState.formState.lumpSums[index]) {
      appState.formState.lumpSums[index][fieldKey] = target.value;
    }
    return;
  }

  if (target.name && Object.hasOwn(appState.formState, target.name)) {
    appState.formState[target.name] = target.value;
  }
}

function updateModeVisibility() {
  const mode = appState.formState.inputMode;
  document.querySelectorAll(selectors.purchaseFields).forEach((node) => {
    node.hidden = mode !== "purchase";
  });
  document.querySelectorAll(selectors.manualFields).forEach((node) => {
    node.hidden = mode !== "loan";
  });
}

function updatePurchaseHelper() {
  const derivedMortgage = document.querySelector(selectors.derivedMortgage);
  const downPaymentMeta = document.querySelector(selectors.downPaymentMeta);
  const homePrice = Number.parseFloat(appState.formState.homePrice) || 0;
  const downPayment = Number.parseFloat(appState.formState.downPayment) || 0;
  const loanAmount = Math.max(0, homePrice - downPayment);
  const percent = homePrice > 0 ? (downPayment / homePrice) * 100 : 0;

  if (derivedMortgage) {
    derivedMortgage.textContent = formatCurrency(loanAmount);
  }

  if (downPaymentMeta) {
    downPaymentMeta.textContent = homePrice > 0
      ? `${percent.toFixed(1)}% down payment`
      : "Enter a home price to derive the mortgage amount.";
  }
}

function renderStatus(result) {
  const container = document.querySelector(selectors.resultsStatus);
  if (!container) {
    return;
  }

  if (result.errors.length > 0 || !result.baseline || !result.withExtras) {
    container.innerHTML = `
      <div class="status-card status-card-warning">
        <strong>Check the inputs</strong>
        <p>${result.errors.join(" ")}</p>
      </div>
    `;
    return;
  }

  const extrasActive = result.inputs.hasExtras;
  const cap = result.withExtras.prepaymentCap;
  container.innerHTML = `
    <div class="status-card">
      <strong>${extrasActive ? "Extra-payment scenario active" : "Baseline scenario active"}</strong>
      <p>
        ${extrasActive
          ? `You are comparing the base mortgage against ${formatCurrency(result.inputs.extraPerPayment)} extra per payment and ${result.inputs.lumpSums.filter((item) => item.amount > 0).length} lump-sum entries.`
          : "Add recurring extras or lump sums to see how much interest and time you could save."}
      </p>
      ${cap?.enabled ? `<p class="small-copy">Annual prepayment cap: ${cap.formattedAnnualCapAmount}. ${cap.cappedExtraTotal > 0 ? `${cap.formattedCappedExtraTotal} of requested extra payments could not be applied because of the cap.` : "Current extra-payment plan stays within the cap."}</p>` : ""}
    </div>
  `;
}

function renderMetricCards(containerSelector, title, metrics) {
  const container = document.querySelector(containerSelector);
  if (!container) {
    return;
  }

  container.innerHTML = `
    <div class="results-block-head">
      <div>
        <p class="section-kicker">${title.kicker}</p>
        <h3>${title.heading}</h3>
      </div>
      <p>${title.body}</p>
    </div>
    <div class="metric-grid">
      ${metrics.map((metric) => `
        <article class="metric-card">
          <span class="metric-label">${metric.label}</span>
          <strong>${metric.value}</strong>
          <p>${metric.note}</p>
        </article>
      `).join("")}
    </div>
  `;
}

function renderHeadlineSummary(result) {
  const container = document.querySelector(selectors.headlineSummary);
  if (!container || !result.baseline || !result.withExtras) {
    return;
  }

  const narrative = result.inputs.hasExtras
    ? `At ${result.helpers.annualRateLabel} over ${result.inputs.amortizationYears} years, your ${result.helpers.frequencyLabel.toLowerCase()} payment is ${result.baseline.formattedScheduledPayment}. Adding extras could save ${result.comparison.interestSavedLabel} in interest and cut ${result.comparison.timeSavedLabel} off the payoff.`
    : `At ${result.helpers.annualRateLabel} over ${result.inputs.amortizationYears} years, your ${result.helpers.frequencyLabel.toLowerCase()} payment is ${result.baseline.formattedScheduledPayment}, and the mortgage is projected to be paid off in ${result.baseline.payoffLabel}.`;

  container.innerHTML = `
    <div class="headline-summary">
      <div class="results-block-head">
        <div>
          <p class="section-kicker">Quick answer</p>
          <h3>Your mortgage at a glance</h3>
        </div>
        <p>${narrative}</p>
      </div>
      <div class="headline-grid">
        <article class="headline-card">
          <span class="metric-label">Your payment</span>
          <strong>${result.baseline.formattedScheduledPayment}</strong>
          <p>${result.helpers.frequencyLabel} schedule.</p>
        </article>
        <article class="headline-card">
          <span class="metric-label">Mortgage-free by</span>
          <strong>${result.withExtras.payoffDateLabel}</strong>
          <p>${result.withExtras.payoffLabel} from the start date.</p>
        </article>
        <article class="headline-card">
          <span class="metric-label">Total interest</span>
          <strong>${result.withExtras.formattedTotalInterest}</strong>
          <p>${result.inputs.hasExtras ? "Using your current extra-payment plan." : "With the current baseline scenario."}</p>
        </article>
        <article class="headline-card">
          <span class="metric-label">Extra payments save</span>
          <strong>${result.inputs.hasExtras ? result.comparison.interestSavedLabel : "$0"}</strong>
          <p>${result.inputs.hasExtras ? result.comparison.timeSavedLabel : "Add extra payments to compare savings."}</p>
        </article>
      </div>
    </div>
  `;
}

function renderComparison(result) {
  if (!result.baseline || !result.withExtras || !result.comparison) {
    return;
  }

  const extraShortfall = result.withExtras.totalRequestedExtra - result.withExtras.totalExtra;
  const extraRequestedNote = result.withExtras.totalBlockedExtra > 0
    ? `${result.withExtras.formattedTotalBlockedExtra} was blocked by the annual prepayment cap.`
    : extraShortfall > 0
      ? `${formatCurrency(extraShortfall)} could not be used because the mortgage balance ran out first.`
      : "All requested extra cash was applied to the mortgage.";

  renderMetricCards(selectors.baselineCards, {
    kicker: "Baseline plan",
    heading: "Regular payment snapshot",
    body: `Using ${FREQUENCY_OPTIONS[result.inputs.paymentFrequency].label.toLowerCase()} payments over ${result.inputs.amortizationYears} years.`,
  }, [
    {
      label: "Scheduled payment",
      value: result.baseline.formattedScheduledPayment,
      note: `${result.baseline.frequency.label} payment amount.`,
    },
    {
      label: "Total interest",
      value: result.baseline.formattedTotalInterest,
      note: "Interest paid over the full payoff path.",
    },
    {
      label: "Total paid",
      value: result.baseline.formattedTotalPaid,
      note: "Principal plus interest.",
    },
    {
      label: "Mortgage-free in",
      value: result.baseline.payoffLabel,
      note: `Estimated payoff date ${result.baseline.payoffDateLabel}.`,
    },
    {
      label: "Balance at term end",
      value: result.baseline.formattedTermBalance,
      note: `${result.inputs.termYears}-year term ending balance.`,
    },
    {
      label: "Interest in term",
      value: result.baseline.formattedTermInterestPaid,
      note: `Interest paid during the first ${result.inputs.termYears} years.`,
    },
  ]);

  renderMetricCards(selectors.extrasCards, {
    kicker: "With extras",
    heading: "Payoff acceleration snapshot",
    body: result.inputs.hasExtras
      ? "This scenario layers recurring extras and lump sums on top of the base payment."
      : "Add extra payments to populate this comparison.",
  }, [
    {
      label: "Scheduled payment",
      value: result.withExtras.formattedScheduledPayment,
      note: "The required base payment stays the same.",
    },
    {
      label: "Extra paid",
      value: result.withExtras.formattedTotalExtra,
      note: "All recurring extra payments and lump sums combined.",
    },
    {
      label: "Extra requested",
      value: result.withExtras.formattedTotalRequestedExtra,
      note: extraRequestedNote,
    },
    {
      label: "New total interest",
      value: result.withExtras.formattedTotalInterest,
      note: "Lower interest is the main benefit of paying principal sooner.",
    },
    {
      label: "New payoff",
      value: result.withExtras.payoffLabel,
      note: `Estimated payoff date ${result.withExtras.payoffDateLabel}.`,
    },
    {
      label: "Balance at term end",
      value: result.withExtras.formattedTermBalance,
      note: "Useful if you plan to renew after the current term.",
    },
    {
      label: "Principal in term",
      value: result.withExtras.formattedTermPrincipalPaid,
      note: "Principal paid in the first term, including extras.",
    },
  ]);

  renderMetricCards(selectors.comparisonCards, {
    kicker: "Comparison",
    heading: "What the extras change",
    body: result.inputs.hasExtras
      ? "These savings compare your extra-payment plan against the baseline mortgage."
      : "These values stay flat until you add extra payments.",
  }, [
    {
      label: "Interest saved",
      value: result.comparison.interestSavedLabel,
      note: "Lower lifetime borrowing cost.",
    },
    {
      label: "Time saved",
      value: result.comparison.timeSavedLabel,
      note: result.comparison.paymentsSavedLabel,
    },
    {
      label: "Earlier payoff date",
      value: result.withExtras.payoffDateLabel,
      note: `Compared with ${result.baseline.payoffDateLabel}.`,
    },
    {
      label: "Term-end balance drop",
      value: result.comparison.termBalanceSavedLabel,
      note: "How much lower the balance is by term renewal.",
    },
  ]);
}

function renderFrequencyInsight(result) {
  const container = document.querySelector(selectors.frequencyCard);
  if (!container) {
    return;
  }

  if (!result.frequencyInsight) {
    container.innerHTML = `
      <article class="insight-card">
        <p class="section-kicker">Frequency insight</p>
        <h3>Monthly is your current reference point</h3>
        <p>Your scheduled payment is ${result.baseline.formattedScheduledPayment}, with an equivalent monthly cost of ${result.baseline.formattedMonthlyEquivalent}.</p>
      </article>
    `;
    return;
  }

  container.innerHTML = `
    <article class="insight-card">
      <p class="section-kicker">Frequency insight</p>
      <h3>${result.frequencyInsight.selectedLabel} versus monthly</h3>
      <p>Your scheduled ${result.frequencyInsight.selectedLabel.toLowerCase()} payment is ${result.frequencyInsight.selectedPaymentLabel}, which works out to about ${result.frequencyInsight.monthlyEquivalentLabel} per month.</p>
      <div class="insight-metrics">
        <span><strong>${result.frequencyInsight.payoffDifferenceLabel}</strong> faster payoff versus monthly</span>
        <span><strong>${result.frequencyInsight.interestDifferenceLabel}</strong> less interest versus monthly</span>
      </div>
    </article>
  `;
}

function renderMobileSummary(result) {
  const headline = document.querySelector(selectors.mobileHeadline);
  const container = document.querySelector(selectors.mobileSummary);
  if (!headline || !container || !result.baseline || !result.withExtras) {
    return;
  }

  headline.textContent = result.inputs.hasExtras
    ? `${result.comparison.interestSavedLabel} interest saved`
    : result.baseline.formattedScheduledPayment;

  container.innerHTML = `
    <div>
      <span class="mini-summary-label">Payoff</span>
      <strong>${result.withExtras.payoffLabel}</strong>
    </div>
    <div>
      <span class="mini-summary-label">Term balance</span>
      <strong>${result.withExtras.formattedTermBalance}</strong>
    </div>
    <div>
      <span class="mini-summary-label">Frequency</span>
      <strong>${result.helpers.frequencyLabel}</strong>
    </div>
  `;
}

function buildYearlyTableRows(yearlySchedule) {
  return yearlySchedule.map((row) => `
    <tr>
      <td>${row.year}</td>
      <td>${formatInteger(row.paymentCount)}</td>
      <td>${formatCurrency(row.payments)}</td>
      <td>${formatCurrency(row.principal)}</td>
      <td>${formatCurrency(row.interest)}</td>
      <td>${formatCurrency(row.extra)}</td>
      <td>${formatCurrency(row.endingBalance)}</td>
    </tr>
  `).join("");
}

function buildPaymentTableRows(paymentSchedule) {
  return paymentSchedule.map((row) => `
    <tr>
      <td>${row.period}</td>
      <td>${row.dateLabel}</td>
      <td>${formatCurrency(row.totalPayment)}</td>
      <td>${formatCurrency(row.scheduledPrincipal)}</td>
      <td>${formatCurrency(row.interestPaid)}</td>
      <td>${formatCurrency(row.extraPaid)}</td>
      <td>${formatCurrency(row.requestedExtraPaid)}</td>
      <td>${formatCurrency(row.balanceLimitedRequestedExtraPaid)}</td>
      <td>${formatCurrency(row.blockedExtraPaid)}</td>
      <td>${formatCurrency(row.endingBalance)}</td>
    </tr>
  `).join("");
}

function renderTables(result) {
  const scheduleScenario = appState.scheduleView === "baseline" ? result.baseline : result.withExtras;
  const yearlyTable = document.querySelector(selectors.yearlyTable);
  const paymentDetails = document.querySelector(selectors.paymentDetails);

  if (!yearlyTable || !paymentDetails || !scheduleScenario) {
    return;
  }

  yearlyTable.innerHTML = `
    <div class="table-toolbar">
      <div>
        <p class="section-kicker">Amortization breakdown</p>
        <h3>${scheduleScenario.scenarioName} yearly summary</h3>
      </div>
      <div class="toggle-row-group" role="tablist" aria-label="Schedule view">
        <button class="toggle-chip ${appState.scheduleView === "with-extras" ? "active" : ""}" type="button" data-schedule-view="with-extras">With extras</button>
        <button class="toggle-chip ${appState.scheduleView === "baseline" ? "active" : ""}" type="button" data-schedule-view="baseline">Baseline</button>
      </div>
    </div>
    <div class="table-shell">
      <table>
        <thead>
          <tr>
            <th>Year</th>
            <th>Payments</th>
            <th>Total paid</th>
            <th>Principal</th>
            <th>Interest</th>
            <th>Extra</th>
            <th>Ending balance</th>
          </tr>
        </thead>
        <tbody>
          ${buildYearlyTableRows(scheduleScenario.yearlySchedule)}
        </tbody>
      </table>
    </div>
  `;

  paymentDetails.innerHTML = `
    <details class="detail-disclosure">
      <summary>Open the payment-level amortization table</summary>
      <p class="muted small-copy">This detailed table shows every payment in the ${scheduleScenario.scenarioName.toLowerCase()} path.</p>
      <div class="table-shell">
        <table>
          <thead>
            <tr>
              <th>Period</th>
              <th>Date</th>
              <th>Total payment</th>
              <th>Principal</th>
              <th>Interest</th>
              <th>Extra applied</th>
              <th>Extra requested</th>
              <th>Amount that could still be used</th>
              <th>Blocked by cap</th>
              <th>Ending balance</th>
            </tr>
          </thead>
          <tbody>
            ${buildPaymentTableRows(scheduleScenario.paymentSchedule)}
          </tbody>
        </table>
      </div>
    </details>
  `;
}

function renderAssumptions(result) {
  const assumptions = document.querySelector(selectors.assumptions);
  const callout = document.querySelector(selectors.methodologyCallout);
  if (!assumptions || !callout) {
    return;
  }

  assumptions.innerHTML = result.assumptions.map((item) => `<li>${item}</li>`).join("");
  callout.innerHTML = `
    <div class="method-card">
      <strong>Principal being modeled</strong>
      <span>${result.helpers.principalLabel}</span>
    </div>
    <div class="method-card">
      <strong>Start date</strong>
      <span>${result.helpers.startDateLabel}</span>
    </div>
    <div class="method-card">
      <strong>Compounding</strong>
      <span>${appState.formState.compounding}</span>
    </div>
    <div class="method-card">
      <strong>Down payment</strong>
      <span>${result.inputs.inputMode === "purchase" ? result.helpers.downPaymentPercentLabel : "Not used in this mode"}</span>
    </div>
    <div class="method-card">
      <strong>Annual extra-payment cap</strong>
      <span>${result.helpers.prepaymentCapLabel}</span>
    </div>
  `;
}

function renderFrequencyComparison(result) {
  const container = document.querySelector(selectors.frequencyComparison);
  if (!container) {
    return;
  }

  const annualExtraBudget = result.inputs.extraPerPayment * FREQUENCY_OPTIONS[result.inputs.paymentFrequency].paymentsPerYear;

  container.innerHTML = `
    <div class="table-toolbar">
      <div>
        <p class="section-kicker">All-frequency comparison</p>
        <h3>See every payment cadence side by side</h3>
      </div>
      <p>These scenarios hold the same principal, rate, amortization, and annual extra-payment budget constant so you can isolate the timing difference.</p>
    </div>
    <p class="muted small-copy">For this comparison, annual extra cash is normalized to ${formatCurrency(annualExtraBudget)} per year, then spread across each payment cadence.</p>
    <div class="table-shell">
      <table>
        <thead>
          <tr>
            <th>Frequency</th>
            <th>Scheduled payment</th>
            <th>Normalized extra / payment</th>
            <th>Monthly equivalent</th>
            <th>Baseline interest</th>
            <th>Baseline payoff</th>
            <th>With extras payoff</th>
            <th>Interest saved with extras</th>
          </tr>
        </thead>
        <tbody>
          ${result.frequencyComparison.map((row) => `
            <tr ${row.key === result.inputs.paymentFrequency ? 'class="is-selected-row"' : ""}>
              <td>${row.label}</td>
              <td>${row.formattedScheduledPayment}</td>
              <td>${row.formattedNormalizedExtraPerPayment}</td>
              <td>${row.formattedMonthlyEquivalent}</td>
              <td>${row.formattedTotalInterest}</td>
              <td>${row.payoffLabel}</td>
              <td>${row.extrasPayoffLabel}</td>
              <td>${row.formattedInterestSavedWithExtras}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderCrossover(result) {
  const container = document.querySelector(selectors.crossover);
  if (!container) {
    return;
  }

  if (!result.inputs.hasExtras) {
    container.innerHTML = `
      <div class="results-block-head">
        <div>
          <p class="section-kicker">Mortgage vs investing</p>
          <h3>Compare payoff acceleration with investing later</h3>
        </div>
        <p>Add recurring extras or lump sums to estimate what that same cash flow might grow to if you invested it instead.</p>
      </div>
    `;
    return;
  }

  const crossover = result.investingCrossover;
  const crossoverShortfall = crossover.totalRequestedExtraContributions - crossover.totalExtraContributions;
  const crossoverRequestedNote = crossover.totalBlockedExtraContributions > 0
    ? `${crossover.totalBlockedExtraContributionsLabel} was blocked by the cap, so ${crossover.totalExtraContributionsLabel} actually reached the mortgage.`
    : crossoverShortfall > 0
      ? `${formatCurrency(crossoverShortfall)} was never needed because the mortgage was already nearly paid off.`
      : "All requested extra cash reached the mortgage in this scenario.";
  container.innerHTML = `
    <div class="results-block-head">
      <div>
        <p class="section-kicker">Mortgage vs investing</p>
        <h3>Should this extra cash attack the mortgage or go to investing?</h3>
      </div>
      <p>${crossover.headline}</p>
    </div>
    <div class="metric-grid metric-grid-wide">
      <article class="metric-card">
        <span class="metric-label">Extra cash requested</span>
        <strong>${crossover.totalRequestedExtraContributionsLabel}</strong>
        <p>${crossoverRequestedNote}</p>
      </article>
      <article class="metric-card">
        <span class="metric-label">Invested by baseline payoff</span>
        <strong>${crossover.futureValueAtBaselinePayoffLabel}</strong>
        <p>Assumes ${crossover.annualReturnLabel} annual growth and the same timing as the requested extra-cash plan.</p>
      </article>
      <article class="metric-card">
        <span class="metric-label">Invested by term end</span>
        <strong>${crossover.futureValueAtTermEndLabel}</strong>
        <p>Useful if you are really deciding about the next renewal period first.</p>
      </article>
      <article class="metric-card">
        <span class="metric-label">Mortgage interest saved</span>
        <strong>${result.comparison.interestSavedLabel}</strong>
        <p>${crossover.crossoverDifference >= 0 ? `${crossover.crossoverDifferenceLabel} more modeled value from investing by payoff.` : `${crossover.crossoverDifferenceLabel} more value from mortgage savings by payoff.`}</p>
      </article>
    </div>
    <div class="handoff-card">
      <div>
        <strong>Want to pressure-test the investing side next?</strong>
        <p class="muted small-copy">Use the related SimpleKit tools below to compare this cash flow against retirement planning, FIRE timing, or overall net worth.</p>
      </div>
      <div class="toolbar-actions">
        <a class="btn btn-tertiary" href="#relatedToolsSection">See related SimpleKit tools</a>
      </div>
    </div>
  `;
}

function downloadCsv(filename, rows) {
  const csv = rows
    .map((row) => row.map((cell) => {
      const safe = String(cell ?? "").replace(/"/g, "\"\"");
      return `"${safe}"`;
    }).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportYearlyCsv() {
  if (!appState.lastResult) {
    return;
  }

  const scenario = appState.scheduleView === "baseline" ? appState.lastResult.baseline : appState.lastResult.withExtras;
  const rows = [
    ["Year", "Payments", "Total paid", "Principal", "Interest", "Extra", "Ending balance"],
    ...scenario.yearlySchedule.map((row) => [
      row.year,
      row.paymentCount,
      row.payments.toFixed(2),
      row.principal.toFixed(2),
      row.interest.toFixed(2),
      row.extra.toFixed(2),
      row.endingBalance.toFixed(2),
    ]),
  ];
  downloadCsv(`simplekit-mortgage-${scenario.scenarioName.toLowerCase().replace(/\s+/g, "-")}-yearly.csv`, rows);
}

function exportPaymentCsv() {
  if (!appState.lastResult) {
    return;
  }

  const scenario = appState.scheduleView === "baseline" ? appState.lastResult.baseline : appState.lastResult.withExtras;
  const rows = [
    ["Period", "Date", "Total payment", "Scheduled principal", "Interest", "Extra applied", "Extra requested", "Request usable before payoff", "Blocked by cap", "Ending balance"],
    ...scenario.paymentSchedule.map((row) => [
      row.period,
      row.dateLabel,
      row.totalPayment.toFixed(2),
      row.scheduledPrincipal.toFixed(2),
      row.interestPaid.toFixed(2),
      row.extraPaid.toFixed(2),
      row.requestedExtraPaid.toFixed(2),
      row.balanceLimitedRequestedExtraPaid.toFixed(2),
      row.blockedExtraPaid.toFixed(2),
      row.endingBalance.toFixed(2),
    ]),
  ];
  downloadCsv(`simplekit-mortgage-${scenario.scenarioName.toLowerCase().replace(/\s+/g, "-")}-payments.csv`, rows);
}

function setShareFeedback(message, isError = false) {
  const feedback = document.querySelector(selectors.shareFeedback);
  if (!feedback) {
    return;
  }

  feedback.textContent = message;
  feedback.dataset.state = isError ? "error" : "success";
}

function clearRenderedResults() {
  [
    selectors.baselineCards,
    selectors.extrasCards,
    selectors.comparisonCards,
    selectors.frequencyCard,
    selectors.balanceChart,
    selectors.breakdownChart,
    selectors.headlineSummary,
    selectors.yearlyTable,
    selectors.paymentDetails,
    selectors.assumptions,
    selectors.methodologyCallout,
    selectors.mobileSummary,
    selectors.frequencyComparison,
    selectors.crossover,
  ].forEach((selector) => {
    const node = document.querySelector(selector);
    if (node) {
      node.innerHTML = "";
    }
  });

  const headline = document.querySelector(selectors.mobileHeadline);
  if (headline) {
    headline.textContent = "$0";
  }
}

function calculateAndRender() {
  if (appState.inputDebounceId) {
    window.clearTimeout(appState.inputDebounceId);
    appState.inputDebounceId = null;
  }

  appState.formState = readFormStateFromDom();
  updateModeVisibility();
  updatePurchaseHelper();
  syncUrl(appState.formState);

  const result = runMortgageCalculation(appState.formState);
  appState.lastResult = result;
  renderStatus(result);

  if (!result.baseline || !result.withExtras) {
    appState.lastResult = null;
    clearRenderedResults();
    return;
  }

  renderHeadlineSummary(result);
  renderComparison(result);
  renderFrequencyInsight(result);
  renderMobileSummary(result);
  renderBalanceChart(document.querySelector(selectors.balanceChart), result.baseline, result.withExtras);
  renderBreakdownChart(document.querySelector(selectors.breakdownChart), result.baseline, result.withExtras);
  renderTables(result);
  renderFrequencyComparison(result);
  renderCrossover(result);
  renderAssumptions(result);
}

function scheduleCalculateAndRender(delay = 450) {
  if (appState.inputDebounceId) {
    window.clearTimeout(appState.inputDebounceId);
  }

  appState.inputDebounceId = window.setTimeout(() => {
    appState.inputDebounceId = null;
    calculateAndRender();
  }, delay);
}

function addLumpRow() {
  appState.lumpRowIds.push(makeId());
  appState.formState.lumpSums.push({ amount: "", month: "" });
  renderLumpRows();
}

function removeLumpRow(rowId) {
  const index = appState.lumpRowIds.indexOf(rowId);
  if (index === -1 || appState.lumpRowIds.length === 1) {
    return;
  }

  appState.lumpRowIds.splice(index, 1);
  appState.formState.lumpSums.splice(index, 1);
  renderLumpRows();
  calculateAndRender();
}

function handleShareAction(shareButton) {
  const shareUrl = window.location.href;
  const clipboard = navigator.clipboard?.writeText
    ? navigator.clipboard.writeText(shareUrl)
    : Promise.reject(new Error("Clipboard unavailable"));

  clipboard
    .then(() => {
      shareButton.textContent = "Link copied";
      setShareFeedback("Share link copied to clipboard.");
    })
    .catch(() => {
      window.prompt("Copy this share link:", shareUrl);
      setShareFeedback("Clipboard access was unavailable, so the share link was opened for manual copy.", true);
    })
    .finally(() => {
      window.setTimeout(() => {
        shareButton.textContent = "Copy share link";
        setShareFeedback("");
      }, 1800);
    });
}

function handleFormClick(event) {
  const addButton = event.target.closest("[data-add-lump]");
  if (addButton) {
    addLumpRow();
    return;
  }

  const removeButton = event.target.closest("[data-remove-lump]");
  if (removeButton) {
    removeLumpRow(removeButton.getAttribute("data-remove-lump"));
    return;
  }

  const sampleButton = event.target.closest("#loadSampleBtn");
  if (sampleButton) {
    setFormState(SAMPLE_FORM_STATE);
    applyFormStateToDom();
    calculateAndRender();
    return;
  }

  const resetButton = event.target.closest("#resetBtn");
  if (resetButton) {
    setFormState(DEFAULT_FORM_STATE);
    appState.scheduleView = "with-extras";
    applyFormStateToDom();
    calculateAndRender();
    return;
  }

}

function handleGlobalClick(event) {
  const scheduleButton = event.target.closest("[data-schedule-view]");
  if (scheduleButton) {
    appState.scheduleView = scheduleButton.getAttribute("data-schedule-view");
    calculateAndRender();
    return;
  }

  const shareButton = event.target.closest("#shareBtn");
  if (shareButton) {
    handleShareAction(shareButton);
    return;
  }

  const printButton = event.target.closest("#printBtn");
  if (printButton) {
    window.print();
    return;
  }

  const exportYearlyButton = event.target.closest(selectors.exportYearlyCsvBtn);
  if (exportYearlyButton) {
    exportYearlyCsv();
    return;
  }

  const exportPaymentButton = event.target.closest(selectors.exportPaymentCsvBtn);
  if (exportPaymentButton) {
    exportPaymentCsv();
  }
}

function handleFormInput(event) {
  if (!event.target.closest("form")) {
    return;
  }

  const target = event.target;
  updateStateFromField(target);

  if (target.name === "inputMode") {
    updateModeVisibility();
  }

  if (target.name === "homePrice" || target.name === "downPayment") {
    updatePurchaseHelper();
  }

  if (target.matches("select, input[type='radio'], input[type='checkbox']")) {
    return;
  }

  scheduleCalculateAndRender();
}

function handleFormChange(event) {
  if (!event.target.closest("form")) {
    return;
  }

  calculateAndRender();
}

function animateDisclosure(details, openNext) {
  const body = details.querySelector(".collapsible-body");
  if (!body || details.dataset.animating === "true") {
    return;
  }

  details.dataset.animating = "true";
  body.style.overflow = "hidden";

  if (openNext) {
    details.open = true;
    body.style.height = "0px";
    body.style.opacity = "0";
    body.style.marginTop = "0px";

    window.requestAnimationFrame(() => {
      const expandedHeight = `${body.scrollHeight}px`;
      body.style.height = expandedHeight;
      body.style.opacity = "1";
      body.style.marginTop = "14px";
    });

    const onOpenEnd = (event) => {
      if (event.propertyName !== "height") {
        return;
      }

      body.style.height = "auto";
      body.style.overflow = "";
      delete details.dataset.animating;
      body.removeEventListener("transitionend", onOpenEnd);
    };

    body.addEventListener("transitionend", onOpenEnd);
    return;
  }

  body.style.height = `${body.scrollHeight}px`;
  body.style.opacity = "1";
  body.style.marginTop = "14px";

  window.requestAnimationFrame(() => {
    body.style.height = "0px";
    body.style.opacity = "0";
    body.style.marginTop = "0px";
  });

  const onCloseEnd = (event) => {
    if (event.propertyName !== "height") {
      return;
    }

    details.open = false;
    body.style.overflow = "";
    delete details.dataset.animating;
    body.removeEventListener("transitionend", onCloseEnd);
  };

  body.addEventListener("transitionend", onCloseEnd);
}

function initializeAnimatedDisclosures() {
  document.querySelectorAll("details[data-animated-collapse]").forEach((details) => {
    const summary = details.querySelector("summary");
    const body = details.querySelector(".collapsible-body");
    if (!summary || !body) {
      return;
    }

    if (details.open) {
      body.style.height = "auto";
      body.style.opacity = "1";
      body.style.marginTop = "14px";
    } else {
      body.style.height = "0px";
      body.style.opacity = "0";
      body.style.marginTop = "0px";
    }

    summary.addEventListener("click", (event) => {
      event.preventDefault();
      animateDisclosure(details, !details.open);
    });
  });
}

function initializeApp() {
  restoreStateFromUrl();
  applyFormStateToDom();

  const form = document.querySelector(selectors.form);
  if (!form) {
    return;
  }

  form.addEventListener("click", handleFormClick);
  form.addEventListener("input", handleFormInput);
  form.addEventListener("change", handleFormChange);
  form.addEventListener("submit", (event) => event.preventDefault());
  document.addEventListener("click", handleGlobalClick);

  initializeAnimatedDisclosures();
  calculateAndRender();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}
})();
