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
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const DAY_END = 24

const dateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const formatHour = (hour) => {
  if (hour === 24) return '12:00 AM'
  const ampm = hour >= 12 ? 'PM' : 'AM'
  return `${hour % 12 || 12}:00 ${ampm}`
}
const shortHour = (hour) => {
  if (hour === 24) return '12 AM'
  const ampm = hour >= 12 ? 'PM' : 'AM'
  return `${hour % 12 || 12} ${ampm}`
}
const rangeLabel = (a, b) => {
  const sameHalf = (a < 12) === (b < 12 || b === 24)
  return sameHalf ? `${shortHour(a).replace(/ (AM|PM)/, '')} – ${shortHour(b)}` : `${shortHour(a)} – ${shortHour(b)}`
}
const resEnd = (res) => res.endHour || res.hour + 1

const buildDayMap = (dayRes) => {
  const map = {}
  Object.values(dayRes || {}).forEach((res) => {
    for (let h = res.hour; h < resEnd(res); h++) map[h] = res
  })
  return map
}

const mondayOf = (d) => {
  const copy = new Date(d)
  const day = copy.getDay()
  copy.setDate(copy.getDate() - day + (day === 0 ? -6 : 1))
  copy.setHours(0, 0, 0, 0)
  return copy
}

const sortedDay = (dayRes) =>
  Object.values(dayRes || {}).sort((a, b) => a.hour - b.hour)

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
      <p className="splash-sub">One couch. Five roommates. Book it before someone else does.</p>
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

const Chevron = () => (
  <svg className="chev" width="8" height="13" viewBox="0 0 8 13" aria-hidden="true">
    <path d="M1.5 1.5L6.5 6.5L1.5 11.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const TabIcon = ({ kind, active }) => {
  const s = active ? 'var(--accent)' : 'var(--tab-idle)'
  if (kind === 'calendar')
    return (
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
        <rect x="3.5" y="5" width="19" height="17" rx="4.5" fill="none" stroke={s} strokeWidth="1.8" />
        <path d="M3.5 10h19" stroke={s} strokeWidth="1.8" />
        <circle cx="9" cy="15.5" r="1.6" fill={s} />
        <circle cx="17" cy="15.5" r="1.6" fill={s} />
      </svg>
    )
  if (kind === 'roommates')
    return (
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
        <circle cx="10" cy="10" r="4.2" fill="none" stroke={s} strokeWidth="1.8" />
        <circle cx="17.5" cy="12" r="3.2" fill="none" stroke={s} strokeWidth="1.8" />
        <path d="M3.5 21.5c1.4-3.4 4-5 6.5-5s5.1 1.6 6.5 5" fill="none" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <path d="M4 8h18M4 13h18M4 18h18" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="9" cy="8" r="2.6" fill="var(--tabbar-solid)" stroke={s} strokeWidth="1.8" />
      <circle cx="17" cy="18" r="2.6" fill="var(--tabbar-solid)" stroke={s} strokeWidth="1.8" />
    </svg>
  )
}

/* ---------- app ---------- */

