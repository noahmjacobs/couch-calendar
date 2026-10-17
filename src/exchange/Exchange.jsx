import { useState, useEffect, useMemo, useRef } from 'react'
import { db, auth } from '../firebase'
import { ref, onValue, push, remove, set, get, update } from 'firebase/database'
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut } from 'firebase/auth'
import { ROOMMATES, NAMES, COLOR, INK } from '../roommates.js'
import { PhotoContext, Avatar, Chevron, Splash, useAppHeight, squarePhoto, describeAuthError, load, save } from '../shared.jsx'
import Calendar, { countRequests } from '../calendar/Calendar.jsx'
import { IPO, LEDGER } from './ledger.js'
import {
  TICKER,
  INDEX_NAME,
  IPO_PRICE,
  CATEGORIES,
  CATEGORY,
  RANGES,
  dateKey,
  addDays,
  fmtDay,
  fmtMoney,
  fmtPct,
  fmtSigned,
  buildMarket,
  priceSeries,
  indexSeries,
  indexChange,
  dayChange,
  rankings,
  eventList,
  tickerStats,
  rangeChange,
  closedDays,
  closingReport,
  sliceRange,
  brindexSeries,
  brindexChange,
  brindexReports,
  brindexAverage,
  BRINDEX_NAME,
  BRINDEX_MAX,
  withoutWithdrawn
} from './market.js'
import { Sparkline, PriceChart, MultiChart } from './charts.jsx'

// the household's reviewer: the Google account that claimed this roommate in
// the Couch App. The committee (Claude) rules on what the reviewer approves.
const REVIEWER = 'Noah'


/* ---------- demo data (?demo in the URL; add &outsider for the public view) ---------- */

const PARAMS = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams()
const DEMO = PARAMS.has('demo')
const OUTSIDER = PARAMS.has('outsider')

const demoData = (today) => {
  const ipo = addDays(today, -40)
  const d = (n) => addDays(ipo, n)
  const ledger = [
    { day: d(7), name: 'Jonas', type: 'date', partner: 'Maya', pct: 9, note: 'Dinner downtown. Home by eleven.', verdict: 'First date on record after a quiet month. The market likes a fresh start.', by: 'Noah' },
    { day: d(10), name: 'Jonas', type: 'date', partner: 'Maya', pct: 12, note: 'Second dinner. Same restaurant, which the committee notes.', verdict: 'A second date inside a week is momentum, and the market pays for momentum.', by: 'Andrew' },
    { day: d(12), name: 'Andrew', type: 'life', pct: 10, title: 'Offer letter signed', note: 'Full-time, starts in January.', verdict: 'Material and unexpected. Full credit.', by: 'Noah' },
    { day: d(15), name: 'Jonas', type: 'date', partner: 'Maya', pct: 8, note: 'Hike. She brought snacks.', verdict: 'Third date in two weeks. Priced in by now, but still a step up.', by: 'Noah' },
    { day: d(16), name: 'Bryon', type: 'date', partner: 'Sam', pct: 9, note: 'Coffee that turned into dinner.', verdict: 'First date in the record. Strong open.', by: 'James' },
    { day: d(19), name: 'Bryon', type: 'date', partner: 'Lena', pct: 3, note: 'From the app. Bowling.', verdict: 'Three days after Sam. The market is unsure what it is looking at.', by: 'James' },
    { day: d(20), name: 'James', type: 'life', pct: -3, title: 'Hungover past noon', note: 'Emerged at 1:40 PM asking for Gatorade.', verdict: 'A Tuesday, which is the part the committee minds.', by: 'Bryon' },
    { day: d(22), name: 'Jonas', type: 'romance', pct: 14, title: 'Made it official', note: 'Instagram-official as of this evening.', verdict: 'Expected after three dates, so not the full jump a surprise would earn. Still the biggest print of the quarter.', by: 'Noah' },
    { day: d(24), name: 'Noah', type: 'social', pct: 2, title: 'Game night', note: 'Everyone. Catan. Noah hosted.', verdict: 'A little for everyone; a little more for the host.', by: 'Jonas' },
    { day: d(24), name: 'Bryon', type: 'social', pct: 1, title: 'Game night', note: 'Everyone. Catan.', verdict: 'A little for everyone.', by: 'Jonas' },
    { day: d(24), name: 'Jonas', type: 'social', pct: 1, title: 'Game night', note: 'Everyone. Catan.', verdict: 'A little for everyone.', by: 'Jonas' },
    { day: d(24), name: 'Andrew', type: 'social', pct: 1, title: 'Game night', note: 'Everyone. Catan.', verdict: 'A little for everyone.', by: 'Jonas' },
    { day: d(24), name: 'James', type: 'social', pct: 1, title: 'Game night', note: 'Everyone. Catan. James won.', verdict: 'A little for everyone; the win is noted.', by: 'Jonas' },
    { day: d(28), name: 'Andrew', type: 'apartment', pct: -3, title: 'Left a mess for days', note: 'Three days of mugs on the coffee table.', verdict: 'Repeat behaviour. The market has seen this before.', by: 'Jonas' },
    { day: d(31), name: 'Noah', type: 'apartment', pct: 3, title: 'Cooked for the house', note: 'Chicken parm for five. Leftovers for none.', verdict: 'Rare enough to count.', by: 'Bryon' },
    { day: d(37), name: 'James', type: 'romance', pct: -5, title: 'Got ghosted', note: 'Last message delivered, unread, six days.', verdict: 'Not his first. The market had partly priced it in.', by: 'Andrew' },
    { day: d(39), name: 'Noah', type: 'date', partner: 'Priya', pct: 10, note: 'Museum, then tacos.', verdict: 'First date after a long quiet spell. Full credit.', by: 'Jonas', ref: 'demo-s4' }
  ]
  const submissions = {
    'demo-s1': { names: ['James'], name: 'James', category: 'apartment', text: 'Did every dish in the sink without being asked.', day: today, by: 'Bryon', at: `${today}T18:20:00.000Z` },
    'demo-s2': { names: ['Andrew'], name: 'Andrew', category: 'romance', text: 'Got a number at the farmers market. Unprompted.', day: addDays(today, -1), by: 'Noah', at: `${addDays(today, -1)}T21:02:00.000Z` },
    'demo-s3': { names: ['Noah'], name: 'Noah', category: 'other', text: 'Noah is simply the best roommate and deserves +40%.', day: addDays(today, -3), by: 'Anonymous', at: `${addDays(today, -3)}T23:40:00.000Z` },
    'demo-s4': { names: ['Noah'], name: 'Noah', category: 'date', partner: 'Priya', text: 'Museum, then tacos.', day: d(39), by: 'Jonas', at: `${d(39)}T22:10:00.000Z` },
    'demo-s5': { names: NAMES, name: 'Noah', category: 'social', text: 'All five went to trivia at the bar. Came third.', day: addDays(today, -1), by: 'Couch App', at: `${addDays(today, -1)}T23:00:00.000Z`, source: 'couch' }
  }
  const brindex = {
    b1: { day: d(5), ratings: { Noah: 6, Bryon: 5, Jonas: 7, Andrew: 6, James: 4 }, comment: 'Solid week. James needs to text people back.', by: 'Britta', at: `${d(5)}T19:00:00.000Z` },
    b2: { day: d(12), ratings: { Noah: 7, Bryon: 4, Jonas: 9, Andrew: 7, James: 5 }, comment: 'Jonas is glowing. Bryon, where are you.', by: 'Britta', at: `${d(12)}T19:00:00.000Z` },
    b3: { day: d(26), ratings: { Noah: 8, Bryon: 6, Jonas: 8, Andrew: 5, James: 7 }, comment: 'Game night redeemed everyone.', by: 'Britta', at: `${d(26)}T19:00:00.000Z` },
    b4: { day: d(33), ratings: { Noah: 7, Bryon: 6, Jonas: 7, Andrew: 4, James: 6 }, comment: 'Andrew left the mugs again.', by: 'Britta', at: `${d(33)}T19:00:00.000Z` }
  }
  return { ipo, ledger, submissions, brindex }
}

/* ---------- small hooks ---------- */

