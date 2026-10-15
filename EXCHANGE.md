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

## Who can see what

- **The exchange is public, the events are not.** Anyone with the link can
  watch the board, pick which listings and which range the chart shows, open
  a ticker and report an event, with no sign-in. That is all they see:
  prices. The filings, the closing report and the Events feed appear only for
  a roommate signed in with Google (the sign-in row is at the bottom of the
  Events tab); Noah also gets Delete on reports not yet ruled on.
- **The couch calendar is roommates only.** It asks for a Google sign-in; the
  first time an account signs in it picks which roommate it is, and that
  claim is permanent (stored under `members/{uid}` and `claims/{name}`, so it
  follows the account onto any phone). Each name can be claimed exactly once,
  so once the five have signed in, any other Google account is told the
  calendar is not for it and pointed at the exchange. Without a sign-in the
  calendar shows only a sign-in screen and a link to the exchange. If a
  roommate ever needs to move to a different Google account, delete their
  entry under `claims` in the Firebase console and they can claim again.
- **Noah** is recognised the same way: signed in on the exchange's Events
  tab with the account that claimed Noah, a Delete appears on each report
  that has not been ruled on yet.

## The daily routine

1. **Anyone reports an event** on the Events tab: pick the roommate (or
   several, or everyone), the kind of thing, what happened and when. A
   signed-in roommate reports as themselves, always; anyone else types a
   name or stays anonymous. It posts to the Events page immediately.
   **Couch bookings report themselves:** the first time a roommate opens the
   Couch App after a booking's day has ended, that booking lands on the
   Events page tagged "Couch App" (a date booking carries the guest's name).
   A booking for next Thursday shows up on Friday, never before.
2. **Noah can delete a report** from the Events tab, and only Noah: the
   database rule allows a change or deletion only from the Google account
   that holds the Noah claim. Nobody approves anything in the app.
3. **At the close, Noah comes to the chat** and says "update today", with
   any corrections: "everyone was at that one", "add that it was her
   birthday", "skip the second one". The committee (Claude) reads the
   submitted events from the database, weighs each one against the
   roommate's history and how expected it was, writes the filings with its
   reasoning, and pushes. The deploy moves the board, and each filing's
   `ref` marks its submission as filed.

## How prices move

Nothing in the app explains the pricing, on purpose: like a real stock,
nobody knows in advance how much an event is worth. A listing is the
market's read on that roommate at any given moment, sometimes inflated,
sometimes deflated.

**The engine carries no formulas.** Every filing in the ledger carries the
percentage the committee ruled, after weighing the roommate's history, how
expected the event was, and how much it really means. A surprise girlfriend
is a jump; a girlfriend after five dates with the same person is largely
priced in. Getting stood up once stings; getting stood up for the fourth
time is mostly already in the price. A good deed at church counts. A game
night everyone went to is a little for everyone. The categories (date,
romance, life, social, apartment, other) are flavour and supply the emoji.

The only automatic movement: a listing that goes a **full week** without a
filing steps down 2% at the close of that seventh day, again a week later,
and so on, up to four steps; then it holds until something happens. No
single filing moves a listing more than 40%; nothing trades below $1.00.

## Filing an event (for the committee)

The ledger is `src/exchange/ledger.js`. Append an entry, keep the list in
date order, commit, push:

```js
{
  day: '2026-10-16',          // the trading day it happened
  name: 'Jonas',              // Noah | Bryon | Jonas | Andrew | James
  type: 'date',               // a category id from CATEGORIES in market.js
  partner: 'Maya',            // dates only: who with
  pct: 8,                     // the ruling, in percent
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

## Hosting on Railway

One repo, two Railway services, one Firebase project.

**The Couch App service you already have** keeps deploying as before. Once
the `exchange` branch is merged into `main`, that service also serves the
exchange at `https://<couch-domain>/exchange/`, and the Couch App's Settings
tab links to it.

**A second service gives the exchange its own link.** In the Railway
dashboard:

1. In the project, **New → GitHub Repo** and pick this same repository.
2. Under the new service's **Settings → Source**, set the branch (`exchange`
   now, or `main` once merged).
3. Under **Variables**, add `APP` = `exchange`. That makes the server put the
   exchange at the root of this service's domain instead of under
   `/exchange/`.
4. Under **Settings → Networking**, **Generate Domain** (or attach a custom
   one). That is the exchange's link.
