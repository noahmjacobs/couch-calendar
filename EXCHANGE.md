# 📈 449 Exchange

The official roommate stock market of 449. Five listings, one per roommate,
each opened at **$100.00** on **Saturday, August 1, 2026** with 10,000 shares
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

## The daily routine

1. **Anyone reports an event** on the Events tab: pick the roommate, the kind
   of thing (date, romance, life, apartment, other), what happened, when, and
   who is reporting. It posts to the Events page immediately as *pending*.
2. **Noah confirms.** On Noah's phone (the one the Couch App is signed in as
   Noah) each pending event shows Approve and Reject. Approved events wait
   for the ruling.
3. **The committee rules** at the close. The committee is Claude, in the chat
   where this app is built. Noah taps *Copy approved events* on the Events
   tab and pastes the text into the chat (or, once the cloud environment can
   reach `couch-reservation-default-rtdb.firebaseio.com`, Claude reads the
   approved events straight from the database). Claude rules on each one,
   appends a filing to the ledger with its reasoning, and pushes. The deploy
   moves the board. A filing that carries the submission's id (`ref`) marks
   that submission as *filed* on the Events page.

## How prices move

**Nothing happens, nothing moves.** There is no daily noise.

**Depreciation.** A listing that goes **7 days** without a filing starts to
depreciate **0.4% a day**, for up to 25 days (about −10% in all), then levels
off until something happens. Any filing resets the clock.

**The dating ladder.** A date's impact is worked out from the record, using
the partner's name (or initials) on the filing:

| Situation | Impact |
|---|---|
| First date, nobody else in the past 7 days | +10% |
| First date with someone new within 7 days of a date with someone else ("juggling") | +5% |
| Second date with the same person within 14 days of the first | +15% |
| Third date, still inside the window | +18% |
| Fourth date and beyond | +20% |
| A repeat date after more than 14 days apart ("rekindled") | +10% |
| Made it official (filed separately, on top of the dates) | +25% |

**Everything else** follows the impact guide below. The committee may depart
from any of this when the facts warrant it, and says so in the filing. No
single filing moves a listing more than 40%; nothing trades below $1.00.

### Impact guide

| Event | Impact |
|---|---|
| 🌹 Went on a date | the ladder (+5 to +20%) |
| 💘 Made it official | +25% |
| 💋 First kiss | +8% |
| 📱 Got a number | +2% |
| 👻 Got ghosted | −6% |
| 💔 Got dumped | −20% |
| 🏆 Big W (job, grade, promotion) | +10% |
| 💪 Gym PR or streak | +2% |
| 🤢 Hungover past noon | −3% |
| 🪦 Big L (fired, failed, totaled) | −10% |
| 🍝 Cooked for the house | +3% |
| 🧽 Did the dishes unprompted | +2% |
| 🗑️ Left a mess for days | −3% |
| 🚫 Durfed | −5% |

## Filing an event (for the committee)

The ledger is `src/exchange/ledger.js`. Append an entry, keep the list in
date order, commit, push:

```js
{
  day: '2026-10-16',          // the trading day it happened
  name: 'Jonas',              // Noah | Bryon | Jonas | Andrew | James
  type: 'date',               // optional: an id from EVENT_TYPES in market.js
  partner: 'Maya',            // dates only: who with, so the ladder can count
  pct: 8,                     // optional: the ruling in percent, overriding the
                              // standard impact or the ladder
  title: 'Date with Maya',    // optional, defaults to the type's label
  note: 'Dinner downtown.',   // the facts, as reported
  verdict: 'Full credit.',    // the committee's reasoning, published with the filing
  by: 'Noah',                 // who reported it
  ref: '-OabcXYZ123'          // optional: the submission id this rules on
}
```

Filings dated in the future stay off the board until that day arrives.
Filings dated before the IPO count on opening day. Filings are applied in
ledger order, day by day, and the whole board is rebuilt from the ledger on
every load, so a backdated filing lands exactly where it belongs in the chart.

## Firebase

Submitted events are stored in the Couch App's Realtime Database under
`exchange/submissions`. The rules need an `exchange` entry with read and
write allowed, alongside `reservations` and `profiles`:

```json
{
  "rules": {
    "reservations": { ".read": true, ".write": true },
    "profiles": { ".read": true, ".write": true },
    "exchange": { ".read": true, ".write": true }
  }
}
```

Until that rule is in place the Events tab shows a banner saying the database
refused the read or the write. Prices never depend on the database: they come
from the ledger in the code. Profile photos are read from `profiles`, the same
as the Couch App.

## What is in the app

- **Market**: ticker tape, the BOYO 5 index (the average of the five), the
  ranked listings with sparklines and today's change, every listing on one
  chart since the IPO, the latest filings, and the previous day's closing
  report.
- **Ticker page**: the price, today's change, the full price chart (hover or
  arrow keys for a day's value; a table view underneath), stats including how
  long the listing has been quiet, a button to report something about that
  roommate, and that roommate's filings.
- **Events**: the report button, what is awaiting review and awaiting a
  ruling, every filing grouped by day with the ladder's reasoning and the
  committee's verdict, and resolved submissions. Noah also sees the committee
  desk with the export.
- **About**: the rules, the dating ladder, the impact guide, a theme toggle
  shared with the Couch App, a share button, and the link back to the
  calendar.

Add `?demo` to the URL (`/exchange/?demo`) to preview the board with a few
weeks of made-up filings and submissions, with the reviewer controls on.
Demo data never touches the real ledger or database.

## Code

| File | What it does |
|---|---|
| `src/exchange/ledger.js` | The source of truth: the IPO date and every filing |
| `src/exchange/market.js` | Pure pricing engine: rebuilds the board from the ledger, depreciation, the dating ladder, series, stats, the closing report |
| `src/exchange/market.test.mjs` | Unit tests for the engine (`npm test`) |
| `src/exchange/charts.jsx` | SVG sparkline, price chart and all-listings chart with crosshair tooltips and table views |
| `src/exchange/Exchange.jsx` | The app: routing, pages, the report form, review controls, theme, profile photos |
| `src/exchange/exchange.css` | Styles, light and dark |
| `exchange/index.html` | The second Vite entry, served at `/exchange/` |
| `src/roommates.js` | The roster and colours, shared with the Couch App |
