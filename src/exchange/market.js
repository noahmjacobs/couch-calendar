// The 449 Exchange pricing engine.
//
// Everything in here is pure. The board is rebuilt from the ledger on every
// load: open everyone at the IPO price, then walk the calendar from the IPO to
// today, applying that day's filings and, at each close, the depreciation a
// listing earns by going quiet. The same ledger therefore produces the same
// prices on every phone.

import { NAMES } from '../roommates.js'

/* ---------- listing ---------- */

export const IPO_PRICE = 100
export const FLOOR_PRICE = 1 // nobody goes to zero, however bad the week

export const TICKER = {
  Noah: 'NOAH',
  Bryon: 'BRYN',
  Jonas: 'JNAS',
  Andrew: 'ANDW',
  James: 'JAMS'
}
export const INDEX_NAME = 'BOYO 5'

// nothing happens, nothing moves. But a listing that goes a week without a
// filing starts to depreciate, a little each day, for a while, then levels off
export const IDLE_GRACE_DAYS = 7
export const IDLE_DECAY = 0.004 // −0.4% a day
export const IDLE_SPAN_DAYS = 25 // about −10% in all, then flat until something happens

// the dating ladder. A date's impact is worked out from the record: who it was
// with, how long since the last one, and whether anyone else was in the picture
export const DATING = {
  first: 10, // a first date, nobody else in the last week
  juggling: 5, // a first date with someone new within a week of a date with someone else
  second: 15, // second date with the same person inside the momentum window
  third: 18,
  steady: 20, // fourth date and beyond
  rekindled: 10, // a repeat date after the momentum window has lapsed
  jugglingWindow: 7, // days
  momentumWindow: 14 // days
}

/* ---------- material events: the standard impacts ---------- */

// the committee's private baseline. Nothing here is shown in the app; every
// filing carries the committee's own `pct`, and these are the defaults it
// starts from when it has no reason to depart.
export const EVENT_TYPES = [
  { id: 'date', group: 'Romance', emoji: '🌹', label: 'Went on a date', pct: null, auto: true, range: '+5 to +20' },
  { id: 'girlfriend', group: 'Romance', emoji: '💘', label: 'Made it official', pct: 25 },
  { id: 'first-kiss', group: 'Romance', emoji: '💋', label: 'First kiss', pct: 8 },
  { id: 'number', group: 'Romance', emoji: '📱', label: 'Got a number', pct: 2 },
  { id: 'ghosted', group: 'Romance', emoji: '👻', label: 'Got ghosted', pct: -6 },
  { id: 'dumped', group: 'Romance', emoji: '💔', label: 'Got dumped', pct: -20 },
  { id: 'big-w', group: 'Life', emoji: '🏆', label: 'Big W (job, grade, promotion)', pct: 10 },
  { id: 'gym', group: 'Life', emoji: '💪', label: 'Gym PR or streak', pct: 2 },
  { id: 'hungover', group: 'Life', emoji: '🤢', label: 'Hungover past noon', pct: -3 },
  { id: 'big-l', group: 'Life', emoji: '🪦', label: 'Big L (fired, failed, totaled)', pct: -10 },
  { id: 'cooked', group: 'Apartment', emoji: '🍝', label: 'Cooked for the house', pct: 3 },
  { id: 'dishes', group: 'Apartment', emoji: '🧽', label: 'Did the dishes unprompted', pct: 2 },
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
  lastFiling: Object.fromEntries(NAMES.map((n) => [n, ipo]))
})

export const closedDays = (market) => Object.keys(market.closes).sort()

// days since the listing's last filing (or the IPO), as of `day`
export const idleDays = (market, name, day) => daysBetween(market.lastFiling[name] || market.ipo, day)

// the depreciation a listing earns at this close, as a fraction (0 or negative)
export const decayFor = (market, name, day) => {
  const idle = idleDays(market, name, day)
  return idle >= IDLE_GRACE_DAYS && idle < IDLE_GRACE_DAYS + IDLE_SPAN_DAYS ? -IDLE_DECAY : 0
}

// settle one day: apply any depreciation and record the close
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

/* ---------- the dating ladder ---------- */