5. Optional: add `VITE_COUCH_URL` = the Couch App's URL so the "Open the Couch
   App" row on the About tab points across, and on the Couch App's service add
   `VITE_EXCHANGE_URL` = the exchange's URL so its Settings link does the same.

Railway builds with `npm run build` and starts with `npm start`, which runs
`server.js`: a small static server that serves `dist/` and, when `APP` is
`exchange`, answers `/` with the exchange page. Nothing else differs between
the two services.

## Firebase

Both apps use the same Firebase project and Realtime Database
(`couch-reservation`), with the config in `src/firebase.js`. The exchange
stores submitted events under `exchange/submissions`; the Couch App stores
reservations, profile photos and the roommate claims.

**Google sign-in** needs two things switched on in the Firebase console:

1. Authentication → Sign-in method → **Google** → Enable.
2. Authentication → Settings → **Authorized domains** → add
   `couch-calendar-production.up.railway.app` and
   `449-exchange-production.up.railway.app` (and any custom domain).

**Database rules** are checked in as `database.rules.json` and must be
published in the console (Realtime Database → Rules), or with
`npx firebase-tools deploy --only database` when the CLI is signed in:

```json
{
  "rules": {
    "reservations": { ".read": "auth != null", ".write": "auth != null" },
    "profiles": { ".read": true, ".write": "auth != null" },
    "members": {
      "$uid": {
        ".read": "auth != null && auth.uid == $uid",
        ".write": "auth != null && auth.uid == $uid && !data.exists()"
      }
    },
    "claims": {
      ".read": "auth != null",
      "$name": { ".write": "auth != null && !data.exists() && newData.val() == auth.uid" }
    },
    "exchange": {
      ".read": true,
      "submissions": {
        "$id": {
          ".write": "!data.exists() || (auth != null && root.child('claims/Noah').val() == auth.uid)"
        }
      }
    }
  }
}
```

Reservations are private to signed-in roommates. Profile photos stay readable
by the public exchange but only a signed-in roommate can change them. A
roommate claim can be written once and never changed. Anyone can add an
event report; only the Google account holding the Noah claim can change or
delete one.
Publish these rules together with the Couch App that asks for sign-in: the
old Couch App cannot read reservations under them.

## What is in the app

- **Market**: ticker tape, the BOYO 5 index (the average of the five), the
  ranked listings with sparklines and today's change, a chart of any mix of
  listings over 1W, 1M, 1Y or all time, and for roommates a collapsible list
  of filings and the previous day's closing report.
- **Ticker page**: the price, today's change, the full price chart (hover or
  arrow keys for a day's value; a table view underneath), stats including how
  long the listing has been quiet and its last filing, a button to report
  something about that roommate, and that roommate's filings.
- **Events**: the report button, and for roommates the reports awaiting the
  committee, every filing grouped by day with the committee's verdict, and
  the filed reports. Noah also gets Delete on reports not yet ruled on.
- **About**: how the exchange works in a paragraph (no numbers), a theme
  toggle, a share button, and the link to the calendar.

Add `?demo` to the URL (`/exchange/?demo`) to preview the board with a few
weeks of made-up filings and submissions, with the reviewer controls on and
no sign-in needed; `?demo&outsider` previews the same board the way someone
who is not a roommate sees it.
Demo data never touches the real ledger or database.

## Code

| File | What it does |
|---|---|
| `src/exchange/ledger.js` | The source of truth: the IPO date and every filing |
| `src/exchange/market.js` | Pure pricing engine: rebuilds the board from the ledger, the weekly step down, series, ranges, stats, the closing report |
| `src/exchange/market.test.mjs` | Unit tests for the engine (`npm test`) |
| `src/exchange/charts.jsx` | SVG sparkline, price chart and all-listings chart with crosshair tooltips and table views |
| `src/exchange/Exchange.jsx` | The app: routing, pages, the report form, review controls, theme, profile photos |
| `src/exchange/exchange.css` | Styles, light and dark |
| `exchange/index.html` | The second Vite entry, served at `/exchange/` |
| `server.js` | The production server: `dist/` at `/`, or the exchange at the root when `APP=exchange` |
| `public/exchange/manifest.json` | Web app manifest so the exchange can be added to a home screen |
| `src/roommates.js` | The roster and colours, shared with the Couch App |
