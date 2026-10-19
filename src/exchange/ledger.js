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
//                               // date, romance, life, social, apartment,
//                               // minute, other (flavour only; supplies the
//                               // emoji. The committee may file a report under
//                               // a different category than it was reported in;
//                               // "minute" is for small stuff and rumours)
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
// percentage; that includes a reporter who is part of the story they report,
// whom the committee may rule on as well. Filings that share a `ref` show
// together on that report in the app.
//
// A withdrawal removes a report from the app without ruling on it:
//   { withdrawn: true, ref: '-OabcXYZ', note: 'why' }
// and one with `brindex` instead of `ref` removes a Brindex report, so it no
// longer moves that index:
//   { withdrawn: true, brindex: '-OabcXYZ', note: 'why' }

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

  // ---- Ruled October 15, 2026: game night and the week's bookings ----
  {
    day: '2026-10-11',
    name: 'Bryon',
    type: 'social',
    title: 'Game night: brought three FHE guests',
    pct: 12,
    note: 'Sunday game night at the house. Bryon invited three girls from FHE and all three came.',
    verdict: 'The most shorted name on the board invites three guests to his own living room and all three show. One filing in two months, then this. A squeeze.',
    by: 'Noah'
  },
  {
    day: '2026-10-11',
    name: 'James',
    type: 'romance',
    title: 'Game night: brought Sophie',
    pct: 8,
    note: 'Sunday game night at the house. James invited Sophie and she came.',
    verdict: 'Two dates on record and now she meets the household. The thesis on JAMS moves from a name to a relationship.',
    by: 'Noah'
  },
  {
    day: '2026-10-11',
    name: 'Andrew',
    type: 'social',
    title: 'Game night: ran a game',
    pct: 6,
    note: 'Sunday game night at the house. Andrew led one of the games.',
    verdict: 'Attendance plus leadership. The man holding the rulebook earns a premium over the men on the couch.',
    by: 'Noah'
  },
  {
    day: '2026-10-11',
    name: 'Noah',
    type: 'social',
    title: 'Game night',
    pct: 4,
    note: 'Sunday game night at the house. All five roommates attended.',
    verdict: 'Present at a full-house event. The market pays for showing up; it pays more for bringing someone.',
    by: 'Noah'
  },
  {
    day: '2026-10-11',
    name: 'Jonas',
    type: 'social',
    title: 'Game night',
    pct: 4,
    note: 'Sunday game night at the house. All five roommates attended.',
    verdict: 'Present at a full-house event. First filing on JNAS since September 3; the market is glad to hear from him.',
    by: 'Noah'
  },
  {
    day: '2026-10-15',
    name: 'Bryon',
    type: 'romance',
    title: 'Confirmed a date with Lauryn for Friday',
    partner: 'Lauryn',
    pct: 5,
    note: 'Date with Lauryn confirmed for Friday, October 16.',
    verdict: 'Guidance, not earnings: a confirmed booking with a name on it, four days after game night. The date itself prints Friday.',
    by: 'Noah'
  },
  {
    day: '2026-10-15',
    name: 'Noah',
    type: 'romance',
    title: 'A maybe for a date on Friday',
    pct: 2,
    note: 'A date on Friday, October 16, confirmed as a maybe.',
    verdict: 'A maybe is not a booking. The desk pencils it in and waits for Friday.',
    by: 'Noah'
  },
  {
    day: '2026-10-15',
    name: 'James',
    type: 'romance',
    title: 'Confirmed a date with Sophie for Saturday',
    partner: 'Sophie',
    pct: 3,
    note: 'Date with Sophie confirmed for Saturday, October 17.',
    verdict: 'Expected. The market already owns this story, so a confirmation is worth less here than it would be for anyone else. Saturday prints Saturday.',
    by: 'Noah'
  },

  // ---- Ruled October 17, 2026: Friday's reports ----
  {
    day: '2026-10-16',
    name: 'Noah',
    type: 'date',
    partner: 'Avery Porter',
    pct: 9,
    note: 'Built her an app to confirm the date. Flowers. Picked her up at 6 on the dot. An hour at Momentum climbing, two hours of conversation at Aubergine Kitchen, every door held. Did not walk her to her door at the drop-off; sent a Montana text into the silence; unread three hours later. Self-assessed as getting ghosted.',
    verdict: 'A first date with a new name, executed to a high standard: an app, flowers, punctual, climbing, two hours of talk, doors. On its own a top-tier print. The desk marks it down for the close: no walk to the door, then a risky text into a quiet phone. Three hours unread on a Friday night is not a ghosting; it is a Friday night. A reply is a filing. A week of silence is a different filing.',
    by: 'Noah',
    ref: '-P4723HYuCnXHpmyoAAc'
  },
  {
    day: '2026-10-16',
    name: 'James',
    type: 'other',
    title: 'Downloaded Cyberpunk 2077, unplayed',
    pct: -1,
    note: 'Downloaded Cyberpunk 2077 on an Xbox One S, digital only. Has not played it.',
    verdict: 'A download is not an event, and an unplayed one is barely a download. Immaterial; the desk docks a point for the Xbox One S and awaits the first hour of play.',
    by: 'James',
    ref: '-P472PEnl0lk_-nqqugh'
  },
  {
    day: '2026-10-16',
    name: 'Bryon',
    type: 'date',
    partner: 'Lauryn Grant',
    pct: 13,
    note: 'Painted pottery for about two hours with good conversation; she asked about his family first; a funny stretch on conspiracy theories, which she loves. Ice cream after, and when he checked the time she said “we have an hour, we’re good.” A hug at the end, then a text from her: thank you, and she is excited to see how the ceramics come out. He has to go back for them once they are fired.',
    verdict: 'The booking the desk priced as guidance on Thursday delivered in full. Two hours of pottery, extended on her initiative, a hug, and a thank-you text from her side. The ceramics have to be collected once fired, which is a second meeting on the books in all but name. The cleanest first-date print on the record; BRYN leaves the bottom of the board behind for good.',
    by: 'Bryon',
    ref: '-P472aHX43tsnb4QXbny'
  },
  {
    day: '2026-10-16',
    name: 'Bryon',
    type: 'minute',
    title: 'Doubted the cockroach sightings',
    pct: -1,
    note: 'Accused Noah of not seeing cockroaches when Noah says he sees them. Reported as Apartment; filed by the committee as Minute.',
    verdict: 'A dispute over cockroach sightings is a governance matter, not a pest matter. Minute: the desk notes the friction and the possibility of cockroaches, and moves on.',
    by: 'Noah',
    ref: '-P479Px7GwOLbGbWy5hm'
  },
  {
    day: '2026-10-16',
    name: 'Noah',
    type: 'minute',
    title: 'Took the cockroach dispute to the exchange',
    pct: -1,
    note: 'The other party to the cockroach dispute, and the one who reported it. Says he sees cockroaches; Bryon doubts him.',
    verdict: 'Two parties, one dispute, no cockroach in evidence. The reporter is in the story he reported, so he is in the ruling: a point for taking it to the exchange, as Bryon lost a point for doubting him. Minute.',
    by: 'Noah',
    ref: '-P479Px7GwOLbGbWy5hm'
  },
  {
    day: '2026-10-16',
    name: 'Noah',
    type: 'minute',
    title: 'The cockroaches were thread',
    pct: -2,
    note: 'Has reported cockroaches several times. On inspection he calls anything small and dark on the floor a cockroach: balls of thread, little scraps. It has caused unnecessary distress.',
    verdict: 'Several sightings, zero cockroaches: on inspection, thread and floor scraps. Crying cockroach in a shared apartment costs credibility and the household its calm. Minute, but the desk now has a pattern.',
    by: 'Bryon',
    ref: '-P47AzPws6hUouUxqgOn'
  },
  {
    day: '2026-10-16',
    name: 'Bryon',
    type: 'minute',
    title: 'The doubt had grounds',
    pct: 1,
    note: 'Filed the rebuttal: the cockroaches were thread.',
    verdict: 'The doubt the desk docked a point for turns out to have had grounds. The point comes back. The committee notes the household now holds three filings about cockroaches and no cockroach.',
    by: 'Bryon',
    ref: '-P47AzPws6hUouUxqgOn'
  },

  // ---- Ruled October 17, 2026: Saturday ----
  {
    day: '2026-10-17',
    name: 'Noah',
    type: 'romance',
    title: 'Avery replied',
    partner: 'Avery Porter',
    pct: 6,
    note: 'She hearted the Montana text, thanked him again for a fun afternoon, and apologised for not texting sooner. He answered with a line about swimming and snowboarding, the BYU game, and a second risky text: a hypothetical extra ticket to the Baylor game in a couple of weeks, and something sooner if she has the emotional availability. That one is pending.',
    verdict: 'The Friday-night silence the desk refused to price as a ghosting was not one. A heart on the risky text, a thank-you and an apology for the slow reply: the markdown on Thursday\'s close is reversed, with a little on top for the heart. A second risky text is now out, a Baylor ticket held hypothetically. The desk does not price a text until it is answered.',
    by: 'Noah'
  },

  // ---- Ruled October 18, 2026: Saturday's reports ----
  {
    day: '2026-10-17',
    name: 'Bryon',
    type: 'apartment',
    title: 'Did everyone\'s dishes',
    pct: 4,
    note: 'Did the dishes the whole apartment left, everyone\'s but Jonas, who is out of town. Did not seek a thank-you.',
    verdict: 'The whole household\'s sink, cleared without asking for credit. The exchange gives the credit anyway. A reliable dividend, paid in full.',
    by: 'Noah',
    ref: '-P4AuerDzXYIyExGnK29'
  },
  {
    day: '2026-10-17',
    name: 'Noah',
    type: 'apartment',
    title: 'Vacuumed, wiped, dishwasher started, press release issued',
    pct: 2,
    note: 'Vacuumed the living room, wiped all the counters and started the dishwasher. Not humble about it; will make sure everyone knows.',
    verdict: 'The work is real: floor, counters, dishwasher. The press release is also real. Three for the work, one off for the press release.',
    by: 'Noah',
    ref: '-P4AunSTF2WTS6xoqE7V'
  },
  {
    day: '2026-10-17',
    name: 'Andrew',
    type: 'social',
    title: 'Reserved the clubhouse for Wednesday',
    pct: 3,
    note: 'Reserved the clubhouse for a potentially epic event on Wednesday and confirmed it with the landlord, JT. Details to come.',
    verdict: 'Guidance, not earnings: a booking with a landlord\'s confirmation on it. The desk notes ANDW taking initiative after a quiet week. Wednesday prints Wednesday.',
    by: 'Noah',
    ref: '-P4Av1iISPXI0ah9DGC5'
  },
  {
    day: '2026-10-17',
    name: 'James',
    type: 'minute',
    title: 'Played Cyberpunk for thirty minutes',
    pct: 1,
    note: 'Played Cyberpunk 2077 on the Xbox One S for about thirty minutes. It was just OK.',
    verdict: 'The desk asked for an hour and got thirty minutes and a shrug. The point returns on a technicality. The desk does not expect to hear about Cyberpunk again.',
    by: 'James',
    ref: '-P4AE5ss4REl0xoonZYy'
  },
  {
    day: '2026-10-17',
    name: 'Bryon',
    type: 'life',
    title: 'BYU over Notre Dame, in person, with family',
    pct: 4,
    note: 'Went to the BYU game with his family. BYU, ranked eighth, beat second-ranked Notre Dame. Graduated from BYU six months ago; saw lots of people he knew and felt popular.',
    verdict: 'A top-ten upset in person, with family, in a stadium full of people who knew him. The desk cannot pay for BYU\'s defense, but it pays for being seen.',
    by: 'Bryon',
    ref: '-P4CjCTxQ1M6YQJEHzt-'
  },
  {
    day: '2026-10-17',
    name: 'James',
    type: 'date',
    partner: 'Sophie Middleton',
    pct: 8,
    note: 'Drove up to Sundance for the haunted ski lift, very fun and very cold, coat too thin. Maverik for hot chocolate, then her place for the 2003 Haunted Mansion, and a very wholesome make-out. Date four or five; he has stopped counting.',
    verdict: 'The fourth or fifth with the same name, and he has stopped counting, which is itself the signal. A haunted lift, a thin coat, hot chocolate, a movie at her place and a wholesome make-out: the story the market already owns moved a chapter. Priced as a known position printing a new high, not a new position.',
    by: 'James',
    ref: '-P4ChNsdAaynf3nyXlXn'
  },
  {
    day: '2026-10-17',
    name: 'Noah',
    type: 'romance',
    title: 'Over-traded the Avery position',
    partner: 'Avery Porter',
    pct: -4,
    note: 'Texted Avery during the BYU game asking if she wanted In-N-Out after. Left on read. Giving up; if she wants anything moving forward, the ball is in her court.',
    verdict: 'A heart and an apology at noon, then two more asks before midnight, the Baylor ticket and In-N-Out, both on read. The desk marks down for the pace, not the silence: a Saturday-night read receipt during a top-ten upset is not a verdict. "Ball in her court" is the right call. Filed as a hold, not a close.',
    by: 'Noah',
    ref: '-P4CiwGm8PhFlspnzU-a'
  },
  {
    day: '2026-10-17',
    name: 'Noah',
    type: 'romance',
    title: 'Texted Elle, a week after the friend zone',
    partner: 'Elle',
    pct: -3,
    note: 'Texted Elle, whom he took on a date last week and who friend-zoned him right after. Said he respected her boundaries, and offered climbing this week if she wanted. Waiting; probably not expecting a reply.',
    verdict: 'The desk learns, in passing, of a date last week and a friend-zoning right after it, neither of which was reported. The undisclosed close costs more than tonight\'s text. Respecting the boundary in writing is noted; sending it the same night the Avery position went quiet is noted too.',
    by: 'Noah',
    ref: '-P4CjACeBmT7ZlHpDPzX'
  },

  // ---- Ruled October 19, 2026: Sunday game night ----
  {
    day: '2026-10-18',
    name: 'Bryon',
    type: 'social',
    title: 'Game night: pumpkin cookies',
    pct: 4,
    note: 'Sunday night game night at the house. Bryon made pumpkin cookies that everyone appreciated.',
    verdict: 'Attended, and arrived with pumpkin cookies the whole room appreciated. The host\'s contribution of the night. BRYN closes a week with a date, a cleared sink, an upset win and a bake.',
    by: 'Noah',
    ref: '-P4HHoXp-ti308TmxlGh'
  },
  {
    day: '2026-10-18',
    name: 'Jonas',
    type: 'social',
    title: 'Game night: called time at 9:30',
    pct: 4,
    note: 'Sunday night game night at the house. Jonas did a good job of making everyone leave at 9:30 PM.',
    verdict: 'Back from out of town and straight into a role: the man who ends the party on time. The desk prizes discipline on a Sunday. First filing on JNAS in a week, and the market is glad to have him back on the floor.',
    by: 'Noah',
    ref: '-P4HHoXp-ti308TmxlGh'
  },
  {
    day: '2026-10-18',
    name: 'James',
    type: 'social',
    title: 'Game night: left at the half',
    pct: 1,
    note: 'Sunday night game night at the house. James left halfway through, which was sad; for the time he was there it was good.',
    verdict: 'Good while present, gone at the half. Attendance credit, trimmed for the early exit. After the week JAMS has had, the market can afford to be patient.',
    by: 'Noah',
    ref: '-P4HHoXp-ti308TmxlGh'
  },
  {
    day: '2026-10-18',
    name: 'Noah',
    type: 'social',
    title: 'Game night: set up and played',
    pct: 3,
    note: 'Sunday night game night at the house. Noah contributed to the activity and cleaned to prepare for it.',
    verdict: 'Cleaned the place before and played through. Set-up work is real work, and it was reported with less fanfare than Saturday\'s vacuuming. Three.',
    by: 'Noah',
    ref: '-P4HHoXp-ti308TmxlGh'
  },
  {
    day: '2026-10-18',
    name: 'Jonas',
    type: 'minute',
    title: 'Pillow to the head',
    pct: -1,
    note: 'Hit Noah in the head with a pillow. It hurt. Noah was disappointed and went to bed early.',
    verdict: 'A pillow to the head on game night. Minute: a point off for the strike, none for the aim.',
    by: 'Noah',
    ref: '-P4HJDdL-jbgt09D2L5E'
  },

  // ---- Withdrawals ----
  { withdrawn: true, ref: '-P3y68vtOr_DY8v5RhNl', note: 'Fake report about Noah, October 14. Withdrawn by the committee.' },
  { withdrawn: true, brindex: '-P3yYyHK_QXevuzNzADv', note: "Noah's test of the Brindex form, October 15. Withdrawn at his request." }
]
