import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  IPO_PRICE,
  PCT_LIMIT,
  IDLE_GRACE_DAYS,
  IDLE_DECAY,
  IDLE_SPAN_DAYS,
  DATING,
  buildMarket,
  closeDay,
  applyFiling,
  initialMarket,
  priceSeries,
  indexSeries,
  dayChange,
  indexChange,
  dateRuling,
  closingReport,
  rankings,
  eventList,
  tickerStats,
  addDays,
  daysBetween,
  fmtPct,
  clampPct
} from './market.js'

const IPO = '2026-08-01'
const d = (n) => addDays(IPO, n)

test('an empty ledger lists everyone at the IPO price on opening day', () => {
  const m = buildMarket([], IPO, IPO)
  assert.deepEqual(Object.values(m.live), [100, 100, 100, 100, 100])
  assert.deepEqual(m.closes, {})
  assert.deepEqual(m.events, [])
})

test('nothing moves while nothing happens, for a week', () => {
  const m = buildMarket([], IPO, d(7))
  assert.equal(Object.keys(m.closes).length, 7)
  assert.deepEqual(Object.values(m.live), [100, 100, 100, 100, 100])
})

test('after a quiet week a listing depreciates a little each day, then levels off', () => {
  const grace = buildMarket([], IPO, d(IDLE_GRACE_DAYS + 1))
  const expected = Math.round(100 * (1 - IDLE_DECAY) * 100) / 100
  assert.equal(grace.closes[d(IDLE_GRACE_DAYS)].prices.Noah, expected)
  assert.equal(grace.closes[d(IDLE_GRACE_DAYS - 1)].prices.Noah, 100)
  const flat = buildMarket([], IPO, d(IDLE_GRACE_DAYS + IDLE_SPAN_DAYS + 10))
  const last = flat.closes[d(IDLE_GRACE_DAYS + IDLE_SPAN_DAYS)].prices.Noah
  assert.equal(flat.live.Noah, last)
  assert.ok(last > 89 && last < 91, `fully depreciated at ${last}`)
})

test('a filing resets the idle clock', () => {
  const m = buildMarket([{ day: d(20), name: 'Noah', type: 'cooked' }], IPO, d(26))
  // Noah: decayed Aug 8..20, then +3%, then flat for six days
  const atFiling = m.closes[d(20)].prices.Noah
  assert.equal(m.live.Noah, atFiling)
  assert.ok(m.closes[d(25)].moves.Noah.decayPct === 0)
  // Bryon kept depreciating
  assert.ok(m.live.Bryon < m.closes[d(20)].prices.Bryon)
})

test('a fixed-impact filing moves the price and is recorded', () => {
  const m = buildMarket([{ day: IPO, name: 'James', type: 'girlfriend', by: 'Noah', note: 'Confirmed.' }], IPO, IPO)
  assert.equal(m.live.James, 125)
  assert.equal(m.events[0].title, 'Made it official')
  assert.equal(m.events[0].before, 100)
  assert.equal(m.events[0].after, 125)
})

test("the committee's own pct overrides the standard and is capped", () => {
  const m = buildMarket([{ day: IPO, name: 'Jonas', type: 'first-kiss', pct: 12 }], IPO, IPO)
  assert.equal(m.live.Jonas, 112)
  assert.equal(clampPct(80), PCT_LIMIT)
  assert.equal(clampPct(-80), -PCT_LIMIT)
  assert.equal(clampPct('abc'), 0)
})

test('an unknown type falls back to a committee ruling with the given pct', () => {
  const m = buildMarket([{ day: IPO, name: 'Andrew', pct: -4, title: 'Microwaved fish' }], IPO, IPO)
  assert.equal(m.live.Andrew, 96)
  assert.equal(m.events[0].type, 'other')
  assert.equal(m.events[0].title, 'Microwaved fish')
})

test('the dating ladder: first, juggling, second, third, steady, rekindled', () => {
  const ledger = [
    { day: d(1), name: 'Jonas', type: 'date', partner: 'Maya' }, // first: +10
    { day: d(4), name: 'Jonas', type: 'date', partner: 'Jess' }, // juggling: +5
    { day: d(6), name: 'Jonas', type: 'date', partner: 'maya ' }, // second with Maya: +15
    { day: d(12), name: 'Jonas', type: 'date', partner: 'Maya' }, // third: +18
    { day: d(15), name: 'Jonas', type: 'date', partner: 'Maya' }, // fourth: +20
    { day: d(40), name: 'Jonas', type: 'date', partner: 'Maya' }, // rekindled: +10
    { day: d(60), name: 'Jonas', type: 'date', partner: 'Kim' } // first, long gap: +10
  ]
  const m = buildMarket(ledger, IPO, d(60))
  const pcts = m.events.map((e) => e.pct)
  assert.deepEqual(pcts, [DATING.first, DATING.juggling, DATING.second, DATING.third, DATING.steady, DATING.rekindled, DATING.first])
  assert.equal(m.events[0].title, 'Date with Maya')
  assert.match(m.events[1].auto, /Juggling/)
  assert.match(m.events[2].auto, /Second date with maya/)
  assert.match(m.events[5].auto, /Rekindled/)
})

