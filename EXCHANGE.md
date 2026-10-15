# 📈 449 Exchange

The official roommate stock market of 449. Five listings, one per roommate,
each opened at **$100.00** on **Wednesday, October 14, 2026** with 10,000 shares
outstanding. It lives at **`/exchange/`** on the same deploy as the Couch App
(there is a link in the Couch App's Settings, and "Open the Couch App" on the
exchange's About tab).

| Roommate | Ticker |
|---|---|
| Noah | NOAH |
| Bryon | BRYN |
| Jonas | JNAS |
| Andrew | ANDW |
| James | JAMS |

## How prices move

There is no survey and no form. Prices move on **material events**:

1. Something happens to a roommate (a date, a first kiss, a girlfriend, a
   hangover, a big W at work, a mess left for three days).
2. Someone reports it to the **pricing committee** — that is Claude, in the
   chat where this app is built.
3. The committee rules on the impact, writes the filing (what happened, the
   percentage, and its reasoning) into the ledger, and pushes. The next deploy
   moves the board. Rulings are final and occasionally petty.

Between filings each listing drifts up to **±0.75% a day** on deterministic
market noise, so the chart breathes on a quiet week. The drift accrues through
the day and lands exactly on the day's close, so the "today" numbers tick live.
Every phone computes the same board from the same ledger.

Guard rails: no single filing moves a listing more than 40%; nothing trades
below $1.00.

### Impact guide

The committee's published standards. It may depart from them when the facts
warrant it, and says so in the filing.

| Event | Impact |
|---|---|
| 💘 Got a girlfriend | +15% |
| 💋 First kiss | +8% |
| 🌹 Went on a date | +4% |
| 📱 Got a number | +2% |
| 👻 Got ghosted | −6% |
| 💔 Got dumped | −20% |
| 🏆 Big W (job, grade, promotion) | +10% |
| 💪 Gym PR or streak | +2% |
| 🤢 Hungover past noon | −3% |
| 🪦 Big L (fired, failed, totaled) | −10% |
| 🍝 Cooked for the house | +3% |
| 🧽 Did the dishes unprompted | +2% |
| 🛋️ Booked the couch for a date | +3% |
| 🗑️ Left a mess for days | −3% |
| 🚫 Durfed | −5% |

## Filing an event (for the committee)

The ledger is `src/exchange/ledger.js`. Append an entry, keep the list in
date order, commit, push:

```js
{
  day: '2026-10-16',          // the trading day it happened
  name: 'Jonas',              // Noah | Bryon | Jonas | Andrew | James
  type: 'first-kiss',         // optional: an id from EVENT_TYPES in market.js
  pct: 8,                     // the ruling, in percent; overrides the standard
  title: 'First kiss',        // optional, defaults to the type's label
  note: 'On the balcony. Two witnesses.',
  verdict: 'Textbook catalyst. Standard impact applied.',
  by: 'Noah'                  // who reported it
}
```

Filings dated in the future stay off the board until that day arrives.
Filings dated before the IPO count on opening day.

## What is in the app

- **Market**: ticker tape, the BOYO 5 index (the average of the five), the
  ranked listings with sparklines and today's change, every listing on one
  chart since the IPO, the latest filings, and the previous day's closing
  report.
- **Ticker page**: the price, today's change, the full price chart (hover or
  arrow keys for a day's value; a table view underneath), stats, and that
  roommate's filings.
- **Filings**: every ruling, newest first, grouped by day, with the
  committee's reasoning.
- **About**: the rules, the impact guide, a theme toggle shared with the Couch
  App, a share button, and the link back to the calendar.

Add `?demo` to the URL (`/exchange/?demo`) to preview the board with two weeks
of made-up filings. Demo data never touches the real ledger.

## Code

| File | What it does |
|---|---|
| `src/exchange/ledger.js` | The source of truth: the IPO date and every filing |
| `src/exchange/market.js` | Pure pricing engine: rebuilds the board from the ledger, drift, series, stats, the closing report |
| `src/exchange/market.test.mjs` | Unit tests for the engine (`npm test`) |
| `src/exchange/charts.jsx` | SVG sparkline, price chart and all-listings chart with crosshair tooltips and table views |
| `src/exchange/Exchange.jsx` | The app: routing, pages, theme, profile photos |
| `src/exchange/exchange.css` | Styles, light and dark |
| `exchange/index.html` | The second Vite entry, served at `/exchange/` |
| `src/roommates.js` | The roster and colours, shared with the Couch App |

The exchange reads profile photos from the same Firebase database the Couch
App uses (`profiles/{name}/photo`) and nothing else; it never writes to it.
