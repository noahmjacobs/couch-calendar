// The 449 Exchange pricing engine.
//
// Everything in here is pure. The board is rebuilt from the ledger on every
// load: open everyone at the IPO price, then walk the calendar from the IPO to
// today, applying that day's filings and a small deterministic drift at each
// close. The same ledger therefore produces the same prices on every phone.

import { NAMES } from '../roommates.js'

/* ---------- listing ---------- */

export const IPO_PRICE = 100
export const SHARES = 10000 // shares outstanding per roommate, so $100 = a $1.0M market cap
export const FLOOR_PRICE = 1 // nobody goes to zero, however bad the week

export const TICKER = {
  Noah: 'NOAH',
  Bryon: 'BRYN',
  Jonas: 'JNAS',
  Andrew: 'ANDW',
  James: 'JAMS'
}
export const INDEX_NAME = 'BOYO 5'

// seeded day-to-day drift so the board ticks like a real one between filings
export const NOISE = 0.0075

/* ---------- material events: the standard impacts ---------- */

// the committee's published guide. A filing can carry its own `pct` when the
// facts call for more or less than the standard.
export const EVENT_TYPES = [
  { id: 'girlfriend', group: 'Romance', emoji: '💘', label: 'Got a girlfriend', pct: 15 },
  { id: 'first-kiss', group: 'Romance', emoji: '💋', label: 'First kiss', pct: 8 },
  { id: 'date', group: 'Romance', emoji: '🌹', label: 'Went on a date', pct: 4 },
  { id: 'number', group: 'Romance', emoji: '📱', label: 'Got a number', pct: 2 },
  { id: 'ghosted', group: 'Romance', emoji: '👻', label: 'Got ghosted', pct: -6 },
  { id: 'dumped', group: 'Romance', emoji: '💔', label: 'Got dumped', pct: -20 },
  { id: 'big-w', group: 'Life', emoji: '🏆', label: 'Big W (job, grade, promotion)', pct: 10 },
  { id: 'gym', group: 'Life', emoji: '💪', label: 'Gym PR or streak', pct: 2 },
  { id: 'hungover', group: 'Life', emoji: '🤢', label: 'Hungover past noon', pct: -3 },
  { id: 'big-l', group: 'Life', emoji: '🪦', label: 'Big L (fired, failed, totaled)', pct: -10 },
  { id: 'cooked', group: 'Apartment', emoji: '🍝', label: 'Cooked for the house', pct: 3 },
  { id: 'dishes', group: 'Apartment', emoji: '🧽', label: 'Did the dishes unprompted', pct: 2 },
  { id: 'couch-date', group: 'Apartment', emoji: '🛋️', label: 'Booked the couch for a date', pct: 3 },
  { id: 'mess', group: 'Apartment', emoji: '🗑️', label: 'Left a mess for days', pct: -3 },
  { id: 'durf', group: 'Apartment', emoji: '🚫', label: 'Durfed', pct: -5 },
  { id: 'other', group: 'Other', emoji: '📝', label: 'Committee ruling', pct: 0 }
]
export const EVENT_BY_ID = Object.fromEntries(EVENT_TYPES.map((e) => [e.id, e]))
export const PCT_LIMIT = 40 // no single filing moves a stock more than this

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

/* ---------- deterministic noise ---------- */