test('a date without a partner still counts, and a pct on a date overrides the ladder', () => {
  const m = buildMarket(
    [
      { day: d(1), name: 'Bryon', type: 'date' },
      { day: d(3), name: 'Bryon', type: 'date', note: 'someone from the app' },
      { day: d(5), name: 'Bryon', type: 'date', partner: 'Ana', pct: 2, verdict: 'Coffee. Barely a date.' }
    ],
    IPO,
    d(5)
  )
  assert.equal(m.events[0].pct, DATING.first)
  assert.equal(m.events[1].pct, DATING.juggling)
  assert.equal(m.events[2].pct, 2)
  assert.equal(m.events[2].auto, '')
})

test('dateRuling reads the record directly', () => {
  const r = dateRuling([], d(3), 'Maya')
  assert.equal(r.pct, DATING.first)
  assert.match(r.why, /First date on record/)
})

test('the floor holds under a run of disasters', () => {
  const ledger = Array.from({ length: 40 }, () => ({ day: IPO, name: 'Bryon', type: 'dumped' }))
  assert.equal(buildMarket(ledger, IPO, IPO).live.Bryon, 1)
})

test('filings compound in ledger order and future filings wait', () => {
  const ledger = [
    { day: IPO, name: 'Noah', pct: 10 },
    { day: IPO, name: 'Noah', pct: -10 },
    { day: d(6), name: 'Noah', pct: 25 }
  ]
  const m = buildMarket(ledger, IPO, IPO)
  assert.equal(m.live.Noah, 99) // 100 * 1.1 * 0.9
  assert.equal(m.events.length, 2)
  assert.equal(buildMarket(ledger, IPO, d(6)).events.length, 3)
})

test('a filing dated before the IPO counts on opening day', () => {
  const m = buildMarket([{ day: '2026-07-01', name: 'Noah', pct: 5 }], IPO, IPO)
  assert.equal(m.events[0].day, IPO)
  assert.equal(m.live.Noah, 105)
})

test("today's change is measured from yesterday's close and includes today's filings", () => {
  const m = buildMarket([{ day: d(1), name: 'Noah', type: 'first-kiss' }], IPO, d(1))
  const ch = dayChange(m, 'Noah', d(1))
  assert.equal(ch.prev, 100)
  assert.equal(ch.pct, 8)
  const first = buildMarket([{ day: IPO, name: 'Noah', pct: 3 }], IPO, IPO)
  assert.equal(dayChange(first, 'Noah', IPO).prev, IPO_PRICE)
})

test("a close's day change counts the filings made earlier that day", () => {
  let m = initialMarket(IPO)
  m = applyFiling(m, { day: IPO, name: 'Jonas', pct: 10 }, 0)
  m = closeDay(m, IPO)
  const mv = m.closes[IPO].moves.Jonas
  assert.equal(mv.open, 100)
  assert.equal(mv.filings, 1)
  assert.equal(mv.pct, 10)
  assert.deepEqual(closeDay(m, IPO), m)
})

test('the index is the average of the five', () => {
  const m = buildMarket([{ day: IPO, name: 'Noah', pct: 10 }], IPO, IPO)
  assert.equal(indexChange(m, IPO).now, 102)
  assert.equal(indexChange(m, IPO).pct, 2)
  assert.equal(indexSeries(m, IPO).pop().price, 102)
})

test('the price series runs IPO, closes, then the live point', () => {
  const s = priceSeries(buildMarket([], IPO, d(3)), 'Noah', d(3))
  assert.equal(s.length, 5)
  assert.equal(s[0].label, 'IPO')
  assert.equal(s[4].live, true)
})

test('the closing report covers filings, depreciation and quiet days', () => {
  const busy = buildMarket([{ day: IPO, name: 'Noah', type: 'first-kiss', by: 'Sam' }], IPO, d(1))
  const r = closingReport(busy, IPO)
  assert.equal(r.lines.length, 5)
  assert.match(r.headline, /NOAH led/)
  assert.match(r.lines[0].text, /First kiss/)
  assert.match(r.lines[1].text, /nothing to report/)
  const quiet = closingReport(buildMarket([], IPO, d(1)), IPO)
  assert.match(quiet.headline, /board held/)
  const decayed = closingReport(buildMarket([], IPO, d(9)), d(8))
  assert.match(decayed.headline, /Every listing depreciated/)
  assert.match(decayed.lines[0].text, /depreciation applies/)
  assert.equal(closingReport(busy, d(1)), null)
})

test('rankings, event list order and stats', () => {
  const m = buildMarket(
    [
      { day: IPO, name: 'Jonas', type: 'date', partner: 'Maya' },
      { day: d(1), name: 'James', type: 'dumped' }
    ],
    IPO,
    d(2)
  )
  assert.equal(rankings(m)[0], 'Jonas')
  assert.equal(rankings(m)[4], 'James')
  assert.equal(eventList(m)[0].name, 'James')
  const st = tickerStats(m, 'James', d(2))
  assert.equal(st.filings, 1)
  assert.equal(st.daysListed, 3)
  assert.equal(st.low, 80)
})

test('formatting helpers', () => {
  assert.equal(fmtPct(3.456), '+3.46%')
  assert.equal(fmtPct(0), '0.00%')
  assert.equal(daysBetween(IPO, '2026-08-31'), 30)
})
