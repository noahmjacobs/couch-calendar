import { useState, useEffect, useMemo, useRef, createContext, useContext } from 'react'
import { db } from '../firebase'
import { ref, onValue, push, update } from 'firebase/database'
import { NAMES, COLOR, INK } from '../roommates.js'
import { IPO, LEDGER } from './ledger.js'
import {
  TICKER,
  INDEX_NAME,
  IPO_PRICE,
  EVENT_TYPES,
  DATING,
  IDLE_GRACE_DAYS,
  IDLE_DECAY,
  IDLE_SPAN_DAYS,
  PCT_LIMIT,
  SHARES,
  dateKey,
  addDays,
  fmtDay,
  fmtMoney,
  fmtPct,
  fmtSigned,
  fmtCap,
  marketCap,
  buildMarket,
  priceSeries,
  indexSeries,
  indexChange,
  dayChange,
  rankings,
  eventList,
  tickerStats,
  closedDays,
  closingReport
} from './market.js'
import { Sparkline, PriceChart, MultiChart } from './charts.jsx'

/* ---------- what people can report ---------- */

const CATEGORIES = [
  { id: 'date', label: 'Date', emoji: '🌹' },
  { id: 'romance', label: 'Romance', emoji: '💘' },
  { id: 'life', label: 'Life', emoji: '🏆' },
  { id: 'apartment', label: 'Apartment', emoji: '🧽' },
  { id: 'other', label: 'Other', emoji: '📝' }
]
const CATEGORY = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]))

// the household's reviewer. Honor system: the exchange trusts the name the
// Couch App signed this phone in as.
const REVIEWER = 'Noah'

/* ---------- demo data (?demo in the URL) ---------- */

const DEMO = typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo')

