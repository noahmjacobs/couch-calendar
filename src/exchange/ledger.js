// THE LEDGER — the single source of truth for the 449 Exchange.
//
// Every price on the board is derived from this file: the IPO, then one entry
// per ruling. Events are reported in the app, the household confirms them, and
// the pricing committee (Claude) rules on each one: it weighs the roommate's
// history, how expected the event was and how much it really means, sets the
// percentage, and appends a filing here. The next deploy moves the market.
// Nothing else changes a price, apart from a small step down for a listing
// that goes a full week without a filing (see market.js).
//
// A filing:
//   {
//     day: '2026-10-14',        // the trading day it happened (local date)
//     name: 'Jonas',            // Noah | Bryon | Jonas | Andrew | James
//     type: 'date',             // a category id from CATEGORIES in market.js:
//                               // date, romance, life, social, apartment, other
//                               // (flavour only; supplies the emoji)
//     pct: 8,                   // the committee's ruling, in percent
//     title: 'Date with Maya',  // what it was, in a few words
//     partner: 'Maya',          // dates only: who with
//     note: 'what happened',    // the facts, as reported
//     verdict: 'why this much', // the committee's reasoning, published to the household
//     by: 'Noah',               // who reported it
//     ref: '-OabcXYZ'           // optional: the submission id this rules on
//   }
//
// Filings are applied in the order they appear here, day by day. Keep the list
// in chronological order so the record reads top to bottom. An event that
// involves several roommates is one filing per roommate, each with its own
// percentage.
//
// A withdrawal removes a report from the app without ruling on it:
//   { withdrawn: true, ref: '-OabcXYZ', note: 'why' }

export const IPO = '2026-08-01'

