import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  IPO_PRICE,
  PCT_LIMIT,
  IDLE_WEEK_DAYS,
  IDLE_WEEKLY_DECAY,
  IDLE_MAX_WEEKS,
  buildMarket,
  closeDay,
  applyFiling,
  initialMarket,
  priceSeries,
  rangeChange,
  round2,
  indexSeries,
  dayChange,
  indexChange,
  closingReport,
  rankings,
  eventList,
  tickerStats,
  sliceRange,
  brindexSeries,
  brindexValue,
  brindexChange,
  brindexMove,
  BRINDEX_SWING,
  withoutWithdrawn,
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

test('nothing moves for six quiet days; the seventh steps down once', () => {
  const six = buildMarket([], IPO, d(6))
  assert.deepEqual(Object.values(six.live), [100, 100, 100, 100, 100])
  const eight = buildMarket([], IPO, d(8))
  const stepped = Math.round(100 * (1 - IDLE_WEEKLY_DECAY) * 100) / 100
  assert.equal(eight.closes[d(IDLE_WEEK_DAYS)].prices.Noah, stepped)
  assert.equal(eight.closes[d(IDLE_WEEK_DAYS - 1)].prices.Noah, 100)
  // flat again until the next full week
  assert.equal(eight.closes[d(IDLE_WEEK_DAYS + 1)]?.prices.Noah ?? eight.live.Noah, stepped)
})

test('the step repeats weekly up to the cap, then the listing holds', () => {
  const m = buildMarket([], IPO, d(IDLE_WEEK_DAYS * (IDLE_MAX_WEEKS + 3)))
  const capped = Math.round(100 * Math.pow(1 - IDLE_WEEKLY_DECAY, IDLE_MAX_WEEKS) * 100) / 100
  assert.ok(Math.abs(m.live.Noah - capped) < 0.05, `${m.live.Noah} vs ${capped}`)
  assert.equal(m.closes[d(IDLE_WEEK_DAYS * (IDLE_MAX_WEEKS + 1))].moves.Noah.decayPct, 0)
})

test('a filing resets the idle clock', () => {
  const m = buildMarket([{ day: d(10), name: 'Noah', type: 'apartment', pct: 3 }], IPO, d(16))
  const atFiling = m.closes[d(10)].prices.Noah
  assert.equal(m.live.Noah, atFiling) // six quiet days since, no step yet
  const later = buildMarket([{ day: d(10), name: 'Noah', type: 'apartment', pct: 3 }], IPO, d(18))
  assert.ok(later.live.Noah < atFiling) // the seventh quiet day after the filing
  assert.ok(later.live.Bryon < 100)
})

test("a filing moves the price by the committee's percentage and is recorded", () => {
  const m = buildMarket([{ day: IPO, name: 'James', type: 'romance', pct: 12, title: 'Made it official', by: 'Noah', note: 'Confirmed.' }], IPO, IPO)
  assert.equal(m.live.James, 112)
  assert.equal(m.events[0].title, 'Made it official')
  assert.equal(m.events[0].emoji, '💘')
  assert.equal(m.events[0].before, 100)
  assert.equal(m.events[0].after, 112)
})

test('a filing without a percentage changes nothing but is logged', () => {
  const m = buildMarket([{ day: IPO, name: 'Jonas', type: 'social', title: 'Game night' }], IPO, IPO)
  assert.equal(m.live.Jonas, 100)
  assert.equal(m.events.length, 1)
  assert.equal(m.events[0].pct, 0)
})

test('percentages are capped and the floor holds', () => {
  assert.equal(clampPct(80), PCT_LIMIT)
  assert.equal(clampPct(-80), -PCT_LIMIT)
  assert.equal(clampPct('abc'), 0)
  const ledger = Array.from({ length: 40 }, () => ({ day: IPO, name: 'Bryon', type: 'romance', pct: -20 }))
  assert.equal(buildMarket(ledger, IPO, IPO).live.Bryon, 1)
})

test('a date filing is titled after the partner when no title is given', () => {
  const m = buildMarket([{ day: IPO, name: 'Jonas', type: 'date', partner: 'Maya', pct: 6 }], IPO, IPO)
  assert.equal(m.events[0].title, 'Date with Maya')
  assert.equal(m.events[0].partner, 'Maya')
})

test('filings compound in ledger order and future filings wait', () => {
  const ledger = [
    { day: IPO, name: 'Noah', pct: 10 },
    { day: IPO, name: 'Noah', pct: -10 },
    { day: d(6), name: 'Noah', pct: 25 }
  ]
  const m = buildMarket(ledger, IPO, IPO)
  assert.equal(m.live.Noah, 99)
  assert.equal(m.events.length, 2)
  assert.equal(buildMarket(ledger, IPO, d(6)).events.length, 3)
})

test('a filing dated before the IPO counts on opening day', () => {
  const m = buildMarket([{ day: '2026-07-01', name: 'Noah', pct: 5 }], IPO, IPO)
  assert.equal(m.events[0].day, IPO)
  assert.equal(m.live.Noah, 105)
})

