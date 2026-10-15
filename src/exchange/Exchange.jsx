import { useState, useEffect, useMemo, useRef, createContext, useContext } from 'react'
import { db, auth } from '../firebase'
import { ref, onValue, push, update } from 'firebase/database'
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut } from 'firebase/auth'
import { NAMES, COLOR, INK } from '../roommates.js'
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
  closedDays,
  closingReport,
  sliceRange
} from './market.js'
import { Sparkline, PriceChart, MultiChart } from './charts.jsx'

// the household's reviewer: the Google account that claimed this roommate in
// the Couch App. The committee (Claude) rules on what the reviewer approves.
const REVIEWER = 'Noah'

// where the Couch App lives. On a shared domain it is the root; when the
// exchange runs on its own Railway service, VITE_COUCH_URL points across.
const COUCH_URL = import.meta.env.VITE_COUCH_URL || '/'

const describeAuthError = (e) => {
  const code = (e && e.code) || ''
  if (code === 'auth/operation-not-allowed') return 'Google sign-in is not switched on in Firebase yet.'
  if (code === 'auth/unauthorized-domain') return 'This address is not on the Firebase authorized domains list yet.'
  if (code === 'auth/popup-closed-by-user') return 'The sign-in window was closed before finishing.'
  if (code === 'auth/network-request-failed') return 'No connection. Try again in a moment.'
  return (e && e.message) || 'Sign-in failed.'
}

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
    'demo-s1': { names: ['James'], name: 'James', category: 'apartment', text: 'Did every dish in the sink without being asked.', day: today, by: 'Bryon', at: `${today}T18:20:00.000Z`, status: 'pending' },
    'demo-s2': { names: ['Andrew'], name: 'Andrew', category: 'romance', text: 'Got a number at the farmers market. Unprompted.', day: addDays(today, -1), by: 'Noah', at: `${addDays(today, -1)}T21:02:00.000Z`, status: 'approved' },
    'demo-s3': { names: ['Noah'], name: 'Noah', category: 'other', text: 'Noah is simply the best roommate and deserves +40%.', day: addDays(today, -3), by: 'Anonymous', at: `${addDays(today, -3)}T23:40:00.000Z`, status: 'rejected' },
    'demo-s4': { names: ['Noah'], name: 'Noah', category: 'date', partner: 'Priya', text: 'Museum, then tacos.', day: d(39), by: 'Jonas', at: `${d(39)}T22:10:00.000Z`, status: 'approved' },
    'demo-s5': { names: NAMES, name: 'Noah', category: 'social', text: 'All five went to trivia at the bar. Came third.', day: addDays(today, -1), by: 'Couch App', at: `${addDays(today, -1)}T23:00:00.000Z`, status: 'approved', source: 'couch' }
  }
  return { ipo, ledger, submissions }
}

/* ---------- small hooks ---------- */

const load = (key, fallback) => {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : v
  } catch {
    return fallback
  }
}
const save = (key, value) => {
  try {
    localStorage.setItem(key, value)
  } catch {}
}

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
  useEffect(() => save(`exchange.view.${key}.picked`, JSON.stringify(picked)), [key, picked])
  useEffect(() => save(`exchange.view.${key}.range`, range), [key, range])
  const toggle = (name) =>
    setPicked((p) => {
      if (p.length === NAMES.length) return [name] // from "all", tapping one isolates it
      if (p.includes(name)) return p.length === 1 ? NAMES : p.filter((n) => n !== name)
      return NAMES.filter((n) => p.includes(n) || n === name)
    })
  return { picked, toggle, all: () => setPicked(NAMES), range, setRange }
}

/* ---------- pieces ---------- */

const PhotoContext = createContext({})

const Avatar = ({ name, size = 36 }) => {
  const photos = useContext(PhotoContext)
  const photo = photos[name]
  const color = COLOR[name] || '#8E8E93'
  return (
    <div
      className="avatar"
      role={photo ? 'img' : undefined}
      aria-label={photo ? name : undefined}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: photo ? `url(${photo}) center / cover` : color,
        color: INK[name] || '#fff',
        fontSize: Math.round(size * 0.42),
        boxShadow: photo ? `0 0 0 ${size >= 34 ? 2 : 1.5}px ${color}` : undefined
      }}
    >
      {photo ? null : name ? name[0] : '?'}
    </div>
  )
}

const Delta = ({ pct, abs, big }) => {
  const dir = pct > 0 ? 'up' : pct < 0 ? 'down' : ''
  return (
    <span className={`delta${dir ? ` ${dir}` : ''}${big ? ' big' : ''}`}>
      <span aria-hidden="true">{pct > 0 ? '▲' : pct < 0 ? '▼' : '•'}</span>
      {abs != null ? `${fmtSigned(abs)} (${fmtPct(pct)})` : fmtPct(pct)}
    </span>
  )
}