// FNV-1a, then mulberry32: the same day and name always give the same drift
const hashString = (s) => {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

const mulberry32 = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export const noiseFor = (day, name) => {
  const r = mulberry32(hashString(`${day}:${name}`))()
  return (r * 2 - 1) * NOISE
}

/* ---------- money ---------- */

export const round2 = (x) => Math.round(x * 100) / 100

export const fmtMoney = (x) =>
  '$' + Number(x).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const fmtPct = (p, digits = 2) => `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p).toFixed(digits)}%`

export const fmtSigned = (x) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${fmtMoney(Math.abs(x))}`

export const fmtCap = (x) => {
  if (x >= 1e9) return `$${(x / 1e9).toFixed(2)}B`
  if (x >= 1e6) return `$${(x / 1e6).toFixed(2)}M`
  if (x >= 1e3) return `$${(x / 1e3).toFixed(1)}K`
  return fmtMoney(x)
}

export const marketCap = (price) => price * SHARES

/* ---------- market record ---------- */

export const initialMarket = (ipo) => ({
  ipo,
  live: Object.fromEntries(NAMES.map((n) => [n, IPO_PRICE])),
  closes: {},
  events: []
})

export const closedDays = (market) => Object.keys(market.closes).sort()

// settle one day: apply the drift to every live price and record the close
export const closeDay = (market, day) => {
  if (market.closes[day]) return market
  const prices = {}
  const moves = {}
  NAMES.forEach((name) => {
    const from = market.live[name]
    const noisePct = noiseFor(day, name)
    const to = Math.max(FLOOR_PRICE, round2(from * (1 + noisePct)))
    // the day's change counts the filings applied earlier in the day too
    const open = market.closes[addDays(day, -1)] ? market.closes[addDays(day, -1)].prices[name] : IPO_PRICE
    prices[name] = to
    moves[name] = {
      open,
      to,
      pct: round2(((to - open) / open) * 100),
      noisePct: round2(noisePct * 100),
      filings: market.events.filter((e) => e.day === day && e.name === name).length
    }
  })
  return { ...market, live: prices, closes: { ...market.closes, [day]: { prices, moves } } }
}

export const clampPct = (p) => Math.max(-PCT_LIMIT, Math.min(PCT_LIMIT, Number(p) || 0))

// apply one ledger filing to the live price and record it
export const applyFiling = (market, filing, index) => {
  const { name, day } = filing
  if (!NAMES.includes(name)) return market
  const type = EVENT_BY_ID[filing.type] || EVENT_BY_ID.other
  const pct = clampPct(filing.pct != null ? filing.pct : type.pct)
  const before = market.live[name]
  const after = Math.max(FLOOR_PRICE, round2(before * (1 + pct / 100)))
  const event = {
    key: `${day}-${index}`,
    seq: index,
    day,
    name,
    type: type.id,
    emoji: filing.emoji || type.emoji,
    title: (filing.title && String(filing.title).trim()) || type.label,
    note: filing.note ? String(filing.note).trim() : '',
    verdict: filing.verdict ? String(filing.verdict).trim() : '',
    by: filing.by ? String(filing.by).trim() : '',
    pct,
    before,
    after
  }
  return { ...market, live: { ...market.live, [name]: after }, events: [...market.events, event] }
}

// rebuild the whole board from the ledger, up to and including `today`.
// `elapsed` is how much of today has passed (0..1): today's drift accrues
// through the day, so the board ticks live and lands exactly on the close.
export const buildMarket = (ledger, ipo, today, elapsed = 0) => {
  let m = initialMarket(ipo)
  const byDay = {}
  ledger.forEach((f, i) => {
    if (!f || !f.day || !f.name) return
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
  const frac = Math.max(0, Math.min(1, Number(elapsed) || 0))
  if (frac > 0) {
    const live = {}
    NAMES.forEach((name) => {
      live[name] = Math.max(FLOOR_PRICE, round2(m.live[name] * (1 + noiseFor(today, name) * frac)))
    })
    m = { ...m, live }
  }
  return m
}

// fraction of the local day that has passed
export const dayElapsed = (now = new Date()) => {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  return Math.max(0, Math.min(1, (now - start) / 86400000))
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
  flat: ['was little changed', 'held steady', 'traded flat', 'closed about where it opened'],
  down: ['slipped', 'eased', 'drifted lower', 'gave back ground'],
  drop: ['tumbled', 'sold off', 'plunged', 'got hammered']
}

const moveWord = (pct) => {
  if (pct >= 3) return 'surge'
  if (pct >= 0.5) return 'up'
  if (pct > -0.5) return 'flat'
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
  const top = names[0]
  const bottom = names[names.length - 1]
  const upCount = names.filter((n) => close.moves[n].pct > 0).length
  const tone = upCount >= 4 ? 'broadly higher' : upCount <= 1 ? 'broadly lower' : 'mixed'
  const weekday = fmtDay(day, { weekday: 'long' })

  const headline =
    filings.length === 0
      ? `Quiet ${weekday} session: no filings crossed the desk, so the board drifted on market noise alone.`
      : `The board closed ${tone} on ${weekday} with ${filings.length} ${filings.length === 1 ? 'filing' : 'filings'}. ${TICKER[top]} led at ${fmtPct(close.moves[top].pct)}; ${TICKER[bottom]} brought up the rear at ${fmtPct(close.moves[bottom].pct)}.`

  const lines = names.map((name) => {
    const mv = close.moves[name]
    const verb = pick(verbs[moveWord(mv.pct)], `${day}:${name}:verb`)
    const own = filings.filter((e) => e.name === name)
    let text = `${TICKER[name]} ${verb} ${fmtPct(mv.pct)} to ${fmtMoney(mv.to)}`
    if (own.length === 1) text += ` on the “${own[0].title}” filing (${fmtPct(own[0].pct)}).`
    else if (own.length > 1) text += ` on ${own.length} filings: ${own.map((e) => `${e.title} (${fmtPct(e.pct)})`).join(', ')}.`
    else text += ' in quiet trading.'
    return { name, text, pct: mv.pct }
  })

  return { day, headline, lines, filings }
}
