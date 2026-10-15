import { useState, useEffect, useMemo, useRef, createContext, useContext } from 'react'
import { db } from '../firebase'
import { ref, onValue } from 'firebase/database'
import { ROOMMATES, NAMES, COLOR, INK } from '../roommates.js'
import { IPO, LEDGER } from './ledger.js'
import {
  TICKER,
  INDEX_NAME,
  IPO_PRICE,
  EVENT_TYPES,
  NOISE,
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
  indexValue,
  indexChange,
  dayChange,
  rankings,
  eventList,
  tickerStats,
  closedDays,
  closingReport,
  dayElapsed
} from './market.js'
import { Sparkline, PriceChart, MultiChart } from './charts.jsx'

/* ---------- demo data (?demo in the URL) ---------- */

// two weeks of made-up filings so the board can be previewed with history
const DEMO = typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo')

const DEMO_NOTES = {
  girlfriend: 'Instagram-official as of this evening.',
  'first-kiss': 'Confirmed by two witnesses on the balcony.',
  date: 'Dinner downtown. Home by eleven.',
  number: 'Obtained at the farmers market, unprompted.',
  ghosted: 'Last message delivered, unread, six days.',
  dumped: 'Over text. The household is in mourning.',
  'big-w': 'Offer letter signed.',
  gym: 'New bench PR, witnessed.',
  hungover: 'Emerged at 1:40 PM asking for Gatorade.',
  'big-l': 'Parking ticket plus a flat tire in the same hour.',
  cooked: 'Chicken parm for five. Leftovers for none.',
  dishes: 'Entire sink, no announcement.',
  'couch-date': 'Couch reserved 7 to 10 PM. Movie unknown.',
  mess: 'Three days of mugs on the coffee table.',
  durf: 'Durfed in front of guests.'
}