const demoData = (today) => {
  const ipo = addDays(today, -40)
  const d = (n) => addDays(ipo, n)
  const ledger = [
    { day: d(7), name: 'Jonas', type: 'date', partner: 'Maya', note: 'Dinner downtown. Home by eleven.', verdict: 'A clean first date after a quiet week. Full credit.', by: 'Noah' },
    { day: d(10), name: 'Jonas', type: 'date', partner: 'Maya', note: 'Second dinner. Same restaurant, which the committee notes.', verdict: 'Momentum.', by: 'Andrew' },
    { day: d(12), name: 'Andrew', type: 'big-w', note: 'Offer letter signed.', verdict: 'Standard impact.', by: 'Noah' },
    { day: d(15), name: 'Jonas', type: 'date', partner: 'Maya', note: 'Hike. She brought snacks.', verdict: 'Third date inside two weeks.', by: 'Noah' },
    { day: d(16), name: 'Bryon', type: 'date', partner: 'Sam', note: 'Coffee that turned into dinner.', verdict: 'First date on record.', by: 'James' },
    { day: d(19), name: 'Bryon', type: 'date', partner: 'Lena', note: 'From the app. Bowling.', verdict: 'Three days after Sam. The ladder is unsentimental.', by: 'James' },
    { day: d(20), name: 'James', type: 'hungover', note: 'Emerged at 1:40 PM asking for Gatorade.', verdict: 'Standard impact.', by: 'Bryon' },
    { day: d(22), name: 'Jonas', type: 'girlfriend', note: 'Instagram-official as of this evening.', verdict: 'The ladder was climbed in order. Full marks.', by: 'Noah' },
    { day: d(28), name: 'Andrew', type: 'mess', note: 'Three days of mugs on the coffee table.', verdict: 'Standard impact.', by: 'Jonas' },
    { day: d(31), name: 'Noah', type: 'cooked', note: 'Chicken parm for five. Leftovers for none.', verdict: 'Standard impact.', by: 'Bryon' },
    { day: d(37), name: 'James', type: 'ghosted', note: 'Last message delivered, unread, six days.', verdict: 'Standard impact.', by: 'Andrew' },
    { day: d(39), name: 'Noah', type: 'date', partner: 'Priya', note: 'Museum, then tacos.', verdict: 'First date after a long quiet spell.', by: 'Jonas', ref: 'demo-s4' }
  ]
  const submissions = {
    'demo-s1': { name: 'James', category: 'apartment', text: 'Did every dish in the sink without being asked.', day: today, by: 'Bryon', at: `${today}T18:20:00.000Z`, status: 'pending' },
    'demo-s2': { name: 'Andrew', category: 'romance', text: 'Got a number at the farmers market. Unprompted.', day: addDays(today, -1), by: 'Noah', at: `${addDays(today, -1)}T21:02:00.000Z`, status: 'approved' },
    'demo-s3': { name: 'Noah', category: 'other', text: 'Noah is simply the best roommate and deserves +40%.', day: addDays(today, -3), by: 'Anonymous', at: `${addDays(today, -3)}T23:40:00.000Z`, status: 'rejected' },
    'demo-s4': { name: 'Noah', category: 'date', partner: 'Priya', text: 'Museum, then tacos.', day: d(39), by: 'Jonas', at: `${d(39)}T22:10:00.000Z`, status: 'approved' }
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
      {e.auto ? (
        <div className="filing-note" style={{ color: 'var(--ink-2)' }}>
          <strong>Ladder:</strong> {e.auto}
        </div>
      ) : null}
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

const Submission = ({ s, reviewer, onReview, filedEvent, onName }) => {
  const cat = CATEGORY[s.category] || CATEGORY.other
  return (
    <div className="sub">
      <Avatar name={s.name} size={36} />
      <div className="sub-main">
        <div className="sub-title">
          <button type="button" className="link" style={{ font: 'inherit', fontWeight: 600 }} onClick={() => onName && onName(s.name)}>
            {s.name}
          </button>
          <span style={{ color: 'var(--ink-2)', fontWeight: 500 }}>
            {cat.emoji} {cat.label}
            {s.category === 'date' && s.partner ? ` with ${s.partner}` : ''}
          </span>
          <span className={`badge ${s.status}`}>{STATUS_LABEL[s.status] || s.status}</span>
          {filedEvent ? <Delta pct={filedEvent.pct} /> : null}
        </div>
        <div className="sub-text">{s.text}</div>
        <div className="sub-meta">
          {fmtDay(s.day, { weekday: 'short', month: 'short', day: 'numeric' })} · reported by {s.by || 'Anonymous'}
          {s.status === 'approved' && s.reviewedBy ? ` · approved by ${s.reviewedBy}` : ''}
          {s.status === 'rejected' && s.reviewedBy ? ` · rejected by ${s.reviewedBy}` : ''}
        </div>
        {reviewer && (s.status === 'pending' || s.status === 'approved' || s.status === 'rejected') ? (
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
      {error.message ? ` (${error.message})` : ''}. The Firebase rules need an <code>exchange</code> entry alongside{' '}
      <code>reservations</code>, with read and write allowed.
    </div>
  ) : null

/* ---------- pages ---------- */

const MarketPage = ({ market, today, go, waiting }) => {
  const ranked = rankings(market)
  const idx = indexChange(market, today)
  const idxPts = indexSeries(market, today).map((p) => p.price)
  const events = eventList(market)
  const days = closedDays(market)
  const lastClose = days.length ? days[days.length - 1] : null
  const report = lastClose ? closingReport(market, lastClose) : null
  const multi = NAMES.map((n) => ({ key: n, label: TICKER[n], color: `var(--c-${n})`, points: priceSeries(market, n, today) }))
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
        <p className="hero-sub">
          Average of the five listings · combined market cap {fmtCap(NAMES.reduce((s, n) => s + marketCap(market.live[n]), 0))}
        </p>
      </div>

      {waiting ? (
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
          <span className="group-label">All listings</span>
          <span className="group-label" style={{ textTransform: 'none', letterSpacing: 0 }}>
            Since IPO
          </span>
        </div>
        <div className="card tight">
          <MultiChart series={multi} />
          <div className="legend">
            {NAMES.map((n) => (
              <span key={n} className="legend-item">
                <i style={{ background: `var(--c-${n})` }} />
                <Avatar name={n} size={18} />
                {n}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="group">
        <div className="group-head">
          <span className="group-label">Latest filings</span>
          {events.length > 3 ? (
            <button type="button" className="link" onClick={() => go('events')}>
              See all
            </button>
          ) : null}
        </div>
        <div className="list">
          {events.length ? (
            events.slice(0, 3).map((e) => <Filing key={e.key} e={e} onName={(n) => go(`t/${n}`)} />)
          ) : (
            <div className="empty">
              No filings yet. The board opened at {fmtMoney(IPO_PRICE)} across the board on{' '}
              {fmtDay(market.ipo, { weekday: 'long', month: 'long', day: 'numeric' })}.
              <br />
              Something happen? Report it on the Events tab.
            </div>
          )}
        </div>
      </div>

      <Report report={report} />

      <p className="footnote center">
        Nothing moves without a filing. A listing that goes {IDLE_GRACE_DAYS} days without one depreciates{' '}
        {(IDLE_DECAY * 100).toFixed(1)}% a day until something happens.
      </p>
    </div>
  )
}

const TickerPage = ({ market, today, name, go }) => {
  const ch = dayChange(market, name, today)
  const st = tickerStats(market, name, today)
  const series = priceSeries(market, name, today)
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
        <p className="hero-sub">
          {firstDay ? 'Today, since the IPO' : "Today, vs yesterday's close"} · market cap {fmtCap(marketCap(market.live[name]))}
        </p>
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
          <div className="stat-value" style={{ color: idle >= IDLE_GRACE_DAYS ? 'var(--down)' : undefined }}>
            {idle} {idle === 1 ? 'day' : 'days'}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Days listed</div>
          <div className="stat-value">{st.daysListed}</div>
        </div>
      </div>

      <button type="button" className="primary slim" onClick={() => go(`report/${name}`)}>
        Report something about {name}
      </button>

      <div className="group">
        <div className="group-head">
          <span className="group-label">Filings</span>
        </div>
        <div className="list">
          {own.length ? own.map((e) => <Filing key={e.key} e={e} showName={false} />) : <div className="empty">No filings on record. A clean sheet, so far.</div>}
        </div>
      </div>

      <p className="footnote center">
        {idle >= IDLE_GRACE_DAYS
          ? `${TICKER[name]} has been quiet for ${idle} days and is depreciating. A filing stops it.`
          : `${TICKER[name]} starts depreciating after ${IDLE_GRACE_DAYS} quiet days. ${IDLE_GRACE_DAYS - idle} to go.`}
      </p>
    </div>
  )
}

const EventsPage = ({ market, subs, reviewer, onReview, dbError, go, today, onToast }) => {
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
  const filedBy = Object.fromEntries(events.filter((e) => e.ref).map((e) => [e.ref, e]))

  const exportText = () => {
    const lines = [`449 Exchange · events for the committee · as of ${fmtDay(today, { weekday: 'short', month: 'short', day: 'numeric' })}`, '']
    if (!approved.length) lines.push('No approved events waiting.')
    approved.forEach((s, i) => {
      const cat = CATEGORY[s.category] || CATEGORY.other
      lines.push(
        `${i + 1}. [${s.id}] ${s.day} · ${s.name} · ${cat.label}${s.category === 'date' && s.partner ? ` with ${s.partner}` : ''}`,
        `   "${s.text}" — reported by ${s.by || 'Anonymous'}`
      )
    })
    if (pending.length) lines.push('', `${pending.length} still pending review.`)
    return lines.join('\n')
  }

  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportText())
      onToast('Copied for the committee')
    } catch {
      onToast('Could not copy')
    }
  }

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
            {pending.length} pending · {approved.length} approved and waiting for a ruling
          </div>
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button type="button" className="chip" onClick={copyExport} disabled={!approved.length && !pending.length}>
              Copy approved events
            </button>
          </div>
          {approved.length ? (
            <details className="plain" style={{ marginTop: 8 }}>
              <summary>Preview the export</summary>
              <div className="export">{exportText()}</div>
            </details>
          ) : null}
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
              <Submission key={s.id} s={s} reviewer={reviewer} onReview={onReview} filedEvent={filedBy[s.id]} onName={(n) => go(`t/${n}`)} />
            ))}
          </div>
        </details>
      ) : null}

      <p className="footnote center">
        Anyone can report. {REVIEWER} confirms the day's reports; the committee rules on the confirmed ones and the
        board moves at the close.
      </p>
    </div>
  )
}