export const LEDGER = [
  // ---- Backfill from the Couch App's bookings, ruled October 15, 2026 ----
  {
    day: '2026-08-23',
    name: 'Noah',
    type: 'date',
    partner: 'Olivia',
    pct: 9,
    note: 'Dinner and a movie on the couch, 6 to 10 PM.',
    verdict: 'First date on record for NOAH, and a four-hour block. The market opens the position with enthusiasm.',
    by: 'Couch App',
    ref: 'couch-2026-08-23-18'
  },
  {
    day: '2026-08-25',
    name: 'Noah',
    type: 'date',
    partner: 'Abby',
    pct: 3,
    note: 'Dinner on the couch, 6 to 7 PM.',
    verdict: 'A second name two days after the first. Activity is good; the market just cannot tell which position it is holding.',
    by: 'Couch App',
    ref: 'couch-2026-08-25-18'
  },
  {
    day: '2026-08-26',
    name: 'Noah',
    type: 'date',
    partner: 'Olivia',
    pct: -2,
    note: 'Movie, 7 to 9 PM. Filed as the last date.',
    verdict: 'Second date with Olivia, filed as the last one. A position closed after two sessions; the market trims rather than punishes.',
    by: 'Couch App',
    ref: 'couch-2026-08-26-19'
  },
  {
    day: '2026-08-28',
    name: 'Noah',
    type: 'date',
    partner: 'Jess',
    pct: 4,
    note: 'Dinner on the couch, 5 to 8 PM.',
    verdict: 'Third name in six days. The desk notes the volume but discounts a pipeline this wide.',
    by: 'Couch App',
    ref: 'couch-2026-08-28-17'
  },
  {
    day: '2026-08-29',
    name: 'Andrew',
    type: 'date',
    partner: 'Cariña',
    pct: 7,
    note: 'Couch reserved 2 to 8 AM. “Might get freaky who knows.”',
    verdict: 'First date on record for ANDW, booked for the small hours. The market is intrigued and slightly concerned about the hour.',
    by: 'Couch App',
    ref: 'couch-2026-08-29-2'
  },
  {
    day: '2026-08-30',
    name: 'James',
    type: 'social',
    title: 'Hosted a dinner',
    pct: 2,
    note: 'Dinner with people on the couch, 6 to 9 PM.',
    verdict: 'Hosting is a small, reliable dividend.',
    by: 'Couch App',
    ref: 'couch-2026-08-30-18'
  },
  {
    day: '2026-09-03',
    name: 'Jonas',
    type: 'date',
    partner: 'Annie',
    pct: 8,
    note: 'Couch reserved 6 to 7 PM. “Butts will be on the couch.”',
    verdict: 'First date on record for JNAS. The filing speaks for itself.',
    by: 'Couch App',
    ref: 'couch-2026-09-03-18'
  },
  {
    day: '2026-09-03',
    name: 'James',
    type: 'date',
    partner: 'Rachel',
    pct: 8,
    note: 'Couch reserved 7 to 8 PM, taken from Jonas.',
    verdict: 'First date on record for JAMS, on a couch pried from JNAS. The market rewards initiative.',
    by: 'Couch App',
    ref: 'couch-2026-09-03-19'
  },
  {
    day: '2026-09-05',
    name: 'Andrew',
    type: 'date',
    partner: 'Cariña',
    pct: 9,
    note: 'Movie night and McDonald’s ice cream cones, 11 PM to midnight.',
    verdict: 'Same name a week later, with ice cream. Momentum confirmed, and at a more civilised hour.',
    by: 'Couch App',
    ref: 'couch-2026-09-05-23'
  },
  {
    day: '2026-09-09',
    name: 'Noah',
    type: 'date',
    partner: 'Jess',
    pct: 7,
    note: 'Sewing on the couch, 8 to 9 PM.',
    verdict: 'Twelve days later, the same name. Repeat business is what the market pays for. Sewing is noted favourably.',
    by: 'Couch App',
    ref: 'couch-2026-09-09-20'
  },
  {
    day: '2026-09-10',
    name: 'James',
    type: 'apartment',
    title: 'Made the house dirty',
    pct: -3,
    note: 'Self-described: “Making the house dirty,” 6 to 7 PM.',
    verdict: 'Self-reported mess. The market takes him at his word.',
    by: 'Couch App',
    ref: 'couch-2026-09-10-1080'
  },
  {
    day: '2026-09-10',
    name: 'Noah',
    type: 'life',
    title: 'Hosted the EQ presidency meeting',
    pct: 2,
    note: 'Elders quorum presidency meeting on the couch, 7 to 8 PM.',
    verdict: 'Church leadership hosted at home. Steady, respectable, mildly accretive.',
    by: 'Couch App',
    ref: 'couch-2026-09-10-1140'
  },
  {
    day: '2026-09-11',
    name: 'Bryon',
    type: 'social',
    title: 'Hosted game night',
    pct: 3,
    note: 'Game night on the couch, 7 to 9 PM.',
    verdict: 'Hosted game night. The only BRYN filing on record, which the market would like to see change.',
    by: 'Couch App',
    ref: 'couch-2026-09-11-1140'
  },
  {
    day: '2026-09-27',
    name: 'James',
    type: 'date',
    partner: 'Sophie',
    pct: 8,
    note: 'Couch reserved 7 to 11 PM.',
    verdict: 'A new name after three quiet weeks, and four hours of it. A strong print.',
    by: 'Couch App',
    ref: 'couch-2026-09-27-1140'
  },
  {
    day: '2026-10-03',
    name: 'James',
    type: 'date',
    partner: 'Sophie',
    pct: 10,
    note: 'Couch reserved 7 to 9 PM.',
    verdict: 'Same name six days later. The market now has a thesis on JAMS.',
    by: 'Couch App',
    ref: 'couch-2026-10-03-1140'
  },

  // ---- Withdrawals ----
  { withdrawn: true, ref: '-P3y68vtOr_DY8v5RhNl', note: 'Fake report about Noah, October 14. Withdrawn by the committee.' }
]