const Chevron = () => (
  <svg className="chev" width="8" height="13" viewBox="0 0 8 13" aria-hidden="true">
    <path d="M1.5 1.5L6.5 6.5L1.5 11.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

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

const STATUS_LABEL = { pending: 'Pending review', approved: 'Approved', filed: 'Filed', rejected: 'Rejected' }

const Submission = ({ s, reviewer, onReview, filed, onName }) => {
  const cat = CATEGORY[s.category] || CATEGORY.other
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
          <span className={`badge ${s.status}`}>{STATUS_LABEL[s.status] || s.status}</span>
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
          {s.status === 'approved' && s.reviewedBy ? ` · approved by ${s.reviewedBy}` : ''}
          {s.status === 'rejected' && s.reviewedBy ? ` · rejected by ${s.reviewedBy}` : ''}
        </div>
        {reviewer && s.status !== 'filed' ? (
          <div className="sub-actions">
            {s.status !== 'approved' ? (
              <button type="button" className="chip small" onClick={() => onReview(s.id, 'approved')}>
                Approve
              </button>
            ) : null}
            {s.status !== 'rejected' ? (
              <button type="button" className="chip small" onClick={() => onReview(s.id, 'rejected')}>
                Reject
              </button>
            ) : null}
            {s.status !== 'pending' ? (
              <button type="button" className="chip small" onClick={() => onReview(s.id, 'pending')}>
                Undo
              </button>
            ) : null}
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

const MarketPage = ({ market, today, go, waiting, insider, view }) => {
  const ranked = rankings(market)
  const idx = indexChange(market, today)
  const idxPts = indexSeries(market, today).map((p) => p.price)
  const events = eventList(market)
  const days = closedDays(market)
  const lastClose = days.length ? days[days.length - 1] : null
  const report = lastClose ? closingReport(market, lastClose) : null
  const windowDays = rangeDays(view.range)
  const series = view.picked.map((n) => ({
    key: n,
    label: TICKER[n],
    color: `var(--c-${n})`,
    points: sliceRange(priceSeries(market, n, today), today, windowDays)
  }))
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
  const rangeLabel = (RANGES.find((r) => r.id === view.range) || RANGES[3]).label

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

      <div className="card">
        <div className="tile-label">{INDEX_NAME} Index</div>
        <div className="tile-row">
          <div>
            <div className="tile-value">{idx.now.toFixed(2)}</div>
            <div style={{ marginTop: 6 }}>
              <Delta pct={idx.pct} abs={idx.abs} />
            </div>
          </div>
          <Sparkline points={idxPts.slice(-30)} color="var(--accent)" width={110} height={44} />
        </div>
        <p className="hero-sub">Average of the five listings. Everyone opened at {fmtMoney(IPO_PRICE)}.</p>
      </div>

      {waiting && insider ? (
        <button type="button" className="row card tight" style={{ minHeight: 0 }} onClick={() => go('events')}>
          <div className="row-main">
            <div className="row-title">
              {waiting} {waiting === 1 ? 'event' : 'events'} awaiting the committee
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
            {view.range === 'all' ? 'Since IPO' : `Past ${rangeLabel.toLowerCase() === '1w' ? 'week' : rangeLabel === '1M' ? 'month' : 'year'}`}
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
            </div>
          ) : null}
        </div>
      </div>

      {insider ? (
        <>
          <details className="group plain-group" open={events.length <= 3}>
            <summary className="group-head">
              <span className="group-label">Filings</span>
              <span className="group-label" style={{ textTransform: 'none', letterSpacing: 0 }}>
                {events.length} on record · tap to {events.length <= 3 ? 'hide' : 'show'}
              </span>
            </summary>
            <div className="list">
              {events.length ? (
                events.slice(0, 8).map((e) => <Filing key={e.key} e={e} onName={(n) => go(`t/${n}`)} />)
              ) : (
                <div className="empty">
                  No filings yet. The board opened at {fmtMoney(IPO_PRICE)} across the board on{' '}
                  {fmtDay(market.ipo, { weekday: 'long', month: 'long', day: 'numeric' })}.
                </div>
              )}
              {events.length > 8 ? (
                <button type="button" className="row" onClick={() => go('events')}>
                  <div className="row-main">
                    <div className="row-title">All {events.length} filings</div>
                  </div>
                  <Chevron />
                </button>
              ) : null}
            </div>
          </details>
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
          <div className="stat-label">Filings</div>
          <div className="stat-value">{st.filings}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Quiet for</div>
          <div className="stat-value">
            {idle} {idle === 1 ? 'day' : 'days'}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Last filing</div>
          <div className="stat-value">{own.length ? fmtDay(own[0].day) : 'None'}</div>
        </div>
      </div>

      <button type="button" className="primary slim" onClick={() => go(`report/${name}`)}>
        Report something about {name}
      </button>

      {insider ? (
        <div className="group">
          <div className="group-head">
            <span className="group-label">Filings</span>
          </div>
          <div className="list">
            {own.length ? own.map((e) => <Filing key={e.key} e={e} showName={false} />) : <div className="empty">No filings on record. A clean sheet, so far.</div>}
          </div>
        </div>
      ) : null}

      <p className="footnote center">Report something about {name} and the committee rules on it at the close.</p>
    </div>
  )
}

const EventsPage = ({ market, subs, reviewer, onReview, dbError, go, account, insider }) => {
  const events = eventList(market)
  const pending = subs.filter((s) => s.status === 'pending')
  const approved = subs.filter((s) => s.status === 'approved')
  const resolved = subs.filter((s) => s.status === 'filed' || s.status === 'rejected')
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

      {reviewer ? (
        <div className="card tight">
          <div className="row-title">Committee desk</div>
          <div className="row-sub" style={{ whiteSpace: 'normal' }}>
            {pending.length} pending your review · {approved.length} approved and waiting for the committee's ruling
          </div>
        </div>
      ) : null}

      {pending.length ? (
        <div className="group">
          <div className="group-head">
            <span className="group-label">Awaiting review</span>
            <span className="group-label" style={{ textTransform: 'none', letterSpacing: 0 }}>
              {pending.length}
            </span>
          </div>
          <div className="list">
            {pending.map((s) => (
              <Submission key={s.id} s={s} reviewer={reviewer} onReview={onReview} onName={(n) => go(`t/${n}`)} />
            ))}
          </div>
        </div>
      ) : null}

      {approved.length ? (
        <div className="group">
          <div className="group-head">
            <span className="group-label">Approved · awaiting the ruling</span>
            <span className="group-label" style={{ textTransform: 'none', letterSpacing: 0 }}>
              {approved.length}
            </span>
          </div>
          <div className="list">
            {approved.map((s) => (
              <Submission key={s.id} s={s} reviewer={reviewer} onReview={onReview} onName={(n) => go(`t/${n}`)} />
            ))}
          </div>
        </div>
      ) : null}

      {!pending.length && !approved.length && !dbError ? (
        <div className="list">
          <div className="empty">Nothing waiting on the committee. Something happen? Report it above.</div>
        </div>
      ) : null}

      <div className="group">
        <div className="group-head">
          <span className="group-label">Filings</span>
          <span className="group-label" style={{ textTransform: 'none', letterSpacing: 0 }}>
            {events.length} on record
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

      {resolved.length ? (
        <details className="plain">
          <summary>
            {resolved.length} resolved {resolved.length === 1 ? 'submission' : 'submissions'}
          </summary>
          <div className="list" style={{ marginTop: 8 }}>
            {resolved.map((s) => (
              <Submission key={s.id} s={s} reviewer={reviewer} onReview={onReview} filed={filedBy[s.id]} onName={(n) => go(`t/${n}`)} />
            ))}
          </div>
        </details>
      ) : null}

      <div className="list">
        <AccountRow account={account} />
      </div>
      {account.error ? <div className="banner">{account.error}</div> : null}
      <p className="footnote center">
        Anyone can report. {REVIEWER} confirms the day's reports; the committee rules on the confirmed ones and the
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
        at: new Date().toISOString(),
        status: 'pending'
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
        It posts right away as pending. {REVIEWER} confirms it, the committee rules on it, and the price moves at the
        close.
      </p>
    </form>
  )
}

const AboutPage = ({ theme, setTheme, onShare, insider }) => (
  <div className="stack">
    <div className="card rules">
      <h3>How the exchange works</h3>
      <p>
        Five listings, one per roommate. Everyone opened at {fmtMoney(IPO_PRICE)} on{' '}
        {fmtDay(IPO, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}. A listing is the market's
        read on that roommate at any given moment. Sometimes it runs hot, sometimes it does not.
      </p>
      <p>
        Prices move on <strong>material events</strong>. Anyone reports one on the Events tab. {REVIEWER} confirms
        the day's reports, the committee weighs each one against the listing's history and what it means for it, and
        the board moves at the close.
      </p>
      <p className="muted">
        How much any event is worth is for the committee to decide. Rulings are published to the household with their
        reasoning and are final.
      </p>
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

    <div className="list">
      <button type="button" className="row" onClick={onShare}>
        <div className="row-main">
          <div className="row-title">Share the exchange</div>
          <div className="row-sub">Send the link to anyone who should be watching</div>
        </div>
        <Chevron />
      </button>
      {insider ? (
        <a className="row" href={COUCH_URL} style={{ textDecoration: 'none' }}>
          <div className="row-main">
            <div className="row-title">Open the Couch App</div>
            <div className="row-sub">Roommates only</div>
          </div>
          <Chevron />
        </a>
      ) : null}
    </div>

    <p className="footnote build-stamp">449 Exchange · Build {typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev'}</p>
  </div>
)

/* ---------- app ---------- */

export default function Exchange() {
  const [route, go] = useRoute()
  const today = useToday()
  useMinute()
  const [photos, setPhotos] = useState({})
  const [theme, setTheme] = useState(() => load('couch.theme', 'auto'))
  const [toast, setToast] = useState('')
  const [rawSubs, setRawSubs] = useState({})
  const [dbError, setDbError] = useState(null)
  const bodyRef = useRef(null)
  const marketView = useChartView('market')
  const tickerView = useChartView('ticker')

  // Google sign-in. A signed-in account that claimed a roommate in the Couch
  // App is that roommate here too: roommates see the events, the reviewer acts.
  const [user, setUser] = useState(null)
  const [member, setMember] = useState(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const me = member ? member.name : ''
  const insider = (DEMO && !OUTSIDER) || !!member
  const reviewer = (DEMO && !OUTSIDER) || (!!member && member.name === REVIEWER)

  useEffect(() => {
    getRedirectResult(auth).catch((e) => setAuthError(describeAuthError(e)))
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u || null))
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) {
      setMember(null)
      return undefined
    }
    const unsubscribe = onValue(
      ref(db, `members/${user.uid}`),
      (snap) => setMember(snap.exists() ? snap.val() : null),
      () => setMember(null)
    )
    return () => unsubscribe()
  }, [user])

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

  // submitted events live in the shared database so everyone sees them land
  useEffect(() => {
    if (DEMO) {
      setRawSubs(source.submissions)
      return undefined
    }
    const unsubscribe = onValue(
      ref(db, 'exchange/submissions'),
      (snap) => {
        setRawSubs(snap.exists() ? snap.val() : {})
        setDbError(null)
      },
      (error) => setDbError({ kind: 'read', message: error && error.message })
    )
    return () => unsubscribe()
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

  // a submission the ledger has ruled on is filed, whatever its stored status
  const filedRefs = useMemo(() => new Set(market.events.map((e) => e.ref).filter(Boolean)), [market])
  const subs = useMemo(
    () =>
      Object.entries(rawSubs || {})
        .map(([id, s]) => ({ ...s, id, status: filedRefs.has(id) ? 'filed' : s.status || 'pending' }))
        .filter((s) => namesOf(s).length)
        .sort((a, b) => (b.at || '').localeCompare(a.at || '')),
    [rawSubs, filedRefs]
  )
  const waiting = subs.filter((s) => s.status === 'pending' || s.status === 'approved').length

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

  const review = async (id, status) => {
    const patch = { status, reviewedBy: me || (DEMO ? REVIEWER : 'reviewer'), reviewedAt: new Date().toISOString() }
    if (DEMO) {
      setRawSubs((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
      return
    }
    try {
      await update(ref(db, `exchange/submissions/${id}`), patch)
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
  const tab = page === 'events' || reporting ? 'events' : page === 'about' ? 'about' : 'market'
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
        <h1>{tab === 'events' ? 'Events' : tab === 'about' ? 'About' : 'Market'}</h1>
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
        <header className="x-head">{header}</header>
        <main className="x-body" ref={bodyRef}>
          {tickerName ? (
            <TickerPage market={market} today={today} name={tickerName} go={go} insider={insider} view={tickerView} />
          ) : reporting ? (
            <ReportPage market={market} today={today} account={account} preset={route.arg} onSubmit={submitEvent} go={go} dbError={dbError} />
          ) : tab === 'events' ? (
            <EventsPage market={market} subs={subs} reviewer={reviewer} onReview={review} dbError={dbError} go={go} account={account} insider={insider} />
          ) : tab === 'about' ? (
            <AboutPage theme={theme} setTheme={setTheme} onShare={share} insider={insider} />
          ) : (
            <MarketPage market={market} today={today} go={go} waiting={waiting} insider={insider} view={marketView} />
          )}
        </main>
        <nav className="x-tabbar">
          {[
            { key: 'market', label: 'Market', path: '' },
            { key: 'events', label: 'Events', path: 'events' },
            { key: 'about', label: 'About', path: 'about' }
          ].map((t) => {
            const on = tab === t.key && !tickerName
            return (
              <button key={t.key} type="button" className={`tab${on ? ' on' : ''}`} onClick={() => go(t.path)}>
                <TabIcon kind={t.key} active={on} />
                {t.key === 'events' && reviewer && subs.some((s) => s.status === 'pending') ? (
                  <i className="tab-dot" aria-label="Events waiting for review" />
                ) : null}
                <span>{t.label}</span>
              </button>
            )
          })}
        </nav>
        {toast ? <div className="toast">{toast}</div> : null}
      </div>
    </PhotoContext.Provider>
  )
}
