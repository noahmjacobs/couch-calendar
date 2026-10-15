// The 449 Exchange pricing engine.
//
// Everything in here is pure. The board is rebuilt from the ledger on every
// load: open everyone at the IPO price, then walk the calendar from the IPO to
// today, applying that day's filings and, at each close, the small step down a
// listing earns by going quiet for a full week. The same ledger therefore
// produces the same prices on every phone.
//
// The engine decides nothing about what an event is worth. Every filing in the
// ledger carries the percentage the pricing committee ruled, after weighing the
// roommate's history and how expected the event was.

import { NAMES } from '../roommates.js'

/* ---------- listing ---------- */

export const IPO_PRICE = 100
export const FLOOR_PRICE = 1 // nobody goes to zero, however bad the month

export const TICKER = {
  Noah: 'NOAH',
  Bryon: 'BRYN',
  Jonas: 'JNAS',
  Andrew: 'ANDW',
  James: 'JAMS'
}
export const INDEX_NAME = 'BOYO 5'

// nothing happens, nothing moves. A listing that goes a full week without a
// filing steps down a little at the close of that seventh day, again a week
// later, and so on, up to a cap; then it holds until something happens.
export const IDLE_WEEK_DAYS = 7
export const IDLE_WEEKLY_DECAY = 0.02 // −2% per full quiet week
export const IDLE_MAX_WEEKS = 4

export const PCT_LIMIT = 40 // no single filing moves a listing more than this

/* ---------- the Brindex ---------- */

// Britta's weekly read on the household: one rating per roommate, 0 to 10.
// The index opens at the IPO price and moves with each report: the average
// rating above the midpoint pushes it up, below pulls it down, at most
// BRINDEX_STEP per report. Nothing moves it between reports.
export const BRINDEX_NAME = 'Brindex'
export const BRINDEX_MAX = 10
export const BRINDEX_STEP = 0.1

export const brindexReports = (raw) =>
  Object.entries(raw || {})
    .map(([id, r]) => ({ ...r, id }))
    .filter((r) => r && r.ratings && typeof r.ratings === 'object' && r.day)
    .sort((a, b) => a.day.localeCompare(b.day) || (a.at || '').localeCompare(b.at || ''))

export const brindexAverage = (ratings) => {
  const vals = NAMES.map((n) => Number(ratings[n])).filter((v) => Number.isFinite(v))
  if (!vals.length) return BRINDEX_MAX / 2
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

export const brindexMove = (ratings) => ((brindexAverage(ratings) - BRINDEX_MAX / 2) / (BRINDEX_MAX / 2)) * BRINDEX_STEP

// one point per trading day, aligned with the price series: the value holds
// between reports and steps on the day a report comes in
// same shape as priceSeries so both can share a chart: an IPO point, one close
// per day, then today's live value. A report counts from the day it was sent.
export const brindexSeries = (reports, ipo, today) => {
  const sorted = brindexReports(reports)
  const pts = [{ day: ipo, price: IPO_PRICE, label: 'IPO' }]
  let value = IPO_PRICE
  let i = 0
  let day = ipo
  while (day <= today) {
    while (i < sorted.length && (sorted[i].day < ipo ? ipo : sorted[i].day) <= day) {
      value = Math.max(FLOOR_PRICE, round2(value * (1 + brindexMove(sorted[i].ratings))))
      i++
    }
    pts.push(day < today ? { day, price: value } : { day, price: value, live: true })
    day = addDays(day, 1)
  }
  return pts
}

export const brindexValue = (reports, ipo, today) => {
  const s = brindexSeries(reports, ipo, today)
  return s[s.length - 1].price
}

// the move the latest report made, against the value before it
export const brindexChange = (reports, ipo, today) => {
  const sorted = brindexReports(reports)
  const now = brindexValue(reports, ipo, today)
  if (!sorted.length) return { abs: 0, pct: 0, prev: now, now, report: null }
  const last = sorted[sorted.length - 1]
  const before = brindexValue(sorted.slice(0, -1), ipo, today)
  return { abs: round2(now - before), pct: before ? round2(((now - before) / before) * 100) : 0, prev: before, now, report: last }
}

/* ---------- categories: flavour only ---------- */

export const CATEGORIES = [
  { id: 'date', emoji: '🌹', label: 'Date' },
  { id: 'romance', emoji: '💘', label: 'Romance' },
  { id: 'life', emoji: '🏆', label: 'Life' },
  { id: 'social', emoji: '🎲', label: 'Social' },
  { id: 'apartment', emoji: '🧽', label: 'Apartment' },
  { id: 'other', emoji: '📝', label: 'Other' }
]
export const CATEGORY = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]))

