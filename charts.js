(() => {
const { formatCurrency } = window.SimpleKitMortgageCalculator;

function buildPath(points, width, height, padding, maxValue, maxPeriod) {
  if (points.length === 0) {
    return "";
  }

  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const safeMax = maxValue > 0 ? maxValue : 1;
  const safeMaxPeriod = maxPeriod > 0 ? maxPeriod : 1;

  return points.map((point, index) => {
    const x = padding + ((point.period ?? index) / safeMaxPeriod) * innerWidth;
    const y = padding + innerHeight - ((point.value / safeMax) * innerHeight);
    return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
}

function buildAreaPath(points, width, height, padding, maxValue, maxPeriod) {
  if (points.length === 0) {
    return "";
  }

  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const safeMax = maxValue > 0 ? maxValue : 1;
  const safeMaxPeriod = maxPeriod > 0 ? maxPeriod : 1;
  const plotted = points.map((point, index) => {
    const x = padding + ((point.period ?? index) / safeMaxPeriod) * innerWidth;
    const y = padding + innerHeight - ((point.value / safeMax) * innerHeight);
    return { x, y };
  });
  const start = plotted[0];
  const end = plotted[plotted.length - 1];
  const line = plotted.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");

  return `${line} L ${end.x.toFixed(2)} ${(height - padding).toFixed(2)} L ${start.x.toFixed(2)} ${(height - padding).toFixed(2)} Z`;
}

function buildGridLines(width, height, padding) {
  const rows = 4;
  const lines = [];

  for (let index = 0; index <= rows; index += 1) {
    const y = padding + ((height - padding * 2) / rows) * index;
    lines.push(`<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" />`);
  }

  return lines.join("");
}

function extendSeriesToPeriod(points, targetPeriod) {
  if (points.length === 0) {
    return points;
  }

  const lastPoint = points[points.length - 1];
  if ((lastPoint.period ?? 0) >= targetPeriod) {
    return points;
  }

  return [
    ...points,
    {
      ...lastPoint,
      label: lastPoint.value === 0 ? lastPoint.label : "Paid off",
      period: targetPeriod,
      value: 0,
    },
  ];
}

function renderBalanceChart(container, baseline, withExtras) {
  if (!container || !baseline || !withExtras) {
    return;
  }

  const width = 720;
  const height = 320;
  const padding = 28;
  const maxPeriod = Math.max(
    baseline.balanceSeries[baseline.balanceSeries.length - 1]?.period || 0,
    withExtras.balanceSeries[withExtras.balanceSeries.length - 1]?.period || 0,
  );
  const baselineSeries = extendSeriesToPeriod(baseline.balanceSeries, maxPeriod);
  const extrasSeries = extendSeriesToPeriod(withExtras.balanceSeries, maxPeriod);
  const maxValue = Math.max(
    baselineSeries[0]?.value || 0,
    ...baselineSeries.map((point) => point.value),
    ...extrasSeries.map((point) => point.value),
  );
  const baselinePath = buildPath(baselineSeries, width, height, padding, maxValue, maxPeriod);
  const extrasPath = buildPath(extrasSeries, width, height, padding, maxValue, maxPeriod);
  const extrasArea = buildAreaPath(extrasSeries, width, height, padding, maxValue, maxPeriod);
  const finalBaseline = baselineSeries[baselineSeries.length - 1];
  const finalExtras = withExtras.balanceSeries[withExtras.balanceSeries.length - 1];

  container.innerHTML = `
    <div class="chart-card">
      <div class="chart-head">
        <div>
          <p class="section-kicker">Chart 1</p>
          <h3>Remaining balance over time</h3>
        </div>
        <div class="chart-legend" aria-label="Balance chart legend">
          <span><i class="legend-swatch legend-swatch-baseline"></i>Baseline</span>
          <span><i class="legend-swatch legend-swatch-extra"></i>With extras</span>
        </div>
      </div>
      <svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="Mortgage balance over time comparison">
        <g class="chart-grid">${buildGridLines(width, height, padding)}</g>
        <path class="chart-area" d="${extrasArea}" />
        <path class="chart-line chart-line-baseline" d="${baselinePath}" />
        <path class="chart-line chart-line-extra" d="${extrasPath}" />
      </svg>
      <div class="chart-foot">
        <div>
          <span class="chart-label">Baseline payoff</span>
          <strong>${baseline.payoffDateLabel}</strong>
        </div>
        <div>
          <span class="chart-label">With extras payoff</span>
          <strong>${withExtras.payoffDateLabel}</strong>
        </div>
        <div>
          <span class="chart-label">Ending balance</span>
          <strong>${formatCurrency(finalExtras?.value || finalBaseline?.value || 0)}</strong>
        </div>
      </div>
    </div>
  `;
}

function buildBreakdownBar(label, values, maxValue) {
  const safeMax = maxValue > 0 ? maxValue : 1;
  const principalWidth = Math.max(6, (values.principal / safeMax) * 100);
  const interestWidth = Math.max(0, (values.interest / safeMax) * 100);
  const extraWidth = Math.max(0, (values.extra / safeMax) * 100);

  return `
    <div class="breakdown-row">
      <div class="breakdown-row__meta">
        <span>${label}</span>
        <strong>${formatCurrency(values.total)}</strong>
      </div>
      <div class="breakdown-track" aria-hidden="true">
        <span class="breakdown-segment breakdown-principal" style="width: ${principalWidth}%"></span>
        <span class="breakdown-segment breakdown-interest" style="width: ${interestWidth}%"></span>
        ${values.extra > 0 ? `<span class="breakdown-segment breakdown-extra" style="width: ${extraWidth}%"></span>` : ""}
      </div>
      <div class="breakdown-notes">
        <span>Principal ${formatCurrency(values.principal)}</span>
        <span>Interest ${formatCurrency(values.interest)}</span>
        ${values.extra > 0 ? `<span>Extra ${formatCurrency(values.extra)}</span>` : ""}
      </div>
    </div>
  `;
}

function renderBreakdownChart(container, baseline, withExtras) {
  if (!container || !baseline || !withExtras) {
    return;
  }

  const rows = [
    {
      label: "Baseline cost mix",
      principal: baseline.totalPrincipal,
      interest: baseline.totalInterest,
      extra: 0,
      total: baseline.totalPaid,
    },
    {
      label: "With extras cost mix",
      principal: withExtras.totalPrincipal - withExtras.totalExtra,
      interest: withExtras.totalInterest,
      extra: withExtras.totalExtra,
      total: withExtras.totalPaid,
    },
  ];
  const maxValue = Math.max(...rows.map((row) => row.total));

  container.innerHTML = `
    <div class="chart-card">
      <div class="chart-head">
        <div>
          <p class="section-kicker">Chart 2</p>
          <h3>Principal, interest, and extra payment mix</h3>
        </div>
        <div class="breakdown-key">
          <span><i class="legend-swatch breakdown-principal"></i>Principal</span>
          <span><i class="legend-swatch breakdown-interest"></i>Interest</span>
          <span><i class="legend-swatch breakdown-extra"></i>Extra</span>
        </div>
      </div>
      <div class="breakdown-group">
        ${rows.map((row) => buildBreakdownBar(row.label, row, maxValue)).join("")}
      </div>
    </div>
  `;
}

window.SimpleKitMortgageCharts = {
  renderBalanceChart,
  renderBreakdownChart,
};
})();