const partnerKey = (p) => String(p || '').trim().toLowerCase()

// rule on a date from the record of this listing's earlier dates
export const dateRuling = (previousDates, day, partner) => {
  const who = (partner && String(partner).trim()) || 'someone new'
  const key = partnerKey(partner)
  const same = key ? previousDates.filter((d) => d.partnerKey === key) : []
  if (same.length) {
    const last = same[same.length - 1]
    const gap = daysBetween(last.day, day)
    const n = same.length + 1
    const nth = n === 2 ? 'Second' : n === 3 ? 'Third' : `${n}th`
    if (gap > DATING.momentumWindow)
      return { pct: DATING.rekindled, why: `${nth} date with ${who}, but ${gap} days after the last one. Rekindled, not momentum.` }
    const pct = n === 2 ? DATING.second : n === 3 ? DATING.third : DATING.steady
    return { pct, why: `${nth} date with ${who}, ${gap} ${gap === 1 ? 'day' : 'days'} after the last. Momentum.` }
  }
  const others = previousDates.filter((d) => d.partnerKey !== key || !key)
  const recent = others.filter((d) => daysBetween(d.day, day) < DATING.jugglingWindow)
  if (recent.length) {
    const last = recent[recent.length - 1]
    const gap = daysBetween(last.day, day)
    return {
      pct: DATING.juggling,
      why: `First date with ${who} only ${gap} ${gap === 1 ? 'day' : 'days'} after a date with ${last.partner || 'someone else'}. Juggling: half credit.`
    }
  }
  const last = previousDates[previousDates.length - 1]
  if (!last) return { pct: DATING.first, why: `First date on record, with ${who}.` }
  const gap = daysBetween(last.day, day)
  return { pct: DATING.first, why: `First date with ${who}, ${gap} days since the last date. Full credit.` }
}

export const clampPct = (p) => Math.max(-PCT_LIMIT, Math.min(PCT_LIMIT, Number(p) || 0))

// apply one ledger filing to the live price and record it
export const applyFiling = (market, filing, index) => {
  const { name, day } = filing
  if (!NAMES.includes(name)) return market
  const type = EVENT_BY_ID[filing.type] || EVENT_BY_ID.other
  let pct
  let auto = ''
  if (filing.pct != null) pct = clampPct(filing.pct)
  else if (type.id === 'date') {
    const previous = market.events.filter((e) => e.name === name && e.type === 'date')
    const ruling = dateRuling(previous, day, filing.partner)
    pct = ruling.pct
    auto = ruling.why
  } else pct = clampPct(type.pct || 0)
  const before = market.live[name]
  const after = Math.max(FLOOR_PRICE, round2(before * (1 + pct / 100)))
  const partner = filing.partner ? String(filing.partner).trim() : ''
  const event = {
    key: `${day}-${index}`,
    seq: index,
    day,
    name,
    type: type.id,
    emoji: filing.emoji || type.emoji,
    title:
      (filing.title && String(filing.title).trim()) || (type.id === 'date' && partner ? `Date with ${partner}` : type.label),
    partner,
    partnerKey: partnerKey(partner),
    note: filing.note ? String(filing.note).trim() : '',
    verdict: filing.verdict ? String(filing.verdict).trim() : '',
    auto,
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
    headline = `Quiet ${weekday} session: nothing crossed the desk. ${movers.length === NAMES.length ? 'Every listing' : movers.length === 1 ? `${TICKER[movers[0]]} alone` : `${movers.length} listings`} depreciated for want of news.`
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
      text = `${TICKER[name]} slipped ${fmtPct(mv.pct)} to ${fmtMoney(mv.to)}: ${mv.idle} days without a filing, so depreciation applies.`
    } else if (mv.idle >= IDLE_GRACE_DAYS + IDLE_SPAN_DAYS) {
      text = `${TICKER[name]} held at ${fmtMoney(mv.to)}, fully depreciated after ${mv.idle} quiet days.`
    } else text = `${TICKER[name]} held at ${fmtMoney(mv.to)} with nothing to report.`
    return { name, text, pct: mv.pct }
  })

  return { day, headline, lines, filings }
}