/* ---------- dates ---------- */

const mod = (n, m) => ((n % m) + m) % m

export const dateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const parseDay = (key) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const addDays = (key, n) => {
  const d = parseDay(key)
  d.setDate(d.getDate() + n)
  return dateKey(d)
}

// whole days between two keys, immune to DST because both sit at local midnight
export const daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 86400000)

export const fmtDay = (key, opts = { month: 'short', day: 'numeric' }) =>
  parseDay(key).toLocaleDateString('en-US', opts)

/* ---------- hashing (for the report's turn of phrase) ---------- */

const hashString = (str) => {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/* ---------- money ---------- */

export const round2 = (x) => Math.round(x * 100) / 100

export const fmtMoney = (x) =>
  '$' + Number(x).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const fmtPct = (p, digits = 2) => `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p).toFixed(digits)}%`

export const fmtSigned = (x) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${fmtMoney(Math.abs(x))}`

/* ---------- market record ---------- */

export const initialMarket = (ipo) => ({
  ipo,
  live: Object.fromEntries(NAMES.map((n) => [n, IPO_PRICE])),
  closes: {},
  events: [],
  // the last day each listing had a filing; the idle clock runs from here
  lastFiling: Object.fromEntries(NAMES.map((n) => [n, ipo])),
  // submission ids the committee withdrew: hidden in the app, never ruled on
  withdrawn: []
})

export const closedDays = (market) => Object.keys(market.closes).sort()

// days since the listing's last filing (or the IPO), as of `day`
export const idleDays = (market, name, day) => daysBetween(market.lastFiling[name] || market.ipo, day)

// the step down a listing earns at this close, as a fraction (0 or negative):
// one step at the end of each full quiet week, up to the cap
export const decayFor = (market, name, day) => {
  const idle = idleDays(market, name, day)
  if (idle <= 0 || idle % IDLE_WEEK_DAYS !== 0) return 0
  return idle / IDLE_WEEK_DAYS <= IDLE_MAX_WEEKS ? -IDLE_WEEKLY_DECAY : 0
}

// settle one day: apply any step down and record the close
export const closeDay = (market, day) => {
  if (market.closes[day]) return market
  const prices = {}
  const moves = {}
  NAMES.forEach((name) => {
    const from = market.live[name]
    const decay = decayFor(market, name, day)
    const to = Math.max(FLOOR_PRICE, round2(from * (1 + decay)))
    // the day's change counts the filings applied earlier in the day too
    const open = market.closes[addDays(day, -1)] ? market.closes[addDays(day, -1)].prices[name] : IPO_PRICE
    prices[name] = to
    moves[name] = {
      open,
      to,
      pct: round2(((to - open) / open) * 100),
      decayPct: round2(decay * 100),
      idle: idleDays(market, name, day),
      filings: market.events.filter((e) => e.day === day && e.name === name).length
    }
  })
  return { ...market, live: prices, closes: { ...market.closes, [day]: { prices, moves } } }
}

export const clampPct = (p) => Math.max(-PCT_LIMIT, Math.min(PCT_LIMIT, Number(p) || 0))

// apply one ledger filing to the live price and record it. The percentage is
// the committee's ruling; a filing without one changes nothing but is logged.
export const applyFiling = (market, filing, index) => {
  const { name, day } = filing
  if (!NAMES.includes(name)) return market
  const category = CATEGORY[filing.type] || CATEGORY.other
  const pct = clampPct(filing.pct)
  const before = market.live[name]
  const after = Math.max(FLOOR_PRICE, round2(before * (1 + pct / 100)))
  const partner = filing.partner ? String(filing.partner).trim() : ''
  const event = {
    key: `${day}-${index}`,
    seq: index,
    day,
    name,
    type: category.id,
    emoji: filing.emoji || category.emoji,
    title: (filing.title && String(filing.title).trim()) || (category.id === 'date' && partner ? `Date with ${partner}` : category.label),
    partner,
    note: filing.note ? String(filing.note).trim() : '',
    verdict: filing.verdict ? String(filing.verdict).trim() : '',
    by: filing.by ? String(filing.by).trim() : '',
    ref: filing.ref || '',
    pct,
    before,
    after
  }
  return {
    ...market,
    live: { ...market.live, [name]: after },
    events: [...market.events, event],
    lastFiling: { ...market.lastFiling, [name]: day > (market.lastFiling[name] || '') ? day : market.lastFiling[name] }
  }
}

// rebuild the whole board from the ledger, up to and including `today`
export const buildMarket = (ledger, ipo, today) => {
  let m = initialMarket(ipo)
  const byDay = {}
  ledger.forEach((f, i) => {
    if (!f) return
    // a withdrawal names a submission and nothing else: no price, no filing
    if (f.withdrawn) {
      if (f.ref) m = { ...m, withdrawn: [...m.withdrawn, f.ref] }
      return
    }
    if (!f.day || !f.name) return
    // a filing dated before the IPO counts on opening day
    const day = f.day < ipo ? ipo : f.day
    ;(byDay[day] = byDay[day] || []).push({ ...f, day, index: i })
  })
  let day = ipo
  while (day <= today) {
    ;(byDay[day] || []).forEach((f) => {
      m = applyFiling(m, f, f.index)
    })
    if (day < today) m = closeDay(m, day)
    day = addDays(day, 1)
  }
  // filings dated in the future are not on the board yet
  return m
}

export const eventList = (market) => [...market.events].sort((a, b) => b.day.localeCompare(a.day) || b.seq - a.seq)

/* ---------- series & stats for the charts ---------- */

// one point per trading day: the IPO open, every close, then today's live price
export const priceSeries = (market, name, today) => {
  const pts = [{ day: market.ipo, price: IPO_PRICE, label: 'IPO' }]
  closedDays(market).forEach((day) => pts.push({ day, price: market.closes[day].prices[name] }))
  pts.push({ day: today, price: market.live[name], live: true })
  return pts
}

const avgOf = (prices) => round2(NAMES.reduce((s, n) => s + prices[n], 0) / NAMES.length)

export const indexSeries = (market, today) => {
  const pts = [{ day: market.ipo, price: IPO_PRICE, label: 'IPO' }]
  closedDays(market).forEach((day) => pts.push({ day, price: avgOf(market.closes[day].prices) }))
  pts.push({ day: today, price: avgOf(market.live), live: true })
  return pts
}

export const indexValue = (market) => avgOf(market.live)

// the last `days` days of a series, keeping the point just before the window
// so a line always has somewhere to start. 0 means everything.
export const sliceRange = (points, today, days) => {
  if (!days) return points
  const from = addDays(today, -days)
  const i = points.findIndex((p) => p.day >= from)
  if (i <= 0) return points
  return points.slice(i - 1)
}

export const RANGES = [
  { id: '1w', label: '1W', days: 7 },
  { id: '1m', label: '1M', days: 30 },
  { id: '1y', label: '1Y', days: 365 },
  { id: 'all', label: 'All', days: 0 }
]

// the reference price for "today's change": yesterday's close, else the IPO price
export const previousClose = (market, name, today) => {
  const days = closedDays(market).filter((d) => d < today)
  if (!days.length) return IPO_PRICE
  return market.closes[days[days.length - 1]].prices[name]
}

const change = (prev, now) => ({
  abs: round2(now - prev),
  pct: prev ? round2(((now - prev) / prev) * 100) : 0,
  prev,
  now
})

export const dayChange = (market, name, today) => change(previousClose(market, name, today), market.live[name])

export const indexChange = (market, today) => {
  const days = closedDays(market).filter((d) => d < today)
  const prev = days.length ? avgOf(market.closes[days[days.length - 1]].prices) : IPO_PRICE
  return change(prev, indexValue(market))
}

export const rankings = (market) => [...NAMES].sort((a, b) => market.live[b] - market.live[a] || a.localeCompare(b))

export const tickerStats = (market, name, today) => {
  const series = priceSeries(market, name, today)
  const prices = series.map((p) => p.price)
  const filings = market.events.filter((e) => e.name === name)
  return {
    high: Math.max(...prices),
    low: Math.min(...prices),
    sinceIpoPct: round2(((prices[prices.length - 1] - IPO_PRICE) / IPO_PRICE) * 100),
    filings: filings.length,
    daysListed: Math.max(1, daysBetween(market.ipo, today) + 1)
  }
}

/* ---------- the desk's closing report ---------- */

const pick = (arr, seed) => arr[mod(hashString(seed), arr.length)]

const verbs = {
  surge: ['surged', 'ripped', 'rallied hard', 'soared'],
  up: ['climbed', 'gained', 'edged higher', 'advanced'],
  down: ['slipped', 'eased', 'drifted lower', 'gave back ground'],
  drop: ['tumbled', 'sold off', 'plunged', 'got hammered']
}

const moveWord = (pct) => {
  if (pct >= 3) return 'surge'
  if (pct > 0) return 'up'
  if (pct > -3) return 'down'
  return 'drop'
}

// a closing report for one settled day, written from the numbers and the
// filings. Deterministic for a given day so everyone reads the same report.
export const closingReport = (market, day) => {
  const close = market.closes[day]
  if (!close) return null
  const filings = market.events.filter((e) => e.day === day)
  const names = [...NAMES].sort((a, b) => close.moves[b].pct - close.moves[a].pct)
  const movers = names.filter((n) => close.moves[n].pct !== 0)
  const weekday = fmtDay(day, { weekday: 'long' })

  let headline
  if (filings.length) {
    const top = names[0]
    const bottom = names[names.length - 1]
    const upCount = names.filter((n) => close.moves[n].pct > 0).length
    const tone = upCount >= 4 ? 'broadly higher' : upCount <= 1 ? 'broadly lower' : 'mixed'
    headline = `The board closed ${tone} on ${weekday} with ${filings.length} ${filings.length === 1 ? 'filing' : 'filings'}. ${TICKER[top]} led at ${fmtPct(close.moves[top].pct)}; ${TICKER[bottom]} brought up the rear at ${fmtPct(close.moves[bottom].pct)}.`
  } else if (movers.length) {
    headline = `Quiet ${weekday} session: nothing crossed the desk. ${movers.length === NAMES.length ? 'Every listing' : movers.length === 1 ? `${TICKER[movers[0]]} alone` : `${movers.length} listings`} marked a full quiet week with a step down.`
  } else headline = `Quiet ${weekday} session: nothing crossed the desk and the board held.`

  const lines = names.map((name) => {
    const mv = close.moves[name]
    const own = filings.filter((e) => e.name === name)
    let text
    if (own.length) {
      const verb = pick(verbs[moveWord(mv.pct)], `${day}:${name}:verb`)
      text = `${TICKER[name]} ${verb} ${fmtPct(mv.pct)} to ${fmtMoney(mv.to)}`
      if (own.length === 1) text += ` on the “${own[0].title}” filing (${fmtPct(own[0].pct)}).`
      else text += ` on ${own.length} filings: ${own.map((e) => `${e.title} (${fmtPct(e.pct)})`).join(', ')}.`
    } else if (mv.decayPct < 0) {
      text = `${TICKER[name]} slipped ${fmtPct(mv.pct)} to ${fmtMoney(mv.to)}: ${mv.idle / IDLE_WEEK_DAYS} ${mv.idle === IDLE_WEEK_DAYS ? 'full week' : 'full weeks'} without a filing.`
    } else if (mv.idle >= IDLE_WEEK_DAYS * IDLE_MAX_WEEKS) {
      text = `${TICKER[name]} held at ${fmtMoney(mv.to)}, ${mv.idle} days quiet and fully marked down.`
    } else text = `${TICKER[name]} held at ${fmtMoney(mv.to)} with nothing to report.`
    return { name, text, pct: mv.pct }
  })

  return { day, headline, lines, filings }
}