export default function App() {
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
  const [partner, setPartner] = useState(() => load('couch.partner', ''))
  const [theme, setTheme] = useState(() => load('couch.theme', 'auto'))

  const [sheet, setSheet] = useState(null) // {day, hour, endHour, type, guestName, details}
  const [splash, setSplash] = useState('in') // 'in' | 'out' | 'gone'

  useEffect(() => {
    const t1 = setTimeout(() => setSplash('out'), 1500)
    const t2 = setTimeout(() => setSplash('gone'), 2000)
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
      localStorage.setItem('couch.partner', partner)
    } catch {}
  }, [me, partner])

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

  const maxEndFor = (day, startHour) => {
    const dayRes = allReservations[dateKey(day)] || {}
    let limit = DAY_END
    Object.values(dayRes).forEach((res) => {
      if (res.hour > startHour && res.hour < limit) limit = res.hour
    })
    return limit
  }

  const openSheet = (day, hour) => {
    if (!me) {
      setTab('settings')
      return
    }
    const limit = maxEndFor(day, hour)
    setSheet({
      day,
      hour,
      endHour: Math.min(hour + 2, limit),
      type: 'event',
      guestName: partner,
      details: ''
    })
  }

  const handleReserve = async (e) => {
    e.preventDefault()
    if (!sheet) return
    const { day, hour, endHour, type, guestName, details } = sheet
    if (type === 'date' && !guestName.trim()) return alert("Who's the date with?")
    if (type === 'event' && !details.trim()) return alert("What's the event?")

    const dStr = dateKey(day)
    const dayRes = allReservations[dStr] || {}
    const overlaps = Object.values(dayRes).some(
      (res) => Math.max(hour, res.hour) < Math.min(endHour, resEnd(res))
    )
    if (overlaps) return alert('That time overlaps an existing reservation.')

    try {
      await set(ref(db, `reservations/${dStr}/${hour}`), {
        name: me,
        type,
        details: details.trim(),
        guestName: type === 'date' ? guestName.trim() : '',
        hour,
        endHour,
        timestamp: new Date().toISOString()
      })
      setSheet(null)
    } catch (error) {
      alert('Error making reservation: ' + error.message)
    }
  }

  const handleDelete = async (dStr, startHour) => {
    if (!window.confirm('Delete this reservation?')) return
    try {
      await remove(ref(db, `reservations/${dStr}/${startHour}`))
    } catch (error) {
      alert('Error deleting reservation: ' + error.message)
    }
  }

  /* ---------- reservation card ---------- */

  const ResCard = ({ res, dStr, compact }) => {
    const mine = res.name === me
    const id = `${dStr}-${res.hour}`
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
            {formatHour(res.hour)} – {formatHour(resEnd(res))}
          </div>
          {showDetails && detail ? <div className="res-detail">{detail}</div> : null}
          {!showDetails ? <div className="res-hint">Tap to see details</div> : null}
          {mine && open ? (
            <button
              type="button"
              className="res-delete"
              onClick={(e) => {
                e.stopPropagation()
                handleDelete(dStr, res.hour)
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
    const map = buildDayMap(allReservations[dStr])
    const rows = []
    let h = 0
    while (h < 24) {
      const res = map[h]
      if (res) {
        rows.push(<ResCard key={`r${h}`} res={res} dStr={dStr} />)
        h = resEnd(res)
      } else {
        let end = h
        while (end < 24 && !map[end]) end++
        const start = h
        rows.push(
          <button key={`f${h}`} type="button" className="free-row" onClick={() => openSheet(anchor, start)}>
            <span className="free-range">{rangeLabel(start, end)}</span>
            <span className="free-line" />
            <span className="free-word">Free</span>
          </button>
        )
        h = end
      }
    }
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
      .map((d) => ({ d, dStr: dateKey(d), rows: sortedDay(allReservations[dateKey(d)]) }))
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
                <ResCard key={res.hour} res={res} dStr={g.dStr} compact />
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
    const selRows = sortedDay(allReservations[selKey])

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
              const names = sortedDay(allReservations[k]).map((r) => r.name)
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
                <ResCard key={res.hour} res={res} dStr={selKey} compact />
              ))}
            </div>
          ) : (
            <button type="button" className="free-row" onClick={() => openSheet(anchor, 19)}>
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
    const newestFirst = (a, b) => b.dateStr.localeCompare(a.dateStr) || b.hour - a.hour
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
                            <div key={`${r.dateStr}-${r.hour}`} className="rm-item">
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
                              <span className="rm-hours">{rangeLabel(r.hour, resEnd(r))}</span>
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
              placeholder="Optional"
              value={partner}
              onChange={(e) => setPartner(e.target.value)}
            />
          </div>
        </div>
        <p className="footnote">
          Set a partner and their name fills in automatically when you book a date. Leave it empty and you'll be
          asked each time.
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
    </div>
  )

  /* ---------- reservation sheet ---------- */

  const renderSheet = () => {
    if (!sheet) return null
    const limit = maxEndFor(sheet.day, sheet.hour)
    const dayMap = buildDayMap(allReservations[dateKey(sheet.day)])
    const starts = HOURS.filter((h) => !dayMap[h])
    const ends = Array.from({ length: limit - sheet.hour }, (_, i) => sheet.hour + 1 + i)
    const dur = sheet.endHour - sheet.hour

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
                  {formatHour(sheet.hour)} – {formatHour(sheet.endHour)}
                </span>
                <span className="time-dur">
                  {dur} {dur === 1 ? 'hr' : 'hrs'}
                </span>
              </div>
              <div className="sheet-sub">
                {sheet.day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
              <div className="pick-label">Starts</div>
              <div className="scroller">
                {starts.map((h) => (
                  <button
                    key={h}
                    type="button"
                    className={`time-chip${sheet.hour === h ? ' on' : ''}`}
                    onClick={() =>
                      setSheet((s) => ({ ...s, hour: h, endHour: Math.min(h + 2, maxEndFor(s.day, h)) }))
                    }
                  >
                    {shortHour(h)}
                  </button>
                ))}
              </div>
              <div className="pick-label">Ends</div>
              <div className="scroller">
                {ends.map((h) => (
                  <button
                    key={h}
                    type="button"
                    className={`time-chip${sheet.endHour === h ? ' on' : ''}`}
                    onClick={() => setSheet((s) => ({ ...s, endHour: h }))}
                  >
                    {shortHour(h)}
                  </button>
                ))}
              </div>
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
            <Avatar name={me} size={34} />
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

      <main className="app-body">
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
        <button type="button" className="fab" onClick={() => openSheet(anchor, 19)}>
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
