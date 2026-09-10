import { useState, useEffect, useMemo } from 'react'
import { db } from './firebase'
import { ref, onValue, set, remove } from 'firebase/database'
import './App.css'

const ROOMMATES = [
  { name: 'Noah', color: '#0A84FF', ink: '#fff' },
  { name: 'Bryon', color: '#30D158', ink: '#0B3D1C' },
  { name: 'Jonas', color: '#FF9F0A', ink: '#4A2A00' },
  { name: 'Andrew', color: '#BF5AF2', ink: '#fff' },
  { name: 'James', color: '#FF375F', ink: '#fff' }
]
const NAMES = ROOMMATES.map((r) => r.name)
const COLOR = Object.fromEntries(ROOMMATES.map((r) => [r.name, r.color]))
const INK = Object.fromEntries(ROOMMATES.map((r) => [r.name, r.ink]))

const dateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// times are minutes from midnight, on a 15-minute grid.
// records written before this stored whole hours in hour/endHour; the readers below
// fall back to those so existing reservations keep working untouched.
const DAY_MIN = 1440
const STEP = 15

const startOf = (res) => (res.startMin != null ? res.startMin : res.hour * 60)
const endOf = (res) =>
  res.endMin != null ? res.endMin : (res.endHour != null ? res.endHour : res.hour + 1) * 60

// new records key on zero-padded minutes ("1915"); legacy ones key on the bare hour
// ("19"), and 4 characters can never collide with 1-2
const minKey = (min) => String(min).padStart(4, '0')

const fmtMin = (min) => {
  if (min >= DAY_MIN) return '12:00 AM'
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}
const shortMin = (min) => {
  if (min >= DAY_MIN) return '12 AM'
  const h = Math.floor(min / 60)
  const m = min % 60
  const ampm = h >= 12 ? 'PM' : 'AM'
  return m ? `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}` : `${h % 12 || 12} ${ampm}`
}
const rangeLabel = (a, b) => `${shortMin(a)} – ${shortMin(b)}`

const durLabel = (min) => {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (!h) return `${m} min`
  if (!m) return `${h} ${h === 1 ? 'hr' : 'hrs'}`
  return `${h} ${h === 1 ? 'hr' : 'hrs'} ${m} min`
}