const demoLedger = (today) => {
  const ipo = addDays(today, -13)
  let s = 11
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
  const types = EVENT_TYPES.filter((t) => t.id !== 'other')
  const out = []
  for (let d = ipo; d <= today; d = addDays(d, 1)) {
    const r = rnd()
    const count = r < 0.45 ? 1 : r < 0.65 ? 2 : 0
    for (let i = 0; i < count; i++) {
      const t = types[Math.floor(rnd() * types.length)]
      out.push({
        day: d,
        name: NAMES[Math.floor(rnd() * NAMES.length)],
        type: t.id,
        note: DEMO_NOTES[t.id] || '',
        verdict: 'Standard impact applied; the facts matched the guide.',
        by: NAMES[Math.floor(rnd() * NAMES.length)]
      })
    }
  }
  return { ipo, ledger: out }
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

// a counter that advances every half minute, so the countdown and the live
// drift keep moving while the page sits open
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

const TabIcon = ({ kind, active }) => {
  const s = active ? 'var(--accent)' : 'var(--tab-idle)'
  if (kind === 'market')
    return (
      <svg width="25" height="25" viewBox="0 0 26 26" aria-hidden="true">
        <path d="M3.5 19.5l5.5-7 4 4 5-8 4.5 4.5" fill="none" stroke={s} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3.5 22.5h19" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  if (kind === 'filings')
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

/* ---------- pages ---------- */

const MarketPage = ({ market, today, go }) => {
  const ranked = rankings(market)
  const idx = indexChange(market, today)
  const idxPts = indexSeries(market, today).map((p) => p.price)
  const events = eventList(market)
  const days = closedDays(market)
  const lastClose = days.length ? days[days.length - 1] : null
  const report = lastClose ? closingReport(market, lastClose) : null
  const multi = NAMES.map((n) => ({
    key: n,
    label: TICKER[n],
    color: `var(--c-${n})`,
    points: priceSeries(market, n, today)
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
          <Sparkline points={idxPts} color="var(--accent)" width={110} height={44} />
        </div>
        <p className="hero-sub">
          Average of the five listings · combined market cap {fmtCap(NAMES.reduce((s, n) => s + marketCap(market.live[n]), 0))}
        </p>
      </div>

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
            <button type="button" className="link" onClick={() => go('filings')}>
              See all
            </button>
          ) : null}
        </div>
        <div className="list">
          {events.length ? (
            events.slice(0, 3).map((e) => <Filing key={e.key} e={e} onName={(n) => go(`t/${n}`)} />)
          ) : (
            <div className="empty">
              No filings yet. The board opened at {fmtMoney(IPO_PRICE)} across the board on {fmtDay(market.ipo, { weekday: 'long', month: 'long', day: 'numeric' })}.
              <br />
              Something happen? Report it to the committee.
            </div>
          )}
        </div>
      </div>

      <Report report={report} />

      <p className="footnote center">
        Prices are set by the Exchange's pricing committee from events reported by the household. Between filings the
        board drifts up to ±{(NOISE * 100).toFixed(2)}% a day on market noise.
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
          <div className="stat-label">Days listed</div>
          <div className="stat-value">{st.daysListed}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Shares</div>
          <div className="stat-value">{SHARES.toLocaleString('en-US')}</div>
        </div>
      </div>

      <div className="group">
        <div className="group-head">
          <span className="group-label">Filings</span>
        </div>
        <div className="list">
          {own.length ? (
            own.map((e) => <Filing key={e.key} e={e} showName={false} />)
          ) : (
            <div className="empty">No filings on record. A clean sheet, so far.</div>
          )}
        </div>
      </div>

      <p className="footnote center">
        Shares outstanding: {SHARES.toLocaleString('en-US')}. Report something about {name} to the committee and the
        board moves with the next release.
      </p>
    </div>
  )
}

const FilingsPage = ({ market, go }) => {
  const events = eventList(market)
  const byDay = []
  events.forEach((e) => {
    const last = byDay[byDay.length - 1]
    if (last && last.day === e.day) last.items.push(e)
    else byDay.push({ day: e.day, items: [e] })
  })
  return (
    <div className="stack">
      <div className="card">
        <h3 style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.3 }}>How a filing happens</h3>
        <p className="report-lede" style={{ marginTop: 6 }}>
          Something happens to a roommate. Someone tells the committee. The committee rules on how big a deal it is,
          publishes the filing with its reasoning, and the price moves. Rulings are final and occasionally petty.
        </p>
      </div>
      {byDay.length ? (
        byDay.map((g) => (
          <div key={g.day} className="group">
            <div className="group-head">
              <span className="group-label">{fmtDay(g.day, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
              <span className="group-label" style={{ textTransform: 'none', letterSpacing: 0 }}>
                {g.items.length} {g.items.length === 1 ? 'filing' : 'filings'}
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
  )
}

const AboutPage = ({ theme, setTheme, onShare }) => (
  <div className="stack">
    <div className="card rules">
      <h3>How the exchange works</h3>
      <p>
        Five listings, one per roommate. Everyone opened at {fmtMoney(IPO_PRICE)} on{' '}
        {fmtDay(IPO, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}, with{' '}
        {SHARES.toLocaleString('en-US')} shares outstanding each.
      </p>
      <p>
        Prices move on <strong>material events</strong>. Report what happened to the committee; it rules on the
        impact, files the event with its reasoning, and the board updates with the next release.
      </p>
      <p>
        Between filings, each listing drifts up to ±{(NOISE * 100).toFixed(2)}% a day on market noise, so the chart
        breathes even on a quiet week. The drift is deterministic: every phone sees the same board.
      </p>
      <p className="muted">
        No single filing may move a listing more than {PCT_LIMIT}%. No listing trades below $1.00. The committee may
        depart from the guide below when the facts warrant it, and says so in the filing.
      </p>
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
                <td style={{ color: t.pct > 0 ? 'var(--up)' : t.pct < 0 ? 'var(--down)' : undefined }}>{fmtPct(t.pct, 0)}</td>
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

    <p className="footnote build-stamp">
      449 Exchange · Build {typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev'}
    </p>
  </div>
)

/* ---------- app ---------- */

export default function Exchange() {
  const [route, go] = useRoute()
  const today = useToday()
  const tick = useMinute()
  const [photos, setPhotos] = useState({})
  const [theme, setTheme] = useState(() => load('couch.theme', 'auto'))
  const [toast, setToast] = useState('')
  const bodyRef = useRef(null)

  const source = useMemo(() => (DEMO ? demoLedger(today) : { ipo: IPO, ledger: LEDGER }), [today])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const market = useMemo(() => buildMarket(source.ledger, source.ipo, today, dayElapsed()), [source, today, tick])

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'auto') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('couch.theme', theme)
    } catch {}
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
  const tab = page === 'filings' ? 'filings' : page === 'about' ? 'about' : 'market'
  const mins = minutesToClose()
  const closesIn = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`

  const header = tickerName ? (
    <div className="head-row">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" className="back" onClick={() => go('')} aria-label="Back to the market">
          <svg width="9" height="15" viewBox="0 0 9 15" aria-hidden="true">
            <path d="M7 1.5L1.5 7.5L7 13.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Market
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ textAlign: 'right' }}>
          <h1 style={{ fontSize: 22 }}>{tickerName}</h1>
          <div className="ticker-sym">{TICKER[tickerName]}</div>
        </div>
        <Avatar name={tickerName} size={44} />
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
        <h1>{tab === 'filings' ? 'Filings' : tab === 'about' ? 'About' : 'Market'}</h1>
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
          ) : tab === 'filings' ? (
            <FilingsPage market={market} go={go} />
          ) : tab === 'about' ? (
            <AboutPage theme={theme} setTheme={setTheme} onShare={share} />
          ) : (
            <MarketPage market={market} today={today} go={go} />
          )}
        </main>
        <nav className="x-tabbar">
          {[
            { key: 'market', label: 'Market', path: '' },
            { key: 'filings', label: 'Filings', path: 'filings' },
            { key: 'about', label: 'About', path: 'about' }
          ].map((t) => (
            <button key={t.key} type="button" className={`tab${tab === t.key && !tickerName ? ' on' : ''}`} onClick={() => go(t.path)}>
              <TabIcon kind={t.key} active={tab === t.key && !tickerName} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
        {toast ? <div className="toast">{toast}</div> : null}
      </div>
    </PhotoContext.Provider>
  )
}
