// THE LEDGER — the single source of truth for the 449 Exchange.
//
// Every price on the board is derived from this file: the IPO, then one entry
// per material event. Events are reported to the pricing committee in chat; the
// committee rules on the impact, appends a filing here, and the next deploy
// moves the market. Nothing else changes a price, apart from a little daily
// market noise between filings (see market.js).
//
// A filing:
//   {
//     day: '2026-10-14',        // the trading day it happened (local date)
//     name: 'Jonas',            // Noah | Bryon | Jonas | Andrew | James
//     type: 'first-kiss',       // optional, an id from EVENT_TYPES in market.js;
//                               // supplies the emoji, the default title and the
//                               // standard impact
//     pct: 8,                   // the committee's ruling, in percent. Overrides
//                               // the standard impact when both are present
//     title: 'First kiss',      // optional, defaults to the type's label
//     note: 'what happened',    // the facts, as reported
//     verdict: 'why this much', // the committee's reasoning, published with the filing
//     by: 'Noah'                // who reported it
//   }
//
// Filings are applied in the order they appear here, day by day. Keep the list
// in chronological order so the record reads top to bottom.

export const IPO = '2026-10-14'

export const LEDGER = [
  // no filings yet: everyone opened at $100.00 on Wednesday, October 14, 2026
]
