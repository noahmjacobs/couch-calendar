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

export const IPO = '2026-08-01'

export const LEDGER = [
  // no filings yet: everyone opened at $100.00 on Saturday, August 1, 2026
]
