# 📈 449 Exchange

The official roommate stock market of 449. Five listings, one per roommate,
each opened at **$100.00** on **Saturday, August 1, 2026**. It is the front
of the 449 Boyos app, at the couch calendar's address; the calendar is a tab
of the same app, for roommates only.

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
- **The Calendar tab is roommates only.** It asks for a Google sign-in; the
  first time an account signs in it picks which roommate it is, and that
  claim is permanent (stored under `members/{uid}` and `claims/{name}`, so it
  follows the account onto any phone). Each name can be claimed exactly once,
  so once the five have signed in, any other Google account is told the
  calendar is not for it. Without a sign-in the tab shows only the sign-in
  card. If a roommate ever needs to move to a different Google account,
  delete their entry under `claims` in the Firebase console and they can
  claim again.
- **The About tab becomes You** for a signed-in roommate: profile photo,
  partner autofill, appearance and sign out, above the About text.
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
   that holds the Noah claim. The committee can also withdraw one, with a
   one-line entry in the ledger (`{ withdrawn: true, ref, note }`): the
   report disappears from the app without a ruling. Nobody approves anything
   in the app.
3. **At the close, Noah comes to the chat** and says "update today", with
   any corrections: "everyone was at that one", "add that it was her
   birthday", "skip the second one". The committee (Claude) reads the
   submitted events from the database, weighs each one against the
   roommate's history and how expected it was, writes the filings with its
   reasoning, and pushes. The deploy moves the board, and each filing's
   `ref` marks its submission as filed.
   *How the committee reads the database:* the chat sandbox cannot reach
   Firebase, so the Railway project carries a tiny function named
   `exchange-reader` that prints everything under `exchange` to its deploy
   log and exits. Redeploying it (Railway MCP `redeploy`, then `get-logs`)
   gives a fresh read; it costs nothing between runs. The repository's
   "Read the exchange" workflow prints the same thing on every push to main.

## The Brindex

A second index next to the BOYO 5, from the household's friend Britta.
Once a week someone sends her the form at `/#/brindex` (the You tab has a
"Send Britta the Brindex form" row that shares the link). The
form is one slider per roommate, 0 to 10, an optional comment, Submit;
under a minute.

The index opens at 100 on the IPO date and moves with each report, and it
is meant to be wild: every point of average above 5 is +10%, every point
below is −10% (an average of 7 is +20%, of 2 is −30%, all 10s is +50%).
Pure arithmetic, no committee; it moves the moment she submits, and it
affects nothing else. Nothing moves it between reports. The form is always
filed under Britta's name. The index value is public; her per-roommate
ratings and comment show only to signed-in roommates, in the collapsed
"Latest Brindex report" card on the market page, which has a Delete button
for Noah. Both indexes can be added to the market chart with the BOYO 5 and
Brindex pills, drawn dashed next to the listings. Reports are stored under
`exchange/brindex`; a bad one can be deleted by Noah's account or withdrawn
by the committee with a `{ withdrawn: true, brindex: '<id>' }` ledger entry.

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
romance, life, social, apartment, minute, other) are flavour and supply the
emoji. **Minute** (👀) is for the small stuff and the rumours: things the
household wants on the record without making a big deal of them, so the
committee keeps those to a point or two, if it moves them at all. The
committee may also file a report under a different category than it was
reported in; once ruled, the report shows the committee's category.

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

One Railway service, deploying from `main`. Railway builds with
`npm run build` and starts with `npm start`, which runs `server.js`: a small
static server that serves `dist/` and sends the old `/exchange/` address to
the root.

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
      },
      "brindex": {
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

- **Market**: ticker tape, the BOYO 5 index (the average of the five) and
  the Brindex side by side, the ranked listings with sparklines and today's
  change, a chart of any mix of listings and indexes over 1W, 1M, 1Y or all
  time, and for roommates the latest Brindex report, each roommate's event
  history, and the previous day's closing report.
- **Ticker page**: the price, today's change, the full price chart (hover or
  arrow keys for a day's value; a table view underneath), stats including how
  long the listing has been quiet and its last filing, a button to report
  something about that roommate, and that roommate's filings.
- **Events**: the report button, and for roommates the reports awaiting the
  committee, every filing grouped by day with the committee's verdict, and
  the filed reports. Noah also gets Delete on reports not yet ruled on.
- **Calendar**: the couch calendar, for signed-in roommates; the sign-in
  card for everyone else.
- **About**: how the exchange works in a paragraph (no numbers) and a share
  button; for a signed-in roommate it is the You tab, with the profile
  photo, partner, appearance and sign out above that.

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
| `src/exchange/Exchange.jsx` | The app: routing, pages, the report form, sign-in and claims, the calendar tab, settings |
| `src/calendar/Calendar.jsx` | The couch calendar: day, week and month views, the booking sheet, release requests |
| `src/calendar/calendar.css` | The calendar's styles |
| `src/shared.jsx` | Avatars, the splash, the sign-in error text, the iOS viewport fix |
| `src/exchange/exchange.css` | Styles, light and dark |
| `server.js` | The production server over `dist/`, with `/exchange/` sent to the root |
| `src/roommates.js` | The roster and colours, shared with the Couch App |
