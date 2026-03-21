const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadCalculator() {
  global.window = {};
  const source = fs.readFileSync(path.join(__dirname, "..", "calculator.js"), "utf8");
  vm.runInThisContext(source);
  return global.window.SimpleKitMortgageCalculator;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function run() {
  const calculator = loadCalculator();
  const {
    DEFAULT_FORM_STATE,
    SAMPLE_FORM_STATE,
    runMortgageCalculation,
  } = calculator;

  const monthly = runMortgageCalculation({
    ...DEFAULT_FORM_STATE,
    paymentFrequency: "monthly",
  });
  const weekly = runMortgageCalculation({
    ...DEFAULT_FORM_STATE,
    paymentFrequency: "weekly",
  });

  assert(monthly.baseline.scheduledPayment !== weekly.baseline.scheduledPayment, "Weekly and monthly payment amounts should differ.");
  assert(monthly.baseline.paymentMonthlyEquivalent > 0, "Monthly equivalent should be populated.");

  const capped = runMortgageCalculation({
    ...SAMPLE_FORM_STATE,
    prepaymentCapPercent: "1",
  });
  assert(capped.withExtras.totalBlockedExtra > 0, "Restrictive cap should block some extra payments.");
  assert(capped.investingCrossover.totalRequestedExtraContributions >= capped.investingCrossover.totalExtraContributions, "Requested extra should be at least applied extra.");

  const oversized = runMortgageCalculation({
    ...DEFAULT_FORM_STATE,
    loanAmount: "5000",
    amortizationYears: "10",
    extraPerPayment: "1000",
    lumpSums: [{ amount: "8000", month: "1" }],
  });
  const firstPayment = oversized.withExtras.paymentSchedule[0];
  assert(firstPayment.requestedExtraPaid > firstPayment.balanceLimitedRequestedExtraPaid, "Raw requested extra should preserve the original intent near payoff.");
  assert(firstPayment.balanceLimitedRequestedExtraPaid >= firstPayment.extraPaid, "Balance-limited requested amount should be at least the applied amount.");

  const cappedNearPayoff = runMortgageCalculation({
    ...DEFAULT_FORM_STATE,
    loanAmount: "5000",
    amortizationYears: "10",
    extraPerPayment: "1000",
    prepaymentCapPercent: "1",
    lumpSums: [{ amount: "8000", month: "1" }],
  });
  const cappedNearPayoffRow = cappedNearPayoff.withExtras.paymentSchedule[0];
  assert(cappedNearPayoffRow.blockedExtraPaid <= cappedNearPayoffRow.balanceLimitedRequestedExtraPaid, "Cap-blocked amount should not exceed the portion that was still usable before payoff.");

  const biweeklyNormalized = capped.frequencyComparison.find((row) => row.key === "biweekly");
  const monthlyNormalized = capped.frequencyComparison.find((row) => row.key === "monthly");
  assert(biweeklyNormalized && monthlyNormalized, "Frequency comparison rows should exist.");
  const annualBiweekly = biweeklyNormalized.normalizedExtraPerPayment * 26;
  const annualMonthly = monthlyNormalized.normalizedExtraPerPayment * 12;
  assert(Math.abs(annualBiweekly - annualMonthly) < 0.01, "Normalized frequency comparison should keep annual extra cash aligned.");

  console.log("All mortgage calculator tests passed.");
}

try {
  run();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
