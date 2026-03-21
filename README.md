# SimpleKit Mortgage Calculator

This repo contains a production-ready static mortgage calculator for the SimpleKit ecosystem. It is designed to feel like a native SimpleKit tool while keeping the mortgage-specific logic local to this repo.

The tool helps users model:

- regular mortgage payments
- amortization and payoff timing
- total interest and total paid
- payment-frequency differences
- recurring extra payments
- lump-sum prepayments
- annual lender-style prepayment caps
- baseline versus extra-payment comparisons
- term-end balance, interest, and principal paid
- all-frequency side-by-side comparisons
- mortgage-versus-investing crossover scenarios

## SimpleKit Core Integration

This app consumes the shared SimpleKit platform shell from the deployed core domain instead of rebuilding global platform UI locally.

Shared assets loaded by `index.html`:

- `https://core.simplekit.app/core.css`
- `https://core.simplekit.app/core.js`

The page config pattern is defined before core loads:

```html
<script>
  window.SimpleKitPage = {
    pageType: "tool",
    activeNavHref: "./tools.html",
    toolId: "mortgage",
    relatedTools: [
      "networth",
      "fire",
      "retirement",
      "rrsp-tfsa"
    ],
    relatedToolIds: [
      "net-worth-calculator",
      "fire-calculator",
      "retirement-planner",
      "rrsp-tfsa-calculator"
    ],
    showSupportCta: true,
    showRelatedTools: true,
    showFooterToolLinks: true
  };
</script>
```

Shell mount points used on the page:

- `data-simplekit-header`
- `data-simplekit-related-tools`
- `data-simplekit-support`
- `data-simplekit-footer`

## File Structure

```text
/
  index.html
  app.js
  calculator.js
  charts.js
  styles.css
  README.md
```

## Calculation Model

The mortgage math lives in `calculator.js`.

Key behaviors:

- A user can enter either:
  - mortgage amount directly
  - home price and down payment, which derive the mortgage amount
- The calculator supports:
  - monthly
  - semi-monthly
  - bi-weekly
  - accelerated bi-weekly
  - weekly
  - accelerated weekly
- It runs two scenarios on every update:
  - baseline mortgage
  - mortgage with extras
- It produces:
  - required payment
  - total interest
  - total paid
  - payoff duration and estimated payoff date
  - term-end balance
  - term-end principal and interest paid
  - yearly amortization summary
  - payment-level amortization table

## Assumptions Used

### Interest compounding

The default assumption is nominal annual interest compounded semi-annually, which is a common Canadian mortgage convention.

Advanced options also allow:

- monthly compounding
- annual compounding

### Payment frequencies

Standard frequencies use their own number of payment periods per year:

- monthly: `12`
- semi-monthly: `24`
- bi-weekly: `26`
- weekly: `52`

Periodic interest is converted from the annual nominal rate to the selected payment interval.

### Accelerated payment handling

Accelerated options follow common consumer conventions:

- accelerated bi-weekly = half of the standard monthly payment
- accelerated weekly = one quarter of the standard monthly payment

Those accelerated amounts are then simulated on 26 or 52 payment periods per year, which usually shortens amortization relative to a standard monthly schedule.

### Lump-sum handling

Lump sums are entered as:

- amount
- month from mortgage start

Each lump sum is applied on the first payment that lands in or after that month. Multiple lump sums are supported.

### Date handling

The start date is user-selectable. Payment dates are approximated using:

- calendar-month averages for monthly and semi-monthly schedules
- fixed 14-day intervals for bi-weekly schedules
- fixed 7-day intervals for weekly schedules

This is suitable for planning and comparison. Exact lender statement dates may differ slightly.

## UI Behavior

`app.js` is the page controller. It handles:

- live recalculation on input
- sample scenario loading
- reset behavior
- shareable URL state
- print/export via browser print
- yearly and payment-level CSV export
- amortization table scenario toggle
- dynamic lump-sum row management

`charts.js` renders lightweight SVG charts so the app stays static-site friendly and GitHub Pages friendly.

## Deploying

This repo is static and can be deployed directly to GitHub Pages.

Basic deployment flow:

1. Push the repo to GitHub.
2. Enable GitHub Pages for the default branch.
3. Confirm the deployed page can reach:
   - `https://core.simplekit.app/core.css`
   - `https://core.simplekit.app/core.js`
4. Confirm the shared shell renders the header, footer, support CTA, and related tools from the core platform.

## Local Development

This tool does not require a build step.

You can open `index.html` directly, but using a small local server is safer for module-script behavior:

```bash
python3 -m http.server 8000
```

Then open `http://127.0.0.1:8000/`.

## Regression Checks

There is a lightweight calculator regression script at:

- `tests/run-tests.js`

Run it with:

```bash
node tests/run-tests.js
```

It covers:

- payment-frequency differentiation
- restrictive prepayment caps
- requested vs applied vs balance-limited extra tracking
- normalized annual extra budgets in the frequency comparison table

## Recommended Future Upgrades

- Add province-aware default language around common Canadian mortgage conventions.
- Add lender-profile presets for common cap rules and payment privileges.
- Add a dedicated mortgage-versus-investing comparison tool if the suite eventually needs a deeper crossover model with taxes and account types.