test("today's change is measured from yesterday's close and includes today's filings", () => {
  const m = buildMarket([{ day: d(1), name: 'Noah', type: 'romance', pct: 8 }], IPO, d(1))
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

test('the price series runs IPO, closes, then the live point, and ranges slice it', () => {
  const m = buildMarket([], IPO, d(40))
  const s = priceSeries(m, 'Noah', d(40))
  assert.equal(s.length, 42)
  assert.equal(s[0].label, 'IPO')
  assert.equal(s[41].live, true)
  const week = sliceRange(s, d(40), 7)
  assert.equal(week.length, 9) // seven days back, plus the point before the window
  assert.equal(week[0].day, d(32))
  assert.equal(sliceRange(s, d(40), 0).length, 42)
  assert.equal(sliceRange(s, d(40), 365).length, 42)
})

test('the closing report covers filings, quiet weeks and quiet days', () => {
  const busy = buildMarket([{ day: IPO, name: 'Noah', type: 'romance', pct: 8, title: 'First kiss', by: 'Sam' }], IPO, d(1))
  const r = closingReport(busy, IPO)
  assert.equal(r.lines.length, 5)
  assert.match(r.headline, /NOAH led/)
  assert.match(r.lines[0].text, /First kiss/)
  assert.match(r.lines[1].text, /nothing to report/)
  const quiet = closingReport(buildMarket([], IPO, d(1)), IPO)
  assert.match(quiet.headline, /board held/)
  const week = closingReport(buildMarket([], IPO, d(8)), d(7))
  assert.match(week.headline, /Every listing marked a full quiet week/)
  assert.match(week.lines[0].text, /1 full week without a filing/)
  assert.equal(closingReport(busy, d(1)), null)
})

test('rankings, event list order and stats', () => {
  const m = buildMarket(
    [
      { day: IPO, name: 'Jonas', type: 'date', partner: 'Maya', pct: 6 },
      { day: d(1), name: 'James', type: 'romance', pct: -20, title: 'Got dumped' }
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

test('a withdrawal hides a report without moving anything', () => {
  const m = buildMarket([{ withdrawn: true, ref: 'sub-1', note: 'fake' }, { day: IPO, name: 'Noah', pct: 5 }], IPO, IPO)
  assert.deepEqual(m.withdrawn, ['sub-1'])
  assert.equal(m.events.length, 1)
  assert.equal(m.live.Noah, 105)
})

test('the Brindex opens at the IPO price and steps with each report', () => {
  const none = brindexSeries({}, IPO, d(3))
  assert.equal(none.length, 5) // IPO point, three closes, today
  assert.ok(none.every((p) => p.price === IPO_PRICE))
  // it lines up point for point with a listing's series, so the two share a chart
  const m = buildMarket([{ day: d(1), name: 'Noah', pct: 3 }], IPO, d(3))
  assert.deepEqual(none.map((p) => p.day), priceSeries(m, 'Noah', d(3)).map((p) => p.day))
  const reports = {
    r1: { day: d(2), ratings: { Noah: 10, Bryon: 10, Jonas: 10, Andrew: 10, James: 10 }, by: 'Britta', at: 'a' },
    r2: { day: d(9), ratings: { Noah: 5, Bryon: 5, Jonas: 5, Andrew: 5, James: 5 }, by: 'Britta', at: 'b' },
    r3: { day: d(16), ratings: { Noah: 0, Bryon: 0, Jonas: 0, Andrew: 0, James: 0 }, by: 'Britta', at: 'c' }
  }
  assert.equal(brindexMove(reports.r1.ratings), BRINDEX_SWING)
  assert.equal(brindexMove(reports.r2.ratings), 0)
  assert.equal(brindexMove(reports.r3.ratings), -BRINDEX_SWING)
  const s = brindexSeries(reports, IPO, d(20))
  const on = (k) => s.find((p) => p.day === d(k) && !p.label).price
  assert.equal(on(1), 100)
  assert.equal(on(2), 150) // the day of the first report: all 10s is +50%
  assert.equal(on(9), 150) // flat through the neutral report
  assert.equal(on(16), 75) // all 0s is -50%
  assert.equal(s[s.length - 1].live, true)
  assert.equal(brindexValue(reports, IPO, d(20)), 75)
  const ch = brindexChange(reports, IPO, d(20))
  assert.equal(ch.prev, 150)
  assert.equal(ch.pct, -50)
  assert.equal(ch.report.id, 'r3')
  // a partial report counts the ratings it has: an average of 8 is +30%
  assert.ok(Math.abs(brindexMove({ Noah: 8, Bryon: 8 }) - 0.3) < 1e-9)
  // a withdrawn report no longer moves the index
  const w = buildMarket([{ withdrawn: true, brindex: 'r3', note: 'a test' }], IPO, d(20))
  assert.deepEqual(w.brindexWithdrawn, ['r3'])
  assert.equal(brindexValue(withoutWithdrawn(reports, w.brindexWithdrawn), IPO, d(20)), 150)
})

test('rangeChange follows the chart window', () => {
  const m = buildMarket([{ day: d(1), name: 'Noah', pct: 10 }, { day: d(33), name: 'Noah', pct: 10 }], IPO, d(35))
  const series = priceSeries(m, 'Noah', d(35))
  const last = series[series.length - 1].price
  // all time: against the IPO price
  assert.equal(rangeChange(m, 'Noah', d(35), 0).pct, round2(((last - IPO_PRICE) / IPO_PRICE) * 100))
  // one week: against the close just before the window opens
  const base = series.find((p) => p.day === d(27) && !p.label).price
  assert.equal(rangeChange(m, 'Noah', d(35), 7).pct, round2(((last - base) / base) * 100))
  assert.equal(rangeChange(m, 'Noah', d(35), 7).abs, round2(last - base))
})