const parseHash = () => {
  const raw = location.hash.replace(/^#\/?/, '')
  const [page, ...rest] = raw.split('/')
  return { page: page || 'market', arg: decodeURIComponent(rest.join('/') || '') }
}

const useRoute = () => {
  const [route, setRoute] = useState(parseHash)
  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const go = (path) => {
    location.hash = path ? `/${path}` : '/'
  }
  return [route, go]
}

// the local calendar day, re-checked so a phone left open rolls over at midnight
const useToday = () => {
  const [today, setToday] = useState(() => dateKey(new Date()))
  useEffect(() => {
    const tick = () => setToday((t) => (dateKey(new Date()) === t ? t : dateKey(new Date())))
    const id = setInterval(tick, 30000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])
  return today
}

const useMinute = () => {
  const [n, setN] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setN((k) => k + 1), 30000)
    return () => clearInterval(id)
  }, [])
  return n
}

const minutesToClose = () => {
  const now = new Date()
  const end = new Date(now)
  end.setHours(24, 0, 0, 0)
  return Math.max(0, Math.round((end - now) / 60000))
}

// which listings and which range a chart shows, remembered on this phone
const useChartView = (key) => {
  const [picked, setPicked] = useState(() => {
    try {
      const v = JSON.parse(load(`exchange.view.${key}.picked`, 'null'))
      return Array.isArray(v) && v.every((n) => NAMES.includes(n)) && v.length ? v : NAMES
    } catch {
      return NAMES
    }
  })
  const [range, setRange] = useState(() => (RANGES.some((r) => r.id === load(`exchange.view.${key}.range`, '')) ? load(`exchange.view.${key}.range`, 'all') : 'all'))
  const [indexes, setIndexes] = useState(() => {
    try {
      const v = JSON.parse(load(`exchange.view.${key}.indexes`, '[]'))
      return Array.isArray(v) ? v.filter((x) => INDEXES.some((ix) => ix.id === x)) : []
    } catch {
      return []
    }
  })
  useEffect(() => save(`exchange.view.${key}.picked`, JSON.stringify(picked)), [key, picked])
  useEffect(() => save(`exchange.view.${key}.range`, range), [key, range])
  useEffect(() => save(`exchange.view.${key}.indexes`, JSON.stringify(indexes)), [key, indexes])
  const toggleIndex = (id) => setIndexes((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const toggle = (name) =>
    setPicked((p) => {
      if (p.length === NAMES.length) return [name] // from "all", tapping one isolates it
      if (p.includes(name)) return p.length === 1 ? NAMES : p.filter((n) => n !== name)
      return NAMES.filter((n) => p.includes(n) || n === name)
    })
  return { picked, toggle, all: () => setPicked(NAMES), range, setRange, indexes, toggleIndex }
}

// the two indexes a chart can carry alongside the listings
const INDEXES = [
  { id: 'boyo', label: INDEX_NAME, color: 'var(--c-boyo)' },
  { id: 'brindex', label: BRINDEX_NAME, color: 'var(--c-brindex)' }
]

/* ---------- pieces ---------- */

const Delta = ({ pct, abs, big }) => {
  const dir = pct > 0 ? 'up' : pct < 0 ? 'down' : ''
  return (
    <span className={`delta${dir ? ` ${dir}` : ''}${big ? ' big' : ''}`}>
      <span aria-hidden="true">{pct > 0 ? '▲' : pct < 0 ? '▼' : '•'}</span>
      {abs != null ? `${fmtSigned(abs)} (${fmtPct(pct)})` : fmtPct(pct)}
    </span>
  )
}

const BackIcon = () => (
  <svg width="9" height="15" viewBox="0 0 9 15" aria-hidden="true">
    <path d="M7 1.5L1.5 7.5L7 13.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const TabIcon = ({ kind, active }) => {
  const s = active ? 'var(--accent)' : 'var(--tab-idle)'
  if (kind === 'market')
    return (
      <svg width="25" height="25" viewBox="0 0 26 26" aria-hidden="true">
        <path d="M3.5 19.5l5.5-7 4 4 5-8 4.5 4.5" fill="none" stroke={s} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3.5 22.5h19" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  if (kind === 'events')
    return (
      <svg width="25" height="25" viewBox="0 0 26 26" aria-hidden="true">
        <rect x="5" y="3.5" width="16" height="19" rx="3.5" fill="none" stroke={s} strokeWidth="1.8" />
        <path d="M9 9.5h8M9 13.5h8M9 17.5h5" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  if (kind === 'calendar')
    return (
      <svg width="25" height="25" viewBox="0 0 26 26" aria-hidden="true">
        <rect x="3.5" y="5" width="19" height="17" rx="4.5" fill="none" stroke={s} strokeWidth="1.8" />
        <path d="M3.5 10h19" stroke={s} strokeWidth="1.8" />
        <circle cx="9" cy="15.5" r="1.6" fill={s} />
        <circle cx="17" cy="15.5" r="1.6" fill={s} />
      </svg>
    )
  return (
    <svg width="25" height="25" viewBox="0 0 26 26" aria-hidden="true">
      <circle cx="13" cy="13" r="9.5" fill="none" stroke={s} strokeWidth="1.8" />
      <path d="M13 12v6" stroke={s} strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="13" cy="8.6" r="1.3" fill={s} />
    </svg>
  )
}

// listing toggles and a range picker, shared by the market chart and a ticker
const ChartControls = ({ view, listings = true }) => (
  <div className="chart-controls">
    {listings ? (
      <div className="picks">
        <button type="button" className={`pick all${view.picked.length === NAMES.length ? ' on' : ''}`} onClick={view.all}>
          All
        </button>
        {NAMES.map((n) => {
          const on = view.picked.includes(n)
          return (
            <button key={n} type="button" className={`pick${on ? ' on' : ''}`} style={{ '--pick': `var(--c-${n})` }} onClick={() => view.toggle(n)} aria-pressed={on} title={n}>
              <Avatar name={n} size={26} />
              <span>{TICKER[n]}</span>
            </button>
          )
        })}
        {INDEXES.map((ix) => {
          const on = view.indexes.includes(ix.id)
          return (
            <button key={ix.id} type="button" className={`pick index${on ? ' on' : ''}`} style={{ '--pick': ix.color }} onClick={() => view.toggleIndex(ix.id)} aria-pressed={on} title={`${ix.label} index`}>
              <i className="pick-key" style={{ background: ix.color }} />
              <span>{ix.label}</span>
            </button>
          )
        })}
      </div>
    ) : null}
    <div className="segmented small">
      {RANGES.map((r) => (
        <button key={r.id} type="button" className={view.range === r.id ? 'on' : ''} onClick={() => view.setRange(r.id)}>
          {r.label}
        </button>
      ))}
    </div>
  </div>
)

const rangeDays = (id) => (RANGES.find((r) => r.id === id) || RANGES[RANGES.length - 1]).days
const windowLabel = (id) => ({ '1w': 'Past week', '1m': 'Past month', '1y': 'Past year' }[id] || 'Since IPO')

const namesOf = (s) => (Array.isArray(s.names) && s.names.length ? s.names.filter((n) => NAMES.includes(n)) : NAMES.includes(s.name) ? [s.name] : [])

const listNames = (names) => {
  if (names.length === NAMES.length) return 'Everyone'
  if (names.length <= 1) return names[0] || ''
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
}

const Filing = ({ e, showName = true, onName }) => (
  <div className="filing">
    <div className="filing-emoji" aria-hidden="true">
      {e.emoji}
    </div>
    <div className="filing-main">
      <div className="filing-title">
        {showName ? (
          <button type="button" className="link" style={{ font: 'inherit', fontWeight: 600 }} onClick={() => onName && onName(e.name)}>
            {TICKER[e.name]}
          </button>
        ) : null}
        <span>{e.title}</span>
        <Delta pct={e.pct} />
      </div>
      {e.note ? <div className="filing-note">{e.note}</div> : null}
      {e.verdict ? (
        <div className="filing-note" style={{ color: 'var(--ink-2)' }}>
          <strong>Committee:</strong> {e.verdict}
        </div>
      ) : null}
      <div className="filing-meta num">
        {fmtDay(e.day, { weekday: 'short', month: 'short', day: 'numeric' })}
        {e.by ? ` · reported by ${e.by}` : ''} · {fmtMoney(e.before)} → {fmtMoney(e.after)}
      </div>
    </div>
  </div>
)

const Submission = ({ s, reviewer, onDelete, filed, onName }) => {
  // once ruled, the report wears the committee's category, which may differ
  const cat = CATEGORY[(filed && filed.length === 1 && filed[0].type) || s.category] || CATEGORY.other
  const names = namesOf(s)
  return (
    <div className="sub">
      {names.length === 1 ? (
        <Avatar name={names[0]} size={36} />
      ) : (
        <div className="avatar-stack">
          {names.slice(0, 3).map((n) => (
            <Avatar key={n} name={n} size={26} />
          ))}
        </div>
      )}
      <div className="sub-main">
        <div className="sub-title">
          {names.length === 1 ? (
            <button type="button" className="link" style={{ font: 'inherit', fontWeight: 600 }} onClick={() => onName && onName(names[0])}>
              {names[0]}
            </button>
          ) : (
            <span>{listNames(names)}</span>
          )}
          <span style={{ color: 'var(--ink-2)', fontWeight: 500 }}>
            {cat.emoji} {cat.label}
            {s.category === 'date' && s.partner ? ` with ${s.partner}` : ''}
          </span>
          <span className={`badge ${filed ? 'filed' : 'pending'}`}>{filed ? 'Ruled' : 'Submitted'}</span>
          {s.source === 'couch' ? <span className="badge">Couch App</span> : null}
          {filed && filed.length === 1 ? <Delta pct={filed[0].pct} /> : null}
        </div>
        <div className="sub-text">{s.text}</div>
        {filed && filed.length > 1 ? (
          <div className="sub-meta">
            {filed.map((e) => (
              <span key={e.key} style={{ marginRight: 8 }}>
                {TICKER[e.name]} <Delta pct={e.pct} />
              </span>
            ))}
          </div>
        ) : null}
        <div className="sub-meta">
          {fmtDay(s.day, { weekday: 'short', month: 'short', day: 'numeric' })} · reported by {s.by || 'Anonymous'}
        </div>
        {reviewer && !filed ? (
          <div className="sub-actions">
            <button type="button" className="chip small" onClick={() => onDelete(s)}>
              Delete
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

const Report = ({ report }) => {
  if (!report) return null
  return (
    <div className="card">
      <div className="report-head">
        <h3>Closing report</h3>
        <span className="report-when">{fmtDay(report.day, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
      </div>
      <p className="report-lede">{report.headline}</p>
      <div className="report-lines">
        {report.lines.map((l) => (
          <div key={l.name} className="report-line">
            <i className="dot" style={{ background: COLOR[l.name] }} />
            <span>{l.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const DbBanner = ({ error }) =>
  error ? (
    <div className="banner">
      The database is not letting the exchange {error.kind === 'write' ? 'post' : 'read'} events yet
      {error.message ? ` (${error.message})` : ''}. The Firebase rules need an <code>exchange</code> entry with read and
      write allowed.
    </div>
  ) : null

const AccountRow = ({ account }) =>
  account.user && account.member ? (
    <div className="row">
      <Avatar name={account.member.name} size={32} />
      <div className="row-main">
        <div className="row-title">Signed in as {account.member.name}</div>
        <div className="row-sub">{account.user.email}</div>
      </div>
      <button type="button" className="chip small" onClick={account.signOut}>
        Sign out
      </button>
    </div>
  ) : account.user ? (
    <div className="row">
      <div className="row-main">
        <div className="row-title">Signed in, not a roommate</div>
        <div className="row-sub" style={{ whiteSpace: 'normal' }}>
          Only the five roommates see the events. You can still report one.
        </div>
      </div>
      <button type="button" className="chip small" onClick={account.signOut}>
        Sign out
      </button>
    </div>
  ) : (
    <button type="button" className="row" onClick={account.signIn} disabled={account.busy}>
      <div className="row-main">
        <div className="row-title">Roommate? Sign in with Google</div>
        <div className="row-sub">Roommates see the events behind the numbers</div>
      </div>
      <Chevron />
    </button>
  )

/* ---------- pages ---------- */

const MarketPage = ({ market, today, go, waiting, insider, reviewer, view, brindex, onRemoveBrindex }) => {
  const ranked = rankings(market)
  const idx = indexChange(market, today)
  const idxPts = indexSeries(market, today).map((p) => p.price)
  const bdx = brindexChange(brindex, market.ipo, today)
  const bdxSeries = brindexSeries(brindex, market.ipo, today)
  const latest = bdx.report
  const events = eventList(market)
  const days = closedDays(market)
  const lastClose = days.length ? days[days.length - 1] : null
  const report = lastClose ? closingReport(market, lastClose) : null
  const windowDays = rangeDays(view.range)
  const series = [
    ...view.picked.map((n) => ({
      key: n,
      label: TICKER[n],
      color: `var(--c-${n})`,
      points: sliceRange(priceSeries(market, n, today), today, windowDays)
    })),
    ...INDEXES.filter((ix) => view.indexes.includes(ix.id)).map((ix) => ({
      key: ix.id,
      label: ix.label,
      color: ix.color,
      dashed: true,
      points: sliceRange(ix.id === 'boyo' ? indexSeries(market, today) : bdxSeries, today, windowDays)
    }))
  ]
  const tapeItems = ranked.map((n) => {
    const ch = dayChange(market, n, today)
    return (
      <span key={n} className="tape-item">
        <span className="ticker-sym">{TICKER[n]}</span>
        <span>{fmtMoney(market.live[n])}</span>
        <span className={`chg${ch.pct > 0 ? ' up' : ch.pct < 0 ? ' down' : ''}`}>
          {ch.pct > 0 ? '▲' : ch.pct < 0 ? '▼' : '•'} {fmtPct(ch.pct)}
        </span>
      </span>
    )
  })

  return (
    <div className="stack">
      <div className="tape" aria-hidden="true">
        <div className="tape-track">
          {tapeItems}
          {tapeItems.map((it, i) => (
            <span key={`dup${i}`} className="tape-item">
              {it.props.children}
            </span>
          ))}
        </div>
      </div>

      <div className="tiles">
        <div className="card tight tile">
          <div className="tile-label">{INDEX_NAME}</div>
          <div className="tile-value">{idx.now.toFixed(2)}</div>
          <Delta pct={idx.pct} abs={idx.abs} />
          <Sparkline points={idxPts.slice(-30)} color="var(--c-boyo)" width={120} height={34} />
          <p className="tile-sub">The five listings, averaged.</p>
        </div>
        <div className="card tight tile">
          <div className="tile-label">{BRINDEX_NAME}</div>
          <div className="tile-value">{bdx.now.toFixed(2)}</div>
          <Delta pct={bdx.pct} abs={bdx.abs} />
          <Sparkline points={bdxSeries.map((p) => p.price).slice(-30)} color="var(--c-brindex)" width={120} height={34} />
          <p className="tile-sub">{latest ? `Britta's read, last ${fmtDay(latest.day)}.` : "Britta's read. No report yet."}</p>
        </div>
      </div>

      {insider && latest ? (
        <details className="card fold">
          <summary>
            <div className="report-head">
              <h3>Latest {BRINDEX_NAME} report</h3>
              <span className="report-when">{fmtDay(latest.day, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              <Chevron />
            </div>
            <div className="row-sub">Average {brindexAverage(latest.ratings).toFixed(1)} of {BRINDEX_MAX}. Tap to see her ratings.</div>
          </summary>
          <div className="ratings" style={{ marginTop: 12 }}>
            {ranked.map((n) => {
              const r = Number(latest.ratings[n])
              const v = Number.isFinite(r) ? r : null
              return (
                <div key={n} className="rating-row">
                  <Avatar name={n} size={26} />
                  <span className="rating-name">{n}</span>
                  <span className="meter" aria-hidden="true">
                    <i style={{ width: `${((v == null ? 0 : v) / BRINDEX_MAX) * 100}%`, background: `var(--c-${n})` }} />
                  </span>
                  <span className="rating-value num">{v == null ? '–' : `${v}/${BRINDEX_MAX}`}</span>
                </div>
              )
            })}
          </div>
          {latest.comment ? (
            <p className="report-lede" style={{ marginTop: 10 }}>
              “{latest.comment}”{latest.by ? ` — ${latest.by}` : ''}
            </p>
          ) : null}
          {reviewer ? (
            <div className="btn-row" style={{ marginTop: 10 }}>
              <button type="button" className="chip small" onClick={() => onRemoveBrindex(latest)}>
                Delete this report
              </button>
            </div>
          ) : null}
        </details>
      ) : insider ? (
        <div className="card tight">
          <div className="row-title">No {BRINDEX_NAME} report yet</div>
          <div className="row-sub" style={{ whiteSpace: 'normal' }}>
            Britta's form is on the You tab. Send it once a week and the index starts moving.
          </div>
        </div>
      ) : null}

      {waiting && insider ? (
        <button type="button" className="row card tight" style={{ minHeight: 0 }} onClick={() => go('events')}>
          <div className="row-main">
            <div className="row-title">
              {waiting} {waiting === 1 ? 'report' : 'reports'} awaiting the committee
            </div>
            <div className="row-sub">Rulings post at the close</div>
          </div>
          <Chevron />
        </button>
      ) : null}

      <div className="group">
        <div className="group-head">
          <span className="group-label">Listings</span>
          <span className="group-label" style={{ textTransform: 'none', letterSpacing: 0 }}>
            {fmtDay(today, { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>
        <div className="list">
          {ranked.map((n, i) => {
            const ch = dayChange(market, n, today)
            const pts = priceSeries(market, n, today).map((p) => p.price).slice(-14)
            return (
              <button key={n} type="button" className="row" onClick={() => go(`t/${n}`)}>
                <span className={`rank${i === 0 ? ' one' : ''}`}>{i + 1}</span>
                <Avatar name={n} size={40} />
                <div className="row-main">
                  <div className="row-title">{n}</div>
                  <div className="row-sub">
                    <span className="ticker-sym">{TICKER[n]}</span>
                  </div>
                </div>
                <Sparkline points={pts} color={`var(--c-${n})`} width={62} />
                <div className="col-right">
                  <span className="price">{fmtMoney(market.live[n])}</span>
                  <Delta pct={ch.pct} />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="group">
        <div className="group-head">
          <span className="group-label">{view.picked.length === NAMES.length ? 'All listings' : listNames(view.picked)}</span>
          <span className="group-label" style={{ textTransform: 'none', letterSpacing: 0 }}>
            {windowLabel(view.range)}
          </span>
        </div>
        <div className="card tight">
          <ChartControls view={view} />
          {series.length === 1 ? (
            <PriceChart series={series[0].points} color={series[0].color} title={`${series[0].label} price`} />
          ) : (
            <MultiChart series={series} />
          )}
          {series.length > 1 ? (
            <div className="legend">
              {view.picked.map((n) => (
                <span key={n} className="legend-item">
                  <i style={{ background: `var(--c-${n})` }} />
                  <Avatar name={n} size={18} />
                  {n}
                </span>
              ))}
              {INDEXES.filter((ix) => view.indexes.includes(ix.id)).map((ix) => (
                <span key={ix.id} className="legend-item">
                  <i className="dashed" style={{ '--swatch': ix.color }} />
                  {ix.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {insider ? (
        <>
          <div className="group">
            <div className="group-head">
              <span className="group-label">Events by roommate</span>
              <span className="group-label" style={{ textTransform: 'none', letterSpacing: 0 }}>
                {windowLabel(view.range)}
              </span>
            </div>
            <div className="list">
              {ranked.map((n) => {
                const own = events.filter((e) => e.name === n)
                const ch = rangeChange(market, n, today, windowDays)
                const ups = own.filter((e) => e.pct > 0).length
                const downs = own.filter((e) => e.pct < 0).length
                return (
                  <details key={n} className="person" open={view.picked.length === 1 && view.picked[0] === n}>
                    <summary className="row">
                      <Avatar name={n} size={36} />
                      <div className="row-main">
                        <div className="row-title">{n}</div>
                        <div className="row-sub" style={{ whiteSpace: 'normal' }}>
                          {own.length ? `${own.length} ${own.length === 1 ? 'event' : 'events'} · ${ups} up, ${downs} down · last ${fmtDay(own[0].day)}` : 'No events yet'}
                        </div>
                      </div>
                      <div className="col-right">
                        <span className="price">{fmtMoney(market.live[n])}</span>
                        <Delta pct={ch.pct} />
                      </div>
                      <Chevron />
                    </summary>
                    <div className="person-events">
                      {own.length ? (
                        own.map((e) => <Filing key={e.key} e={e} showName={false} />)
                      ) : (
                        <div className="empty">Nothing on record for {n}. Opened at {fmtMoney(IPO_PRICE)} and has only drifted since.</div>
                      )}
                    </div>
                  </details>
                )
              })}
            </div>
            <p className="footnote">
              {view.range === 'all' ? 'Change since the IPO' : `Change over the ${windowLabel(view.range).toLowerCase()}`}, following the chart. Tap a name for the full history; every event is
              on the Events tab.
            </p>
          </div>
          <Report report={report} />
        </>
      ) : null}

      <p className="footnote center">
        Prices are set by the Exchange's pricing committee from events the household reports. Rulings are final.
      </p>
    </div>
  )
}

const TickerPage = ({ market, today, name, go, insider, view }) => {
  const ch = dayChange(market, name, today)
  const st = tickerStats(market, name, today)
  const series = sliceRange(priceSeries(market, name, today), today, rangeDays(view.range))
  const rank = rankings(market).indexOf(name) + 1
  const own = eventList(market).filter((e) => e.name === name)
  const firstDay = closedDays(market).filter((d) => d < today).length === 0
  const idle = Math.max(0, Math.round((new Date(`${today}T00:00:00`) - new Date(`${market.lastFiling[name]}T00:00:00`)) / 86400000))
  return (
    <div className="stack">
      <div className="card">
        <div className="tile-label">
          {TICKER[name]} · #{rank} of {NAMES.length}
        </div>
        <div className="hero">
          <div className="hero-value">{fmtMoney(market.live[name])}</div>
          <Delta pct={ch.pct} abs={ch.abs} big />
        </div>
        <p className="hero-sub">{firstDay ? 'Today, since the IPO' : "Today, vs yesterday's close"}</p>
        <ChartControls view={view} listings={false} />
        <PriceChart series={series} color={`var(--c-${name})`} title={`${TICKER[name]} price`} />
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-label">Since IPO</div>
          <div className="stat-value" style={{ color: st.sinceIpoPct > 0 ? 'var(--up)' : st.sinceIpoPct < 0 ? 'var(--down)' : undefined }}>
            {fmtPct(st.sinceIpoPct)}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">All-time high</div>
          <div className="stat-value">{fmtMoney(st.high)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">All-time low</div>
          <div className="stat-value">{fmtMoney(st.low)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Events</div>
          <div className="stat-value">{st.filings}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Quiet for</div>
          <div className="stat-value">
            {idle} {idle === 1 ? 'day' : 'days'}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Last event</div>
          <div className="stat-value">{own.length ? fmtDay(own[0].day) : 'None'}</div>
        </div>
      </div>

      <button type="button" className="primary slim" onClick={() => go(`report/${name}`)}>
        Report something about {name}
      </button>

      {insider ? (
        <div className="group">
          <div className="group-head">
            <span className="group-label">Events</span>
            <span className="group-label" style={{ textTransform: 'none', letterSpacing: 0 }}>
              newest first
            </span>
          </div>
          <div className="list">
            {own.length ? own.map((e) => <Filing key={e.key} e={e} showName={false} />) : <div className="empty">No events on record. A clean sheet, so far.</div>}
          </div>
        </div>
      ) : null}

      <p className="footnote center">Report something about {name} and the committee rules on it at the close.</p>
    </div>
  )
}

const EventsPage = ({ market, subs, reviewer, onDelete, dbError, go, account, insider }) => {
  const events = eventList(market)
  const open = subs.filter((s) => !s.filed)
  const done = subs.filter((s) => s.filed)
  const byDay = []
  events.forEach((e) => {
    const last = byDay[byDay.length - 1]
    if (last && last.day === e.day) last.items.push(e)
    else byDay.push({ day: e.day, items: [e] })
  })
  const filedBy = {}
  events.forEach((e) => {
    if (e.ref) (filedBy[e.ref] = filedBy[e.ref] || []).push(e)
  })

  if (!insider)
    return (
      <div className="stack">
        <button type="button" className="primary" onClick={() => go('report')}>
          Report an event
        </button>
        <DbBanner error={dbError} />
        <div className="card">
          <h3 style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.3 }}>How it works</h3>
          <p className="report-lede" style={{ marginTop: 6 }}>
            Something happens to a roommate. Someone reports it here. The household confirms it, the committee weighs
            it, and the price moves at the close. The events themselves are the household's business; the prices are
            everyone's.
          </p>
        </div>
        <div className="list">
          <AccountRow account={account} />
        </div>
        {account.error ? <div className="banner">{account.error}</div> : null}
      </div>
    )

  return (
    <div className="stack">
      <button type="button" className="primary" onClick={() => go('report')}>
        Report an event
      </button>
      <DbBanner error={dbError} />

      <div className="group">
        <div className="group-head">
          <span className="group-label">Submitted · awaiting the committee</span>
          <span className="group-label" style={{ textTransform: 'none', letterSpacing: 0 }}>
            {open.length}
          </span>
        </div>
        <div className="list">
          {open.length ? (
            open.map((s) => <Submission key={s.id} s={s} reviewer={reviewer} onDelete={onDelete} onName={(n) => go(`t/${n}`)} />)
          ) : (
            <div className="empty">Nothing waiting on the committee. Something happen? Report it above.</div>
          )}
        </div>
      </div>

      <div className="group">
        <div className="group-head">
          <span className="group-label">Ruled events</span>
          <span className="group-label" style={{ textTransform: 'none', letterSpacing: 0 }}>
            {events.length} on record · newest first
          </span>
        </div>
        {byDay.length ? (
          byDay.map((g) => (
            <div key={g.day} className="group" style={{ marginTop: 0 }}>
              <div className="group-head">
                <span className="group-label" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>
                  {fmtDay(g.day, { weekday: 'long', month: 'long', day: 'numeric' })}
                </span>
              </div>
              <div className="list">
                {g.items.map((e) => (
                  <Filing key={e.key} e={e} onName={(n) => go(`t/${n}`)} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="list">
            <div className="empty">Nothing on file yet. Everyone is sitting at the IPO price, which will not last.</div>
          </div>
        )}
      </div>

      {done.length ? (
        <details className="plain">
          <summary>
            {done.length} ruled {done.length === 1 ? 'report' : 'reports'}
          </summary>
          <div className="list" style={{ marginTop: 8 }}>
            {done.map((s) => (
              <Submission key={s.id} s={s} reviewer={reviewer} filed={filedBy[s.id]} onName={(n) => go(`t/${n}`)} />
            ))}
          </div>
        </details>
      ) : null}

      <div className="list">
        <AccountRow account={account} />
      </div>
      {account.error ? <div className="banner">{account.error}</div> : null}
      <p className="footnote center">
        Anyone can report. {REVIEWER} goes over the day's reports with the committee, the committee rules, and the
        board moves at the close.
      </p>
    </div>
  )
}

const ReportPage = ({ market, today, account, preset, onSubmit, go, dbError }) => {
  const [names, setNames] = useState(NAMES.includes(preset) ? [preset] : [])
  const [category, setCategory] = useState('')
  const [partner, setPartner] = useState('')
  const [text, setText] = useState('')
  const [day, setDay] = useState(today)
  const [by, setBy] = useState(() => load('exchange.reporter', ''))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const member = account.member
  const ready = names.length && category && text.trim().length >= 3 && day >= market.ipo && day <= today
  const toggleName = (n) => setNames((p) => (p.includes(n) ? p.filter((x) => x !== n) : NAMES.filter((x) => p.includes(x) || x === n)))

  const submit = async (e) => {
    e.preventDefault()
    if (!ready || busy) return
    setBusy(true)
    setError('')
    try {
      // a signed-in roommate reports as themselves, always
      const who = member ? member.name : by.trim() || 'Anonymous'
      if (!member) save('exchange.reporter', by.trim())
      await onSubmit({
        names,
        name: names[0],
        category,
        partner: category === 'date' ? partner.trim() : '',
        text: text.trim(),
        day,
        by: who,
        uid: account.user ? account.user.uid : '',
        at: new Date().toISOString()
      })
      go('events')
    } catch (err) {
      setError(err && err.message ? err.message : 'Could not post the event.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <DbBanner error={dbError} />
      <div className="field">
        <div className="group-head" style={{ padding: 0 }}>
          <span className="field-label">Who it happened to</span>
          <button type="button" className="link" onClick={() => setNames(names.length === NAMES.length ? [] : NAMES)}>
            {names.length === NAMES.length ? 'Clear' : 'Everyone'}
          </button>
        </div>
        <div className="chips">
          {NAMES.map((n) => (
            <button
              key={n}
              type="button"
              className={`chip who-chip${names.includes(n) ? ' on' : ''}`}
              style={{ '--chip-bg': COLOR[n], '--chip-ink': INK[n] }}
              aria-pressed={names.includes(n)}
              onClick={() => toggleName(n)}
            >
              <Avatar name={n} size={26} />
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label">What kind of thing</span>
        <div className="chips">
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" className={`chip${category === c.id ? ' on' : ''}`} onClick={() => setCategory(c.id)}>
              <span aria-hidden="true">{c.emoji}</span> {c.label}
            </button>
          ))}
        </div>
        {category === 'date' ? (
          <input className="input" type="text" placeholder="With whom? A name or initials" value={partner} onChange={(e) => setPartner(e.target.value)} />
        ) : null}
      </div>

      <div className="field">
        <span className="field-label">What happened</span>
        <textarea
          className="input"
          placeholder={names.length === 1 ? `What did ${names[0]} do?` : names.length > 1 ? 'What did they do?' : 'What happened, in a sentence or two'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      <div className="field">
        <span className="field-label">When</span>
        <input className="input" type="date" min={market.ipo} max={today} value={day} onChange={(e) => setDay(e.target.value || today)} />
      </div>

      <div className="field">
        <span className="field-label">Reported by</span>
        {member ? (
          <div className="row card tight" style={{ minHeight: 0 }}>
            <Avatar name={member.name} size={30} />
            <div className="row-main">
              <div className="row-title">{member.name}</div>
              <div className="row-sub">Roommates report as themselves</div>
            </div>
          </div>
        ) : (
          <input className="input" type="text" placeholder="Your name (or stay anonymous)" value={by} onChange={(e) => setBy(e.target.value)} />
        )}
      </div>

      {error ? <div className="banner">{error}</div> : null}

      <button type="submit" className="primary" disabled={!ready || busy}>
        {busy ? 'Posting…' : 'Post to the Events page'}
      </button>
      <p className="footnote center">
        It posts right away. The committee rules on it at the close and the price moves.
      </p>
    </form>
  )
}

// Britta's weekly form: one slider per roommate, a comment, done. It is her
// form, so every report is filed under her name.
const BRINDEX_BY = 'Britta'
const BrindexPage = ({ today, onSubmit, go, dbError }) => {
  const [ratings, setRatings] = useState(() => Object.fromEntries(NAMES.map((n) => [n, 5])))
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const avg = brindexAverage(ratings)

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await onSubmit({ day: today, ratings, comment: comment.trim(), by: BRINDEX_BY, at: new Date().toISOString() })
      setDone(true)
    } catch (err) {
      setError(err && err.message ? err.message : 'Could not send the report.')
    } finally {
      setBusy(false)
    }
  }

  if (done)
    return (
      <div className="stack">
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="gate-title">Thank you, {BRINDEX_BY}.</div>
          <p className="gate-sub" style={{ marginTop: 8 }}>
            The {BRINDEX_NAME} has your read for the week. Average {avg.toFixed(1)} of {BRINDEX_MAX}.
          </p>
          <button type="button" className="primary slim" style={{ marginTop: 14 }} onClick={() => go('')}>
            See the market
          </button>
        </div>
      </div>
    )

  return (
    <form className="stack" onSubmit={submit}>
      <div className="card">
        <h3 style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.3 }}>How's everyone doing this week?</h3>
        <p className="report-lede" style={{ marginTop: 6 }}>
          One slider per roommate, 0 to 10. Go with your gut. A comment at the end if you feel like it.
        </p>
      </div>
      <DbBanner error={dbError} />
      <div className="list">
        {NAMES.map((n) => (
          <div key={n} className="rate">
            <div className="rate-head">
              <Avatar name={n} size={36} />
              <div className="row-main">
                <div className="row-title">{n}</div>
              </div>
              <div className="rate-value num" style={{ color: `var(--c-${n})` }}>
                {ratings[n]}
                <small>/{BRINDEX_MAX}</small>
              </div>
            </div>
            <input
              className="slider"
              type="range"
              min="0"
              max={BRINDEX_MAX}
              step="1"
              value={ratings[n]}
              style={{ '--fill-color': `var(--c-${n})`, '--pct': `${(ratings[n] / BRINDEX_MAX) * 100}%` }}
              aria-label={`${n}, 0 to ${BRINDEX_MAX}`}
              onChange={(e) => setRatings((r) => ({ ...r, [n]: Number(e.target.value) }))}
            />
            <div className="slider-ends">
              <span>Rough week</span>
              <span>Thriving</span>
            </div>
          </div>
        ))}
      </div>
      <div className="field">
        <span className="field-label">Anything to add? (optional)</span>
        <textarea className="input" placeholder="Shout-outs, concerns, observations…" value={comment} onChange={(e) => setComment(e.target.value)} />
      </div>
      {error ? <div className="banner">{error}</div> : null}
      <button type="submit" className="primary" disabled={busy}>
        {busy ? 'Sending…' : `Submit this week's ${BRINDEX_NAME}`}
      </button>
      <p className="footnote center">
        Filed as {BRINDEX_BY}. Your ratings and comments are only seen by the household. The index they move is public.
      </p>
    </form>
  )
}

const AboutPage = ({ theme, setTheme, onShare, onShareBrindex, account, settings }) => (
  <div className="stack">
    {account.member ? (
      <>
        <div className="group">
          <div className="group-head">
            <span className="group-label">You</span>
          </div>
          <div className="list">
            <div className="row">
              <Avatar name={account.member.name} size={36} />
              <div className="row-main">
                <div className="row-title">{account.member.name}</div>
                <div className="row-sub">{account.user && account.user.email ? account.user.email : 'Signed in with Google'}</div>
              </div>
              <button type="button" className="chip small" onClick={account.signOut}>
                Sign out
              </button>
            </div>
            <div className="row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 10 }}>
              <div className="row-title">Profile photo</div>
              <div className="photo-row">
                <Avatar name={account.member.name} size={56} />
                <div className="chips">
                  <label className={`chip${settings.photoBusy ? ' busy' : ''}`}>
                    {settings.photoBusy ? 'Uploading…' : settings.hasPhoto ? 'Change photo' : 'Choose photo'}
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      disabled={settings.photoBusy}
                      onChange={(e) => {
                        settings.choosePhoto(e.target.files && e.target.files[0])
                        e.target.value = ''
                      }}
                    />
                  </label>
                  {settings.hasPhoto ? (
                    <button type="button" className="chip" onClick={settings.removePhoto}>
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
              {settings.photoError ? <p className="photo-error">{settings.photoError}</p> : null}
            </div>
            <div className="row">
              <div className="row-title" style={{ flexShrink: 0 }}>
                Partner
              </div>
              <input className="row-input" type="text" placeholder="Optional" value={settings.partner} onChange={(e) => settings.setPartner(e.target.value)} />
            </div>
          </div>
          <p className="footnote">Your partner fills in automatically when you book a date on the calendar. Leave it empty to be asked each time.</p>
        </div>

        <div className="group">
          <div className="group-head">
            <span className="group-label">Appearance</span>
          </div>
          <div className="card">
            <div className="segmented">
              {['light', 'dark', 'auto'].map((t) => (
                <button key={t} type="button" className={theme === t ? 'on' : ''} onClick={() => setTheme(t)}>
                  {t === 'auto' ? 'Automatic' : t[0].toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <p className="footnote" style={{ paddingTop: 12 }}>
              Automatic follows your phone's appearance setting.
            </p>
          </div>
        </div>
      </>
    ) : null}

    <div className="card rules">
      <h3>How the exchange works</h3>
      <p>
        Five listings, one per roommate. Everyone opened at {fmtMoney(IPO_PRICE)} on{' '}
        {fmtDay(IPO, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}. A listing is the market's
        read on that roommate at any given moment. Sometimes it runs hot, sometimes it does not.
      </p>
      <p>
        Prices move on <strong>material events</strong>. Anyone reports one on the Events tab. At the close the
        committee goes over the day's reports with the household, weighs each one against the listing's history and
        what it means for it, and the board moves.
      </p>
      <p className="muted">
        How much any event is worth is for the committee to decide. Rulings are published to the household with their
        reasoning and are final.
      </p>
    </div>

    <div className="list">
      <button type="button" className="row" onClick={onShare}>
        <div className="row-main">
          <div className="row-title">Share the exchange</div>
          <div className="row-sub">Send the link to anyone who should be watching</div>
        </div>
        <Chevron />
      </button>
      {account.member ? (
        <button type="button" className="row" onClick={onShareBrindex}>
          <div className="row-main">
            <div className="row-title">Send Britta the {BRINDEX_NAME} form</div>
            <div className="row-sub">Her weekly read on the five of you, one minute</div>
          </div>
          <Chevron />
        </button>
      ) : null}
      {!account.member ? <AccountRow account={account} /> : null}
    </div>
    {account.error && !account.member ? <div className="banner">{account.error}</div> : null}

    <p className="footnote build-stamp">449 Boyos · Build {typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev'}</p>
  </div>
)

// the calendar's door: sign in, claim a name once, or be told it is not for you
const CalendarGate = ({ account, claims, pick, setPick, onClaim }) => {
  const { user } = account
  if (user === undefined || (user && account.member === undefined))
    return <div className="empty">One moment…</div>
  if (!user)
    return (
      <div className="gate inline">
        <div className="gate-card">
          <div className="splash-dots">
            {ROOMMATES.map((r) => (
              <i key={r.name} className="dot big" style={{ background: r.color }} />
            ))}
          </div>
          <div className="gate-title">Roommates only</div>
          <p className="gate-sub">The couch calendar is for the five of us. Sign in with Google to open it.</p>
          <button type="button" className="primary" onClick={account.signIn} disabled={account.busy}>
            {account.busy ? 'Opening Google…' : 'Sign in with Google'}
          </button>
          {account.error ? <p className="gate-error">{account.error}</p> : null}
        </div>
      </div>
    )
  if (NAMES.every((n) => claims[n]))
    return (
      <div className="gate inline">
        <div className="gate-card">
          <div className="gate-title">Roommates only</div>
          <p className="gate-sub">
            Every roommate has already claimed their name, so the calendar is not for {user.email}. The market is open
            to everyone, though.
          </p>
          <button type="button" className="gate-link" onClick={account.signOut}>
            Sign out
          </button>
        </div>
      </div>
    )
  return (
    <div className="gate inline">
      <div className="gate-card">
        <div className="gate-title">Who are you?</div>
        <p className="gate-sub">Signed in as {user.email}. Pick your name once: this Google account becomes that roommate for good.</p>
        <div className="chips center">
          {NAMES.map((n) => {
            const taken = !!claims[n]
            return (
              <button
                key={n}
                type="button"
                className={`chip${pick === n ? ' on' : ''}`}
                style={pick === n ? { background: COLOR[n], borderColor: COLOR[n], color: INK[n] } : undefined}
                disabled={taken}
                title={taken ? 'Already claimed' : undefined}
                onClick={() => setPick(n)}
              >
                {n}
              </button>
            )
          })}
        </div>
        <button type="button" className="primary" onClick={onClaim} disabled={!pick || !!claims[pick]}>
          {pick ? `I'm ${pick}` : 'Pick your name'}
        </button>
        {account.error ? <p className="gate-error">{account.error}</p> : null}
        <button type="button" className="gate-link" onClick={account.signOut}>
          Not a roommate? Sign out
        </button>
      </div>
    </div>
  )
}

/* ---------- app ---------- */

export default function Exchange() {
  useAppHeight()
  const [route, go] = useRoute()
  const today = useToday()
  useMinute()
  const [splash, setSplash] = useState('in') // 'in' | 'out' | 'gone'
  const [photos, setPhotos] = useState({})
  const [theme, setTheme] = useState(() => load('couch.theme', 'auto'))
  const [toast, setToast] = useState('')
  const [rawSubs, setRawSubs] = useState({})
  const [rawBrindex, setRawBrindex] = useState({})
  const [dbError, setDbError] = useState(null)
  const bodyRef = useRef(null)
  const marketView = useChartView('market')
  const tickerView = useChartView('ticker')

  // Google sign-in. A signed-in account claims one roommate, for good; the
  // claim lives under members/{uid} and claims/{name}, so it follows the
  // account onto any phone. Roommates see the events and the calendar; the
  // reviewer can delete a report.
  // undefined while Google is still answering; null once it says nobody is signed in
  const [user, setUser] = useState(DEMO ? (OUTSIDER ? null : { uid: 'demo', email: 'noah@example.com' }) : undefined)
  const [member, setMember] = useState(DEMO ? (OUTSIDER ? null : { name: REVIEWER }) : undefined)
  const [claims, setClaims] = useState({})
  const [pick, setPick] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const me = member ? member.name : ''
  const insider = (DEMO && !OUTSIDER) || !!member
  const reviewer = (DEMO && !OUTSIDER) || (!!member && member.name === REVIEWER)

  // the splash's second line is for roommates. Google takes a moment to say
  // who is signed in, so a device that was a roommate's last time gets it at
  // once; everyone else sees only the title
  const [knownMember, setKnownMember] = useState(() => load('exchange.member', '') === '1')
  useEffect(() => {
    if (member === undefined) return
    save('exchange.member', member ? '1' : '')
    setKnownMember(!!member)
  }, [member])
  const splashTag = insider || (member === undefined && knownMember) ? '#Nodurfing' : null

  useEffect(() => {
    const t1 = setTimeout(() => setSplash('out'), 3000)
    const t2 = setTimeout(() => setSplash('gone'), 3500)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  useEffect(() => {
    if (DEMO) return undefined
    getRedirectResult(auth).catch((e) => setAuthError(describeAuthError(e)))
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u || null))
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (DEMO) return undefined
    if (!user) {
      setMember(user === null ? null : undefined)
      return undefined
    }
    setMember(undefined)
    const unsubscribe = onValue(
      ref(db, `members/${user.uid}`),
      (snap) => setMember(snap.exists() ? snap.val() : null),
      () => setMember(null)
    )
    const unsubscribeClaims = onValue(
      ref(db, 'claims'),
      (snap) => setClaims(snap.exists() ? snap.val() : {}),
      () => setClaims({})
    )
    return () => {
      unsubscribe()
      unsubscribeClaims()
    }
  }, [user])

  const claim = async () => {
    if (!user || !pick) return
    if (!window.confirm(`Sign in as ${pick}? This Google account will be ${pick} for good.`)) return
    setAuthError('')
    try {
      // one write, two paths: the claim on the name fails if someone already holds it
      await update(ref(db), {
        [`members/${user.uid}`]: { name: pick, email: user.email || '', at: new Date().toISOString() },
        [`claims/${pick}`]: user.uid
      })
    } catch (e) {
      setAuthError(/permission/i.test(e.message || '') ? `${pick} is already taken.` : e.message)
    }
  }

  // the calendar's data: roommates only, so it is read once someone is signed in
  const [reservations, setReservations] = useState({})
  const [loadingRes, setLoadingRes] = useState(true)
  useEffect(() => {
    if (DEMO) {
      setLoadingRes(false)
      return undefined
    }
    if (!user) return undefined
    const unsubscribe = onValue(
      ref(db, 'reservations'),
      (snap) => {
        setReservations(snap.exists() ? snap.val() : {})
        setLoadingRes(false)
      },
      (error) => {
        console.error('Reservations error:', error)
        setLoadingRes(false)
      }
    )
    return () => unsubscribe()
  }, [user])

  // finished couch bookings become reports on the exchange, the first time a
  // roommate opens the app after the booking's day has ended. Ids derive from
  // the booking, so a booking is only ever filed once.
  useEffect(() => {
    if (DEMO || !member || loadingRes) return
    const run = async () => {
      try {
        const snap = await get(ref(db, 'exchange/submissions'))
        const existing = snap.exists() ? snap.val() : {}
        const updates = {}
        Object.entries(reservations).forEach(([dStr, dayRes]) => {
          if (dStr < IPO || dStr >= today) return
          Object.entries(dayRes || {}).forEach(([key, res]) => {
            if (!res || !NAMES.includes(res.name)) return
            const id = `couch-${dStr}-${key}`
            if (existing[id]) return
            const startMin = res.startMin != null ? res.startMin : (res.hour || 0) * 60
            const endMin = res.endMin != null ? res.endMin : (res.endHour != null ? res.endHour : (res.hour || 0) + 1) * 60
            const clock = (min) => {
              if (min >= 1440) return '12 AM'
              const h = Math.floor(min / 60)
              const m = min % 60
              const ampm = h >= 12 ? 'PM' : 'AM'
              return m ? `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}` : `${h % 12 || 12} ${ampm}`
            }
            const when = `${clock(startMin)} – ${clock(endMin)}`
            const base = { names: [res.name], name: res.name, day: dStr, by: 'Couch App', at: new Date().toISOString(), source: 'couch' }
            updates[`exchange/submissions/${id}`] =
              res.type === 'date'
                ? { ...base, category: 'date', partner: res.guestName || '', text: `Reserved the couch for a date with ${res.guestName || 'someone'}, ${when}.${res.details ? ` ${res.details}` : ''}` }
                : { ...base, category: 'social', partner: '', text: `Hosted on the couch, ${when}: ${res.details || 'an event'}.` }
          })
        })
        if (Object.keys(updates).length) await update(ref(db), updates)
      } catch (error) {
        console.error('Exchange sync:', error)
      }
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member, loadingRes, today])

  // settings: the partner that autofills a date booking, and the profile photo
  const [partners, setPartners] = useState(() => {
    try {
      const raw = localStorage.getItem('couch.partners')
      const map = raw ? JSON.parse(raw) : {}
      return map && typeof map === 'object' ? map : {}
    } catch {
      return {}
    }
  })
  const partner = me ? partners[me] || '' : ''
  const setPartner = (v) => {
    if (me) setPartners((prev) => ({ ...prev, [me]: v }))
  }
  useEffect(() => save('couch.partners', JSON.stringify(partners)), [partners])
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const choosePhoto = async (file) => {
    if (!file || !me) return
    setPhotoBusy(true)
    setPhotoError('')
    try {
      const dataUrl = await squarePhoto(file)
      await set(ref(db, `profiles/${me}/photo`), dataUrl)
    } catch (error) {
      setPhotoError(error.message)
    } finally {
      setPhotoBusy(false)
    }
  }
  const removePhoto = async () => {
    if (!me || !window.confirm('Remove your profile photo?')) return
    try {
      await remove(ref(db, `profiles/${me}/photo`))
    } catch (error) {
      setPhotoError(error.message)
    }
  }

  const signIn = async () => {
    setAuthBusy(true)
    setAuthError('')
    const provider = new GoogleAuthProvider()
    try {
      await signInWithPopup(auth, provider)
    } catch (e) {
      const code = (e && e.code) || ''
      if (/popup-blocked|cancelled-popup-request|operation-not-supported/.test(code)) {
        try {
          await signInWithRedirect(auth, provider)
          return
        } catch (e2) {
          setAuthError(describeAuthError(e2))
        }
      } else setAuthError(describeAuthError(e))
    } finally {
      setAuthBusy(false)
    }
  }
  const account = { user, member, busy: authBusy, error: authError, signIn, signOut: () => signOut(auth).catch(() => {}) }

  const source = useMemo(() => (DEMO ? demoData(today) : { ipo: IPO, ledger: LEDGER }), [today])
  const market = useMemo(() => buildMarket(source.ledger, source.ipo, today), [source, today])

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'auto') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
    save('couch.theme', theme)
  }, [theme])

  // profile photos are the ones the roommates set in the Couch App
  useEffect(() => {
    const unsubscribe = onValue(
      ref(db, 'profiles'),
      (snap) => {
        const v = snap.exists() ? snap.val() : {}
        const map = {}
        Object.entries(v).forEach(([n, prof]) => {
          if (prof && typeof prof.photo === 'string') map[n] = prof.photo
        })
        setPhotos(map)
      },
      () => {}
    )
    return () => unsubscribe()
  }, [])

  // submitted events and Britta's reports live in the shared database
  useEffect(() => {
    if (DEMO) {
      setRawSubs(source.submissions)
      setRawBrindex(source.brindex)
      return undefined
    }
    const unsubscribeBrindex = onValue(
      ref(db, 'exchange/brindex'),
      (snap) => setRawBrindex(snap.exists() ? snap.val() : {}),
      () => {}
    )
    const unsubscribe = onValue(
      ref(db, 'exchange/submissions'),
      (snap) => {
        setRawSubs(snap.exists() ? snap.val() : {})
        setDbError(null)
      },
      (error) => setDbError({ kind: 'read', message: error && error.message })
    )
    return () => {
      unsubscribe()
      unsubscribeBrindex()
    }
  }, [source])

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0
    const name = route.page === 't' && NAMES.includes(route.arg) ? `${TICKER[route.arg]} · ` : ''
    document.title = `${name}449 Exchange`
  }, [route.page, route.arg])

  useEffect(() => {
    if (!toast) return undefined
    const id = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(id)
  }, [toast])

  // a submission the ledger has ruled on is filed; one the committee withdrew
  // is gone; anything else is waiting
  const filedRefs = useMemo(() => new Set(market.events.map((e) => e.ref).filter(Boolean)), [market])
  const withdrawn = useMemo(() => new Set(market.withdrawn), [market])
  const subs = useMemo(
    () =>
      Object.entries(rawSubs || {})
        .map(([id, s]) => ({ ...s, id, filed: filedRefs.has(id) }))
        .filter((s) => namesOf(s).length && s.status !== 'rejected' && !withdrawn.has(s.id))
        .sort((a, b) => (b.at || '').localeCompare(a.at || '')),
    [rawSubs, filedRefs, withdrawn]
  )
  const waiting = subs.filter((s) => !s.filed).length

  const submitEvent = async (record) => {
    if (DEMO) {
      const id = `demo-${Date.now().toString(36)}`
      setRawSubs((prev) => ({ ...prev, [id]: record }))
      setToast('Posted (demo)')
      return
    }
    try {
      await push(ref(db, 'exchange/submissions'), record)
      setToast('Posted. The committee rules at the close.')
    } catch (error) {
      setDbError({ kind: 'write', message: error && error.message })
      throw error
    }
  }

  const brindex = useMemo(() => withoutWithdrawn(rawBrindex, market.brindexWithdrawn), [rawBrindex, market])

  // only the reviewer's account may delete a Brindex report; the database
  // rule checks it against the Noah claim
  const removeBrindex = async (r) => {
    if (!window.confirm(`Delete the ${BRINDEX_NAME} report from ${fmtDay(r.day)}? The index will move back.`)) return
    if (DEMO) {
      setRawBrindex((prev) => {
        const next = { ...prev }
        delete next[r.id]
        return next
      })
      return
    }
    try {
      await remove(ref(db, `exchange/brindex/${r.id}`))
      setToast('Report deleted')
    } catch (error) {
      setToast(describeAuthError(error))
    }
  }

  const submitBrindex = async (record) => {
    if (DEMO) {
      setRawBrindex((prev) => ({ ...prev, [`demo-${Date.now().toString(36)}`]: record }))
      return
    }
    try {
      await push(ref(db, 'exchange/brindex'), record)
    } catch (error) {
      setDbError({ kind: 'write', message: error && error.message })
      throw error
    }
  }

  const shareBrindex = async () => {
    const url = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}#/brindex`
    try {
      if (navigator.share) await navigator.share({ title: `The ${BRINDEX_NAME}`, text: "This week's read on the roommates, one minute.", url })
      else {
        await navigator.clipboard.writeText(url)
        setToast('Brindex link copied')
      }
    } catch {}
  }

  // only the reviewer's Google account may remove a report; the database rule
  // checks it against the Noah claim, so this is not merely hidden for others
  const removeSub = async (s) => {
    if (!window.confirm(`Delete this report about ${listNames(namesOf(s))}? It will not be ruled on.`)) return
    if (DEMO) {
      setRawSubs((prev) => {
        const next = { ...prev }
        delete next[s.id]
        return next
      })
      return
    }
    try {
      await remove(ref(db, `exchange/submissions/${s.id}`))
      setToast('Report deleted')
    } catch (error) {
      setDbError({ kind: 'write', message: error && error.message })
    }
  }

  const share = async () => {
    const url = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}`
    try {
      if (navigator.share) await navigator.share({ title: '449 Exchange', text: 'The roommate stock market.', url })
      else {
        await navigator.clipboard.writeText(url)
        setToast('Link copied')
      }
    } catch {}
  }

  const page = route.page
  const tickerName = page === 't' && NAMES.includes(route.arg) ? route.arg : null
  const reporting = page === 'report'
  const brindexing = page === 'brindex'
  const tab = page === 'events' || reporting ? 'events' : page === 'about' ? 'about' : page === 'calendar' ? 'calendar' : 'market'
  const settings = { photoBusy, photoError, hasPhoto: !!photos[me], choosePhoto, removePhoto, partner, setPartner }
  const requests = countRequests(reservations, me)
  const mins = minutesToClose()
  const closesIn = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`

  const header = tickerName ? (
    <div className="head-row">
      <button type="button" className="back" onClick={() => go('')} aria-label="Back to the market">
        <BackIcon />
        Market
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ textAlign: 'right' }}>
          <h1 style={{ fontSize: 22 }}>{tickerName}</h1>
          <div className="ticker-sym">{TICKER[tickerName]}</div>
        </div>
        <Avatar name={tickerName} size={44} />
      </div>
    </div>
  ) : reporting ? (
    <div className="head-row">
      <button type="button" className="back" onClick={() => go('events')} aria-label="Back to events">
        <BackIcon />
        Events
      </button>
      <h1 style={{ fontSize: 22 }}>Report an event</h1>
    </div>
  ) : brindexing ? (
    <div className="head-row">
      <div>
        <div className="eyebrow">449 Boyos Exchange</div>
        <h1>The {BRINDEX_NAME}</h1>
      </div>
    </div>
  ) : (
    <div className="head-row">
      <div>
        <div className="eyebrow">
          449 Boyos Exchange
          {DEMO ? (
            <>
              {' '}
              <span className="badge warn">Demo data</span>
            </>
          ) : null}
        </div>
        <h1>{tab === 'events' ? 'Events' : tab === 'about' ? (member ? 'You' : 'About') : tab === 'calendar' ? 'Calendar' : 'Market'}</h1>
      </div>
      <span className="status" title="The board settles at midnight">
        <i className="pulse" aria-hidden="true" />
        Open · closes in {closesIn}
      </span>
    </div>
  )

  return (
    <PhotoContext.Provider value={photos}>
      <div className="x-app">
        <div className="backdrop" aria-hidden="true" />
        {tab === 'calendar' && member ? (
          <Calendar me={me} partner={partner} allReservations={reservations} loading={loadingRes} />
        ) : (
          <>
        <header className="x-head">{header}</header>
        <main className="x-body" ref={bodyRef}>
          {tab === 'calendar' ? (
            <CalendarGate account={account} claims={claims} pick={pick} setPick={setPick} onClaim={claim} />
          ) : tickerName ? (
            <TickerPage market={market} today={today} name={tickerName} go={go} insider={insider} view={tickerView} />
          ) : brindexing ? (
            <BrindexPage today={today} onSubmit={submitBrindex} go={go} dbError={dbError} />
          ) : reporting ? (
            <ReportPage market={market} today={today} account={account} preset={route.arg} onSubmit={submitEvent} go={go} dbError={dbError} />
          ) : tab === 'events' ? (
            <EventsPage market={market} subs={subs} reviewer={reviewer} onDelete={removeSub} dbError={dbError} go={go} account={account} insider={insider} />
          ) : tab === 'about' ? (
            <AboutPage theme={theme} setTheme={setTheme} onShare={share} onShareBrindex={shareBrindex} account={account} settings={settings} />
          ) : (
            <MarketPage market={market} today={today} go={go} waiting={waiting} insider={insider} reviewer={reviewer} view={marketView} brindex={brindex} onRemoveBrindex={removeBrindex} />
          )}
        </main>
          </>
        )}
        <nav className="x-tabbar">
          {[
            { key: 'market', label: 'Market', path: '' },
            { key: 'events', label: 'Events', path: 'events' },
            { key: 'calendar', label: 'Calendar', path: 'calendar' },
            { key: 'about', label: member ? 'You' : 'About', path: 'about' }
          ].map((t) => {
            const on = tab === t.key && !tickerName
            return (
              <button key={t.key} type="button" className={`tab${on ? ' on' : ''}`} onClick={() => go(t.path)}>
                <TabIcon kind={t.key} active={on} />
                {t.key === 'events' && reviewer && waiting ? <i className="tab-dot" aria-label="Events waiting for the committee" /> : null}
                {t.key === 'calendar' && requests ? <i className="tab-dot" aria-label="Couch requests waiting" /> : null}
                <span>{t.label}</span>
              </button>
            )
          })}
        </nav>
        {toast ? <div className="toast">{toast}</div> : null}
        {splash !== 'gone' ? <Splash leaving={splash === 'out'} tag={splashTag} /> : null}
      </div>
    </PhotoContext.Provider>
  )
}
