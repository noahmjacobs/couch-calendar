import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  IPO_PRICE,
  NOISE,
  PCT_LIMIT,
  buildMarket,
  closeDay,
  applyFiling,
  initialMarket,
  priceSeries,
  indexSeries,
  dayChange,
  indexChange,
  noiseFor,
  closingReport,
  rankings,
  eventList,
  tickerStats,
  addDays,
  daysBetween,
  fmtPct,
  fmtCap,
  clampPct
} from './market.js'

const IPO = '2026-10-14'

test('an empty ledger lists everyone at the IPO price on opening day', () => {
  const m = buildMarket([], IPO, IPO)
  assert.deepEqual(Object.values(m.live), [100, 100, 100, 100, 100])
  assert.deepEqual(m.closes, {})
  assert.deepEqual(m.events, [])
})

test('each past day gets a close; today stays live', () => {
  const m = buildMarket([], IPO, '2026-10-17')
  assert.deepEqual(Object.keys(m.closes).sort(), ['2026-10-14', '2026-10-15', '2026-10-16'])
  const s = priceSeries(m, 'Noah', '2026-10-17')
  assert.equal(s.length, 5)
  assert.equal(s[0].label, 'IPO')
  assert.equal(s[4].live, true)
  assert.equal(s[4].day, '2026-10-17')
})

test('noise is deterministic, bounded and differs by roommate and day', () => {
  const a = noiseFor(IPO, 'Noah')
  assert.equal(a, noiseFor(IPO, 'Noah'))
  assert.ok(Math.abs(a) <= NOISE)
  assert.notEqual(a, noiseFor(IPO, 'Bryon'))
  assert.notEqual(a, noiseFor(addDays(IPO, 1), 'Noah'))
})