// <input type="time"> speaks "HH:MM"; an end of midnight comes back as 00:00
const toTimeValue = (min) => {
  const m = min >= DAY_MIN ? 0 : min
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
const fromTimeValue = (v) => {
  const [h, m] = v.split(':').map(Number)
  return h * 60 + m
}

const mondayOf = (d) => {
  const copy = new Date(d)
  const day = copy.getDay()
  copy.setDate(copy.getDate() - day + (day === 0 ? -6 : 1))
  copy.setHours(0, 0, 0, 0)
  return copy
}

// every reservation carries its own firebase key, so deletes never re-derive it
const dayList = (dayRes) =>
  Object.entries(dayRes || {})
    .map(([key, res]) => ({ ...res, key, start: startOf(res), end: endOf(res) }))
    .sort((a, b) => a.start - b.start)

const fmtDay = (dStr) =>
  new Date(`${dStr}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const load = (key, fallback) => {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : v
  } catch {
    return fallback
  }
}

/* ---------- small pieces ---------- */

const Avatar = ({ name, size = 36 }) => (
  <div
    className="avatar"
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      background: COLOR[name] || '#8E8E93',
      color: INK[name] || '#fff',
      fontSize: Math.round(size * 0.42)
    }}
  >
    {name ? name[0] : '?'}
  </div>
)

const KindDot = ({ type }) => (
  <span className="kind">
    <i className="dot" style={{ background: type === 'date' ? '#FF2D55' : '#8E8E93' }} />
    {type === 'date' ? 'Date' : 'Event'}
  </span>
)

const Splash = ({ leaving }) => (
  <div className={`splash${leaving ? ' leaving' : ''}`}>
    <div className="splash-dots">
      {ROOMMATES.map((r) => (
        <i key={r.name} className="dot big" style={{ background: r.color }} />
      ))}
    </div>
    <div className="splash-card">
      <div className="splash-title">449 Boyos</div>
    </div>
    <div className="splash-tag">#Nodurfing</div>
    <div className="splash-foot">
      <span className="splash-bar">
        <i />
      </span>
      <span className="splash-status">CONNECTING TO THE APARTMENT</span>
    </div>
  </div>
)

/* ---------- day overview bar (read-only) ---------- */

const DayBar = ({ start, end, taken }) => {
  const pct = (min) => `${(min / DAY_MIN) * 100}%`
  return (
    <div className="bar-wrap">
      <div className="bar-track">
        {taken.map((b) => (
          <div
            key={b.key}
            className="bar-taken"
            style={{ left: pct(b.start), width: pct(b.end - b.start), background: `${b.color}47` }}
            title={`${b.name} ${fmtMin(b.start)} – ${fmtMin(b.end)}`}
          />
        ))}
        <div className="bar-sel" style={{ left: pct(start), width: pct(Math.max(end - start, 0)) }} />
      </div>
      <div className="bar-ticks">
        <span>12 AM</span>
        <span>6 AM</span>
        <span>12 PM</span>
        <span>6 PM</span>
        <span>12 AM</span>
      </div>
    </div>
  )
}

const Chevron = () => (
  <svg className="chev" width="8" height="13" viewBox="0 0 8 13" aria-hidden="true">
    <path d="M1.5 1.5L6.5 6.5L1.5 11.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const TabIcon = ({ kind, active }) => {
  const s = active ? 'var(--accent)' : 'var(--tab-idle)'
  if (kind === 'calendar')
    return (
      <svg width="25" height="25" viewBox="0 0 26 26" aria-hidden="true">
        <rect x="3.5" y="5" width="19" height="17" rx="4.5" fill="none" stroke={s} strokeWidth="1.8" />
        <path d="M3.5 10h19" stroke={s} strokeWidth="1.8" />
        <circle cx="9" cy="15.5" r="1.6" fill={s} />
        <circle cx="17" cy="15.5" r="1.6" fill={s} />
      </svg>
    )
  if (kind === 'roommates')
    return (
      <svg width="25" height="25" viewBox="0 0 26 26" aria-hidden="true">
        <circle cx="10" cy="10" r="4.2" fill="none" stroke={s} strokeWidth="1.8" />
        <circle cx="17.5" cy="12" r="3.2" fill="none" stroke={s} strokeWidth="1.8" />
        <path d="M3.5 21.5c1.4-3.4 4-5 6.5-5s5.1 1.6 6.5 5" fill="none" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  return (
    <svg width="25" height="25" viewBox="0 0 26 26" aria-hidden="true">
      <path d="M4 8h18M4 13h18M4 18h18" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="9" cy="8" r="2.6" fill="var(--tabbar-solid)" stroke={s} strokeWidth="1.8" />
      <circle cx="17" cy="18" r="2.6" fill="var(--tabbar-solid)" stroke={s} strokeWidth="1.8" />
    </svg>
  )
}

/* iOS reports a short viewport while a standalone launch is still settling, and
   again when the app is resumed from the switcher, which left a strip of the
   screen uncovered until something forced a repaint. CSS units cannot see that,
   so the height is measured here and re-measured on every event that can follow
   a cold start. */
const useAppHeight = () => {
  useEffect(() => {
    const apply = () => {
      const cands = [
        window.innerHeight,
        window.visualViewport && window.visualViewport.height,
        document.documentElement.clientHeight
      ]
      // screen.height does not swap with orientation on iOS, so only trust it
      // while we are actually portrait
      if (window.innerHeight >= window.innerWidth) cands.push(window.screen && window.screen.height)
      const h = Math.max(...cands.filter((n) => typeof n === 'number' && n > 0))
      if (h) document.documentElement.style.setProperty('--app-h', `${Math.ceil(h)}px`)
    }
    apply()
    const raf = requestAnimationFrame(apply)
    const settle = setTimeout(apply, 400)
    const events = ['resize', 'orientationchange', 'pageshow', 'focus']
    events.forEach((e) => window.addEventListener(e, apply))
    document.addEventListener('visibilitychange', apply)
    if (window.visualViewport) window.visualViewport.addEventListener('resize', apply)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(settle)
      events.forEach((e) => window.removeEventListener(e, apply))
      document.removeEventListener('visibilitychange', apply)
      if (window.visualViewport) window.visualViewport.removeEventListener('resize', apply)
    }
  }, [])
}

/* ---------- app ---------- */

export default function App() {
  useAppHeight()
  const [tab, setTab] = useState('calendar')
  const [calMode, setCalMode] = useState('day')
  const [anchor, setAnchor] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [allReservations, setAllReservations] = useState({})
  const [loading, setLoading] = useState(true)
  const [openRes, setOpenRes] = useState(null)
  const [openRm, setOpenRm] = useState(null)

  const [me, setMe] = useState(() => load('couch.me', ''))
  // partners are keyed by roommate, so switching "Your name" switches partner too
  const [partners, setPartners] = useState(() => {
    try {
      const raw = localStorage.getItem('couch.partners')
      const map = raw ? JSON.parse(raw) : {}
      // one-time carry-over from when a single partner was shared by everyone
      const legacy = localStorage.getItem('couch.partner')
      const legacyMe = localStorage.getItem('couch.me')
      if (legacy && legacyMe && map[legacyMe] == null) map[legacyMe] = legacy
      return map && typeof map === 'object' ? map : {}
    } catch {
      return {}
    }
  })
  const partner = me ? partners[me] || '' : ''
  const setPartner = (v) => {
    if (me) setPartners((prev) => ({ ...prev, [me]: v }))
  }
  const [theme, setTheme] = useState(() => load('couch.theme', 'auto'))

  const [sheet, setSheet] = useState(null) // {day, hour, endHour, type, guestName, details}
  const [splash, setSplash] = useState('in') // 'in' | 'out' | 'gone'

  useEffect(() => {
    const t1 = setTimeout(() => setSplash('out'), 3000)
    const t2 = setTimeout(() => setSplash('gone'), 3500)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  useEffect(() => {
    const resRef = ref(db, 'reservations')
    const unsubscribe = onValue(
      resRef,
      (snap) => {
        setAllReservations(snap.exists() ? snap.val() : {})
        setLoading(false)
      },
      (error) => {
        console.error('Firebase error:', error)
        setLoading(false)
      }
    )
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'auto') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('couch.theme', theme)
    } catch {}
  }, [theme])

  useEffect(() => {
    try {
      localStorage.setItem('couch.me', me)
      localStorage.setItem('couch.partners', JSON.stringify(partners))
      localStorage.removeItem('couch.partner')
    } catch {}
  }, [me, partners])

  const todayKey = dateKey(new Date())
  const weekStart = mondayOf(anchor)
  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart)
        d.setDate(d.getDate() + i)
        return d
      }),
    [weekStart.getTime()]
  )

  const navigate = (dir) => {
    const d = new Date(anchor)
    if (calMode === 'day') d.setDate(d.getDate() + dir)
    else if (calMode === 'week') d.setDate(d.getDate() + dir * 7)
    else d.setMonth(d.getMonth() + dir)
    setAnchor(d)
  }

  const openSheet = (day, startMin) => {
    if (!me) {
      setTab('settings')
      return
    }
    const start = Math.min(Math.round(startMin / STEP) * STEP, DAY_MIN - STEP)
    setSheet({
      day,
      start,
      end: Math.min(start + 120, DAY_MIN),
      type: 'event',
      guestName: partner,
      details: ''
    })
  }

  const handleReserve = async (e) => {
    e.preventDefault()
    if (!sheet) return
    const { day, start, end, type, guestName, details } = sheet
    if (end <= start) return alert('The end time has to be after the start.')
    if (type === 'date' && !guestName.trim()) return alert("Who's the date with?")
    if (type === 'event' && !details.trim()) return alert("What's the event?")

    const dStr = dateKey(day)
    const hit = dayList(allReservations[dStr]).find(
      (res) => Math.max(start, res.start) < Math.min(end, res.end)
    )
    if (hit)
      return alert(`That overlaps ${hit.name}, ${rangeLabel(hit.start, hit.end)}. Pick another time.`)

    try {
      await set(ref(db, `reservations/${dStr}/${minKey(start)}`), {
        name: me,
        type,
        details: details.trim(),
        guestName: type === 'date' ? guestName.trim() : '',
        startMin: start,
        endMin: end,
        // kept so anything still reading the old shape sees a sane whole-hour range
        hour: Math.floor(start / 60),
        endHour: Math.ceil(end / 60),
        timestamp: new Date().toISOString()
      })
      setSheet(null)
    } catch (error) {
      alert('Error making reservation: ' + error.message)
    }
  }

  const handleDelete = async (dStr, key) => {
    if (!window.confirm('Delete this reservation?')) return
    try {
      await remove(ref(db, `reservations/${dStr}/${key}`))
    } catch (error) {
      alert('Error deleting reservation: ' + error.message)
    }
  }

  /* ---------- reservation card ---------- */

  const ResCard = ({ res, dStr, compact }) => {
    const mine = res.name === me
    const id = `${dStr}-${res.key}`
    const open = openRes === id
    const showDetails = mine || open
    const detail =
      res.type === 'date'
        ? `Date with ${res.guestName || 'someone'}${res.details ? ` — ${res.details}` : ''}`
        : res.details
    return (
      <div
        className={`res-card${compact ? ' compact' : ''}`}
        style={{ '--tint': COLOR[res.name] || '#8E8E93' }}
        onClick={() => setOpenRes(open ? null : id)}
      >
        <Avatar name={res.name} size={compact ? 36 : 38} />
        <div className="res-main">
          <div className="res-top">
            <span className="res-name">{res.name}</span>
            <KindDot type={res.type} />
          </div>
          <div className="res-time">
            {fmtMin(res.start)} – {fmtMin(res.end)}
          </div>
          {showDetails && detail ? <div className="res-detail">{detail}</div> : null}
          {!showDetails ? <div className="res-hint">Tap to see details</div> : null}
          {mine && open ? (
            <button
              type="button"
              className="res-delete"
              onClick={(e) => {
                e.stopPropagation()
                handleDelete(dStr, res.key)
              }}
            >
              Delete reservation
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  /* ---------- day ---------- */

  const renderDay = () => {
    const dStr = dateKey(anchor)
    const list = dayList(allReservations[dStr])
    const rows = []
    const freeRow = (from, to) => (
      <button
        key={`f${from}`}
        type="button"
        className="free-row"
        onClick={() => openSheet(anchor, from)}
      >
        <span className="free-range">{rangeLabel(from, to)}</span>
        <span className="free-line" />
        <span className="free-word">Free</span>
      </button>
    )
    let cursor = 0
    list.forEach((res) => {
      if (res.start > cursor) rows.push(freeRow(cursor, res.start))
      rows.push(<ResCard key={res.key} res={res} dStr={dStr} />)
      cursor = Math.max(cursor, res.end)
    })
    if (cursor < DAY_MIN) rows.push(freeRow(cursor, DAY_MIN))
    const empty = Object.keys(allReservations[dStr] || {}).length === 0
    if (empty)
      return (
        <div className="empty">
          <div className="empty-badge">
            <span className="empty-ring" />
          </div>
          <div className="empty-title">The couch is all yours</div>
          <p className="empty-sub">
            Nothing booked on {anchor.toLocaleDateString('en-US', { weekday: 'long' })}. Tap Reserve to claim a
            stretch of it.
          </p>
        </div>
      )
    return <div className="stack">{rows}</div>
  }

  /* ---------- week ---------- */

  const renderWeek = () => {
    const groups = weekDays
      .map((d) => ({ d, dStr: dateKey(d), rows: dayList(allReservations[dateKey(d)]) }))
      .filter((g) => g.rows.length)
    const freeDays = weekDays
      .filter((d) => !Object.keys(allReservations[dateKey(d)] || {}).length)
      .map((d) => d.toLocaleDateString('en-US', { weekday: 'short' }))

    return (
      <div className="stack">
        {groups.map((g) => (
          <div key={g.dStr} className="group">
            <div className="group-label">
              {g.d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              {g.dStr === todayKey ? ' · Today' : ''}
            </div>
            <div className="glass-list">
              {g.rows.map((res) => (
                <ResCard key={res.key} res={res} dStr={g.dStr} compact />
              ))}
            </div>
          </div>
        ))}
        {freeDays.length ? (
          <div className="free-row static">
            <span className="free-line" />
            <span className="free-word">{freeDays.join(', ')} are free</span>
            <span className="free-line" />
          </div>
        ) : null}
      </div>
    )
  }

  /* ---------- month ---------- */

  const renderMonth = () => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
    const gridStart = mondayOf(first)
    // whole weeks, enough to reach the last of the month (5 rows usually, 6 when it spills)
    const span = Math.round((last - gridStart) / 86400000) + 1
    const cells = Array.from({ length: Math.ceil(span / 7) * 7 }, (_, i) => {
      const d = new Date(gridStart)
      d.setDate(d.getDate() + i)
      return d
    })
    const selKey = dateKey(anchor)
    const selRows = dayList(allReservations[selKey])

    return (
      <div className="stack">
        <div className="glass-card month-card">
          <div className="month-weekdays">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((w, i) => (
              <div key={i}>{w}</div>
            ))}
          </div>
          <div className="month-grid">
            {cells.map((d) => {
              const k = dateKey(d)
              const inMonth = d.getMonth() === anchor.getMonth()
              const sel = k === selKey
              const names = dayList(allReservations[k]).map((r) => r.name)
              return (
                <button
                  key={k}
                  type="button"
                  className="month-cell"
                  onClick={() => setAnchor(new Date(d))}
                >
                  <span className={`month-num${sel ? ' sel' : ''}${inMonth ? '' : ' out'}`}>{d.getDate()}</span>
                  <span className="month-dots">
                    {names.slice(0, 3).map((n, i) => (
                      <i key={i} className="dot" style={{ background: COLOR[n] || '#8E8E93' }} />
                    ))}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="group">
          <div className="group-label">
            {anchor.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          {selRows.length ? (
            <div className="glass-list">
              {selRows.map((res) => (
                <ResCard key={res.key} res={res} dStr={selKey} compact />
              ))}
            </div>
          ) : (
            <button type="button" className="free-row" onClick={() => openSheet(anchor, 19 * 60)}>
              <span className="free-range">All day</span>
              <span className="free-line" />
              <span className="free-word">Free</span>
            </button>
          )}
        </div>
      </div>
    )
  }

  /* ---------- roommates ---------- */

  const stats = NAMES.map((rm) => {
    const events = []
    const dates = []
    let monthDates = 0
    const monthPrefix = todayKey.slice(0, 7)
    Object.entries(allReservations).forEach(([dStr, dayRes]) => {
      Object.values(dayRes || {}).forEach((res) => {
        if (res.name !== rm) return
        if (res.type === 'date') {
          dates.push({ ...res, dateStr: dStr })
          if (dStr.startsWith(monthPrefix)) monthDates++
        } else events.push({ ...res, dateStr: dStr })
      })
    })
    const newestFirst = (a, b) => b.dateStr.localeCompare(a.dateStr) || startOf(b) - startOf(a)
    return {
      name: rm,
      events: events.sort(newestFirst),
      dates: dates.sort(newestFirst),
      monthDates
    }
  })
  const leaderboard = [...stats].sort((a, b) => b.monthDates - a.monthDates)

  const renderRoommates = () => (
    <div className="stack">
      <div className="glass-card">
        <div className="lb-head">
          <h3>Date Leaderboard</h3>
          <span className="lb-month">{new Date().toLocaleDateString('en-US', { month: 'long' })}</span>
        </div>
        <p className="lb-sub">Resets on the 1st.</p>
        <div className="lb-rows">
          {leaderboard.map((e, i) => {
            const leader = i === 0 && e.monthDates > 0
            return (
              <div key={e.name} className={`lb-row${leader ? ' leader' : ''}`}>
                <span className="lb-rank">{i + 1}</span>
                <Avatar name={e.name} size={30} />
                <span className="lb-name">{e.name}</span>
                <span className="lb-count">{e.monthDates}</span>
              </div>
            )
          })}
        </div>
      </div>
      <div className="group">
        <div className="group-label">All time</div>
        <div className="glass-list">
          {stats.map((s) => {
            const open = openRm === s.name
            const log = [
              { key: 'dates', head: 'Dates', rows: s.dates },
              { key: 'events', head: 'Events', rows: s.events }
            ].filter((sect) => sect.rows.length)
            return (
              <div key={s.name} className="rm-block">
                <button
                  type="button"
                  className={`list-row rm-row${open ? ' open' : ''}`}
                  aria-expanded={open}
                  onClick={() => setOpenRm(open ? null : s.name)}
                >
                  <Avatar name={s.name} size={36} />
                  <div className="res-main">
                    <span className="res-name">{s.name}</span>
                    <div className="res-time">
                      {s.events.length} {s.events.length === 1 ? 'event' : 'events'} · {s.dates.length}{' '}
                      {s.dates.length === 1 ? 'date' : 'dates'}
                    </div>
                  </div>
                  <Chevron />
                </button>
                {open ? (
                  <div className="rm-detail">
                    {log.length === 0 ? (
                      <p className="rm-empty">Hasn't reserved the couch yet.</p>
                    ) : (
                      log.map((sect) => (
                        <div key={sect.key} className="rm-sect">
                          <div className="rm-sect-head">{sect.head}</div>
                          {sect.rows.map((r) => (
                            <div key={`${r.dateStr}-${startOf(r)}`} className="rm-item">
                              <span className="rm-when">{fmtDay(r.dateStr)}</span>
                              <span className="rm-what">
                                {sect.key === 'dates' ? (
                                  <>
                                    <strong>{r.guestName || 'Someone'}</strong>
                                    {r.details ? ` — ${r.details}` : ''}
                                  </>
                                ) : (
                                  r.details || 'No details'
                                )}
                              </span>
                              <span className="rm-hours">{rangeLabel(startOf(r), endOf(r))}</span>
                            </div>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  /* ---------- settings ---------- */

  const renderSettings = () => (
    <div className="stack">
      <div className="group">
        <div className="group-label">You</div>
        <div className="glass-list">
          <div className="list-row column">
            <span className="row-title">Your name</span>
            <div className="chips">
              {NAMES.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`chip${me === n ? ' on' : ''}`}
                  style={me === n ? { background: COLOR[n], borderColor: COLOR[n], color: INK[n] } : undefined}
                  onClick={() => setMe(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="list-row">
            <span className="row-title">Partner</span>
            <input
              className="row-input"
              type="text"
              placeholder={me ? 'Optional' : 'Pick your name first'}
              value={partner}
              disabled={!me}
              onChange={(e) => setPartner(e.target.value)}
            />
          </div>
        </div>
        <p className="footnote">
          Saved for whoever is picked above. Set a partner and their name fills in automatically when you book a
          date. Leave it empty and you'll be asked each time.
        </p>
      </div>

      <div className="group">
        <div className="group-label">Appearance</div>
        <div className="glass-card">
          <div className="segmented">
            {['light', 'dark', 'auto'].map((t) => (
              <button key={t} type="button" className={theme === t ? 'on' : ''} onClick={() => setTheme(t)}>
                {t === 'auto' ? 'Automatic' : t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <p className="footnote inset">Automatic follows your phone's appearance setting.</p>
        </div>
      </div>

      <p className="footnote build-stamp">Build {typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev'}</p>
    </div>
  )

  /* ---------- reservation sheet ---------- */

  const renderSheet = () => {
    if (!sheet) return null
    const dStr = dateKey(sheet.day)
    const dur = sheet.end - sheet.start
    const taken = dayList(allReservations[dStr]).map((r) => ({
      key: r.key,
      start: r.start,
      end: r.end,
      name: r.name,
      color: COLOR[r.name] || '#8E8E93'
    }))
    const clash = taken.find((b) => Math.max(sheet.start, b.start) < Math.min(sheet.end, b.end))

    return (
      <div className="sheet-wrap" role="dialog" aria-modal="true">
        <div className="sheet-scrim" onClick={() => setSheet(null)} />
        <form className="sheet" onSubmit={handleReserve}>
          <div className="sheet-nav">
            <button type="button" className="nav-btn" onClick={() => setSheet(null)}>
              Cancel
            </button>
            <span className="nav-title">New Reservation</span>
            <button type="submit" className="nav-btn strong">
              Add
            </button>
          </div>

          <div className="sheet-body">
            <div className="who-strip">
              <Avatar name={me} size={26} />
              <span>
                Booking as <strong>{me}</strong>
              </span>
            </div>

            <div className="glass-card">
              <div className="time-head">
                <span className="time-big">
                  {fmtMin(sheet.start)} – {fmtMin(sheet.end)}
                </span>
                <span className="time-dur">{dur > 0 ? durLabel(dur) : '—'}</span>
              </div>
              <div className="sheet-sub">
                {sheet.day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>

              <DayBar start={sheet.start} end={sheet.end} taken={taken} />

              <div className="time-fields">
                <label className="time-field">
                  <span>Starts</span>
                  <input
                    type="time"
                    step="900"
                    value={toTimeValue(sheet.start)}
                    onChange={(e) => {
                      if (!e.target.value) return
                      const start = fromTimeValue(e.target.value)
                      // moving the start carries the length with it, the way iOS Calendar does
                      setSheet((s) => {
                        const len = Math.max(s.end - s.start, STEP)
                        return { ...s, start, end: Math.min(start + len, DAY_MIN) }
                      })
                    }}
                  />
                </label>
                <label className="time-field">
                  <span>Ends</span>
                  <input
                    type="time"
                    step="900"
                    value={toTimeValue(sheet.end)}
                    onChange={(e) => {
                      if (!e.target.value) return
                      const raw = fromTimeValue(e.target.value)
                      // midnight is the end of this day, not the start of it
                      const end = raw <= sheet.start ? DAY_MIN : raw
                      setSheet((s) => ({ ...s, end }))
                    }}
                  />
                </label>
              </div>

              {clash ? (
                <p className="time-clash">
                  Overlaps {clash.name}, {rangeLabel(clash.start, clash.end)}. Reserving will be refused.
                </p>
              ) : null}
            </div>

            <div className="type-tiles">
              {[
                { key: 'event', title: 'Event', sub: 'People coming over', dot: '#8E8E93' },
                { key: 'date', title: 'Date', sub: 'Couch to yourself', dot: '#FF2D55' }
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={`tile${sheet.type === t.key ? ' on' : ''}`}
                  onClick={() =>
                    setSheet((s) => ({
                      ...s,
                      type: t.key,
                      guestName: t.key === 'date' && !s.guestName ? partner : s.guestName
                    }))
                  }
                >
                  <i className="dot" style={{ background: t.dot }} />
                  <span className="tile-title">{t.title}</span>
                  <span className="tile-sub">{t.sub}</span>
                </button>
              ))}
            </div>

            <div className="glass-list">
              {sheet.type === 'date' ? (
                <div className="list-row">
                  <span className="row-title narrow">With</span>
                  <input
                    className="row-input"
                    type="text"
                    placeholder="Their name"
                    value={sheet.guestName}
                    onChange={(e) => setSheet((s) => ({ ...s, guestName: e.target.value }))}
                  />
                  {partner && sheet.guestName === partner ? <span className="autofill">Autofilled</span> : null}
                </div>
              ) : null}
              <textarea
                className="row-textarea"
                placeholder={sheet.type === 'date' ? 'Any other details? (optional)' : "What's the event? Who's coming?"}
                value={sheet.details}
                onChange={(e) => setSheet((s) => ({ ...s, details: e.target.value }))}
              />
            </div>

            <button type="submit" className="primary">
              Reserve the couch
            </button>
          </div>
        </form>
      </div>
    )
  }

  /* ---------- shell ---------- */

  const title =
    tab === 'roommates'
      ? 'Roommates'
      : tab === 'settings'
        ? 'Settings'
        : calMode === 'day'
          ? anchor.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
          : calMode === 'week'
            ? `${weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
            : anchor.toLocaleDateString('en-US', { month: 'long' })

  const eyebrow =
    tab !== 'calendar'
      ? null
      : calMode === 'day'
        ? anchor.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()
        : calMode === 'week'
          ? 'THIS WEEK'
          : anchor.getFullYear()

  return (
    <div className="app">
      {/* the background lives on its own fixed layer rather than as a fixed
          background-attachment, which WebKit paints at the wrong size until
          something scrolls */}
      <div className="backdrop" aria-hidden="true" />
      <header className="app-head">
        <div className="head-top">
          <div>
            {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
            <h1>{title}</h1>
          </div>
          {tab === 'calendar' ? (
            <div className="head-nav">
              <button type="button" onClick={() => navigate(-1)} aria-label="Previous">
                <svg width="9" height="15" viewBox="0 0 9 15"><path d="M7 1.5L1.5 7.5L7 13.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date()
                  d.setHours(0, 0, 0, 0)
                  setAnchor(d)
                }}
              >
                Today
              </button>
              <button type="button" onClick={() => navigate(1)} aria-label="Next">
                <svg width="9" height="15" viewBox="0 0 9 15"><path d="M2 1.5L7.5 7.5L2 13.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
          ) : me ? (
            <button
              type="button"
              className="head-avatar"
              onClick={() => setTab('settings')}
              aria-label="Open settings"
            >
              <Avatar name={me} size={34} />
            </button>
          ) : null}
        </div>

        {tab === 'calendar' ? (
          <>
            <div className="segmented">
              {['day', 'week', 'month'].map((m) => (
                <button key={m} type="button" className={calMode === m ? 'on' : ''} onClick={() => setCalMode(m)}>
                  {m[0].toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
            {calMode === 'week' ? (
              <div className="week-strip">
                {weekDays.map((d) => {
                  const k = dateKey(d)
                  const sel = k === dateKey(anchor)
                  const has = Object.keys(allReservations[k] || {}).length > 0
                  return (
                    <button
                      key={k}
                      type="button"
                      className={`pill${sel ? ' on' : ''}`}
                      onClick={() => {
                        setAnchor(new Date(d))
                        setCalMode('day')
                      }}
                    >
                      <span className="pill-day">{d.toLocaleDateString('en-US', { weekday: 'narrow' })}</span>
                      <span className="pill-num">{d.getDate()}</span>
                      <i className="pill-mark" style={{ opacity: has ? 1 : 0 }} />
                    </button>
                  )
                })}
              </div>
            ) : null}
          </>
        ) : null}
      </header>

      <main className={`app-body${tab === 'calendar' ? ' with-fab' : ''}`}>
        {loading ? (
          <div className="stack">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ opacity: 1 - i * 0.18 }}>
                <span className="sk-avatar" />
                <span className="sk-lines">
                  <i style={{ width: `${52 - i * 6}%` }} />
                  <i className="thin" style={{ width: `${34 - i * 4}%` }} />
                </span>
              </div>
            ))}
            <p className="loading-msg">Syncing with the apartment…</p>
          </div>
        ) : tab === 'calendar' ? (
          calMode === 'day' ? renderDay() : calMode === 'week' ? renderWeek() : renderMonth()
        ) : tab === 'roommates' ? (
          renderRoommates()
        ) : (
          renderSettings()
        )}
      </main>

      {tab === 'calendar' && !loading ? (
        <button type="button" className="fab" onClick={() => openSheet(anchor, 19 * 60)}>
          <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
            <path d="M7.5 1.5v12M1.5 7.5h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Reserve
        </button>
      ) : null}

      <nav className="tabbar">
        {[
          { key: 'calendar', label: 'Calendar' },
          { key: 'roommates', label: 'Roommates' },
          { key: 'settings', label: 'Settings' }
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            className={`tab${tab === t.key ? ' on' : ''}`}
            onClick={() => setTab(t.key)}
          >
            <TabIcon kind={t.key} active={tab === t.key} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {renderSheet()}
      {splash !== 'gone' ? <Splash leaving={splash === 'out'} /> : null}
    </div>
  )
}