const ReportPage = ({ market, today, me, preset, onSubmit, go, dbError }) => {
  const [name, setName] = useState(NAMES.includes(preset) ? preset : '')
  const [category, setCategory] = useState('')
  const [partner, setPartner] = useState('')
  const [text, setText] = useState('')
  const [day, setDay] = useState(today)
  const [by, setBy] = useState(() => me || load('exchange.reporter', ''))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ready = name && category && text.trim().length >= 3 && day >= market.ipo && day <= today

  const submit = async (e) => {
    e.preventDefault()
    if (!ready || busy) return
    setBusy(true)
    setError('')
    try {
      const who = by.trim() || 'Anonymous'
      save('exchange.reporter', by.trim())
      await onSubmit({
        name,
        category,
        partner: category === 'date' ? partner.trim() : '',
        text: text.trim(),
        day,
        by: who,
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
        <span className="field-label">Listing</span>
        <div className="chips">
          {NAMES.map((n) => (
            <button
              key={n}
              type="button"
              className={`chip who-chip${name === n ? ' on' : ''}`}
              style={{ '--chip-bg': COLOR[n], '--chip-ink': INK[n] }}
              onClick={() => setName(n)}
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
          <input
            className="input"
            type="text"
            placeholder="With whom? A name or initials (the ladder tracks repeat dates)"
            value={partner}
            onChange={(e) => setPartner(e.target.value)}
          />
        ) : null}
      </div>

      <div className="field">
        <span className="field-label">What happened</span>
        <textarea
          className="input"
          placeholder={name ? `What did ${name} do?` : 'What happened, in a sentence or two'}
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
        <input className="input" type="text" placeholder="Your name (or stay anonymous)" value={by} onChange={(e) => setBy(e.target.value)} />
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

const AboutPage = ({ theme, setTheme, onShare }) => (
  <div className="stack">
    <div className="card rules">
      <h3>How the exchange works</h3>
      <p>
        Five listings, one per roommate. Everyone opened at {fmtMoney(IPO_PRICE)} on{' '}
        {fmtDay(IPO, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}, with {SHARES.toLocaleString('en-US')}{' '}
        shares outstanding each.
      </p>
      <p>
        Prices move on <strong>material events</strong>. Anyone reports one on the Events tab. {REVIEWER} confirms the
        day's reports, the committee rules on the confirmed ones, and the board moves at the close.
      </p>
      <p>
        Nothing happens, nothing moves. But a listing that goes <strong>{IDLE_GRACE_DAYS} days</strong> without a filing
        depreciates {(IDLE_DECAY * 100).toFixed(1)}% a day for up to {IDLE_SPAN_DAYS} days (about{' '}
        {Math.round((1 - Math.pow(1 - IDLE_DECAY, IDLE_SPAN_DAYS)) * 100)}% in all), then levels off until something
        happens.
      </p>
      <p className="muted">
        No single filing may move a listing more than {PCT_LIMIT}%. No listing trades below $1.00. The committee may
        depart from the guides below when the facts warrant it, and says so in the filing.
      </p>
    </div>

    <div className="group">
      <div className="group-head">
        <span className="group-label">The dating ladder</span>
      </div>
      <div className="card tight">
        <table className="ladder">
          <tbody>
            <tr>
              <td>
                First date
                <span className="muted">Nobody else in the past {DATING.jugglingWindow} days</span>
              </td>
              <td style={{ color: 'var(--up)' }}>{fmtPct(DATING.first, 0)}</td>
            </tr>
            <tr>
              <td>
                First date, juggling
                <span className="muted">Someone new within {DATING.jugglingWindow} days of a date with someone else</span>
              </td>
              <td style={{ color: 'var(--up)' }}>{fmtPct(DATING.juggling, 0)}</td>
            </tr>
            <tr>
              <td>
                Second date, same person
                <span className="muted">Within {DATING.momentumWindow} days of the first</span>
              </td>
              <td style={{ color: 'var(--up)' }}>{fmtPct(DATING.second, 0)}</td>
            </tr>
            <tr>
              <td>
                Third date
                <span className="muted">Still inside the window</span>
              </td>
              <td style={{ color: 'var(--up)' }}>{fmtPct(DATING.third, 0)}</td>
            </tr>
            <tr>
              <td>
                Fourth date and beyond
                <span className="muted">Momentum, capped</span>
              </td>
              <td style={{ color: 'var(--up)' }}>{fmtPct(DATING.steady, 0)}</td>
            </tr>
            <tr>
              <td>
                Rekindled
                <span className="muted">A repeat date after more than {DATING.momentumWindow} days apart</span>
              </td>
              <td style={{ color: 'var(--up)' }}>{fmtPct(DATING.rekindled, 0)}</td>
            </tr>
            <tr>
              <td>
                Made it official
                <span className="muted">Filed separately, on top of the dates</span>
              </td>
              <td style={{ color: 'var(--up)' }}>{fmtPct(EVENT_TYPES.find((t) => t.id === 'girlfriend').pct, 0)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div className="group">
      <div className="group-head">
        <span className="group-label">Impact guide</span>
      </div>
      <div className="card tight">
        <table className="impact-table">
          <tbody>
            {EVENT_TYPES.filter((t) => t.id !== 'other').map((t) => (
              <tr key={t.id}>
                <td style={{ width: 30 }} aria-hidden="true">
                  {t.emoji}
                </td>
                <td>{t.label}</td>
                <td style={{ color: t.auto ? 'var(--up)' : t.pct > 0 ? 'var(--up)' : t.pct < 0 ? 'var(--down)' : undefined }}>
                  {t.auto ? `${t.range}%` : fmtPct(t.pct, 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
          Shared with the Couch App on this phone.
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
      <a className="row" href="/" style={{ textDecoration: 'none' }}>
        <div className="row-main">
          <div className="row-title">Open the Couch App</div>
          <div className="row-sub">Back to the calendar</div>
        </div>
        <Chevron />
      </a>
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

  // the roommate this phone is signed in as in the Couch App, if any
  const me = load('couch.me', '')
  const reviewer = DEMO || me === REVIEWER

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
      return
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
    if (!toast) return
    const id = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(id)
  }, [toast])

  // a submission the ledger has ruled on is filed, whatever its stored status
  const filedRefs = useMemo(() => new Set(market.events.map((e) => e.ref).filter(Boolean)), [market])
  const subs = useMemo(
    () =>
      Object.entries(rawSubs || {})
        .map(([id, s]) => ({ ...s, id, status: filedRefs.has(id) ? 'filed' : s.status || 'pending' }))
        .filter((s) => NAMES.includes(s.name))
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
    const patch = { status, reviewedBy: me || REVIEWER, reviewedAt: new Date().toISOString() }
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
    const url = `${location.origin}/exchange/`
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
            <TickerPage market={market} today={today} name={tickerName} go={go} />
          ) : reporting ? (
            <ReportPage market={market} today={today} me={me} preset={route.arg} onSubmit={submitEvent} go={go} dbError={dbError} />
          ) : tab === 'events' ? (
            <EventsPage market={market} subs={subs} reviewer={reviewer} onReview={review} dbError={dbError} go={go} today={today} onToast={setToast} />
          ) : tab === 'about' ? (
            <AboutPage theme={theme} setTheme={setTheme} onShare={share} />
          ) : (
            <MarketPage market={market} today={today} go={go} waiting={waiting} />
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