test('a filing moves the price by the standard impact and is recorded', () => {
  const m = buildMarket([{ day: IPO, name: 'James', type: 'girlfriend', by: 'Noah', note: 'Confirmed.' }], IPO, IPO)
  assert.equal(m.live.James, 115)
  assert.equal(m.events.length, 1)
  assert.equal(m.events[0].title, 'Got a girlfriend')
  assert.equal(m.events[0].emoji, '💘')
  assert.equal(m.events[0].before, 100)
  assert.equal(m.events[0].after, 115)
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

test('the floor holds under a run of disasters', () => {
  const ledger = Array.from({ length: 40 }, () => ({ day: IPO, name: 'Bryon', type: 'dumped' }))
  const m = buildMarket(ledger, IPO, IPO)
  assert.equal(m.live.Bryon, 1)
})

test('filings compound in ledger order and future filings wait', () => {
  const ledger = [
    { day: IPO, name: 'Noah', pct: 10 },
    { day: IPO, name: 'Noah', pct: -10 },
    { day: '2026-10-20', name: 'Noah', pct: 25 }
  ]
  const m = buildMarket(ledger, IPO, IPO)
  assert.equal(m.live.Noah, 99) // 100 * 1.1 * 0.9
  assert.equal(m.events.length, 2)
  const later = buildMarket(ledger, IPO, '2026-10-20')
  assert.equal(later.events.length, 3)
})

test('a filing dated before the IPO counts on opening day', () => {
  const m = buildMarket([{ day: '2026-10-01', name: 'Noah', pct: 5 }], IPO, IPO)
  assert.equal(m.events[0].day, IPO)
  assert.equal(m.live.Noah, 105)
})

test("today's change is measured from yesterday's close and includes today's filings", () => {
  const m = buildMarket([{ day: '2026-10-15', name: 'Noah', type: 'first-kiss' }], IPO, '2026-10-15')
  const prev = m.closes[IPO].prices.Noah
  const ch = dayChange(m, 'Noah', '2026-10-15')
  assert.equal(ch.prev, prev)
  assert.equal(ch.pct, 8)
  // on opening day the reference is the IPO price
  const first = buildMarket([{ day: IPO, name: 'Noah', pct: 3 }], IPO, IPO)
  assert.equal(dayChange(first, 'Noah', IPO).prev, IPO_PRICE)
  assert.equal(dayChange(first, 'Noah', IPO).pct, 3)
})

test("a close's day change counts the filings made earlier that day", () => {
  let m = initialMarket(IPO)
  m = applyFiling(m, { day: IPO, name: 'Jonas', pct: 10 }, 0)
  m = closeDay(m, IPO)
  const mv = m.closes[IPO].moves.Jonas
  assert.equal(mv.open, 100)
  assert.equal(mv.filings, 1)
  assert.ok(mv.pct > 9 && mv.pct < 11, `day move ${mv.pct}`)
  assert.deepEqual(closeDay(m, IPO), m)
})

test('the index is the average of the five', () => {
  const m = buildMarket([{ day: IPO, name: 'Noah', pct: 10 }], IPO, IPO)
  assert.equal(indexChange(m, IPO).now, 102)
  assert.equal(indexChange(m, IPO).pct, 2)
  const s = indexSeries(m, IPO)
  assert.equal(s[s.length - 1].price, 102)
})

test('the closing report is written from the day', () => {
  const m = buildMarket([{ day: IPO, name: 'Noah', type: 'first-kiss', by: 'Sam' }], IPO, '2026-10-15')
  const r = closingReport(m, IPO)
  assert.equal(r.lines.length, 5)
  assert.equal(r.lines[0].name, 'Noah')
  assert.match(r.headline, /NOAH led/)
  assert.match(r.lines[0].text, /First kiss/)
  assert.match(r.lines[1].text, /quiet trading/)
  assert.equal(closingReport(m, '2026-10-15'), null)
  const quiet = closingReport(buildMarket([], IPO, '2026-10-15'), IPO)
  assert.match(quiet.headline, /Quiet Wednesday session/)
})

test('rankings, event list order and stats', () => {
  const m = buildMarket(
    [
      { day: IPO, name: 'Jonas', type: 'date' },
      { day: '2026-10-15', name: 'James', type: 'dumped' }
    ],
    IPO,
    '2026-10-16'
  )
  assert.equal(rankings(m)[0], 'Jonas')
  assert.equal(rankings(m)[4], 'James')
  const list = eventList(m)
  assert.equal(list[0].name, 'James') // newest first
  const st = tickerStats(m, 'James', '2026-10-16')
  assert.equal(st.filings, 1)
  assert.equal(st.daysListed, 3)
  assert.ok(st.low < 85 && st.high >= 100)
})

test('formatting helpers', () => {
  assert.equal(fmtPct(3.456), '+3.46%')
  assert.equal(fmtPct(0), '0.00%')
  assert.equal(fmtCap(1020000), '$1.02M')
  assert.equal(daysBetween(IPO, '2026-11-14'), 31)
})

test("today's drift accrues through the day and lands on the close", () => {
  const start = buildMarket([], IPO, IPO, 0)
  const mid = buildMarket([], IPO, IPO, 0.5)
  const end = buildMarket([], IPO, IPO, 1)
  assert.equal(start.live.Noah, IPO_PRICE)
  const full = noiseFor(IPO, 'Noah') * 100
  assert.ok(Math.abs(mid.live.Noah - (100 + full / 2)) < 0.011, `mid ${mid.live.Noah} vs ${100 + full / 2}`)
  // the close the next morning is exactly where the live price ended
  const next = buildMarket([], IPO, '2026-10-15', 0)
  assert.equal(next.closes[IPO].prices.Noah, end.live.Noah)
  // filings apply before the drift, same as at the close
  const withFiling = buildMarket([{ day: IPO, name: 'Noah', pct: 10 }], IPO, IPO, 1)
  const nextFiling = buildMarket([{ day: IPO, name: 'Noah', pct: 10 }], IPO, '2026-10-15', 0)
  assert.equal(nextFiling.closes[IPO].prices.Noah, withFiling.live.Noah)
})
