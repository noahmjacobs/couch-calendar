// The couch calendar, as a tab of the 449 app. Lifted from the original Couch
// App: the day, week and month views, the reservation sheet, and the requests
// to release a booking. Identity comes from the app above (a signed-in
// roommate); the data is the shared database's reservations tree.

import { useState, useMemo } from 'react'
import { db } from '../firebase'
import { ref, set, remove } from 'firebase/database'
import { NAMES, COLOR } from '../roommates.js'
import { Avatar } from '../shared.jsx'

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

/* ---------- small pieces ---------- */

const KindDot = ({ type }) => (
  <span className="kind">
    <i className="dot" style={{ background: type === 'date' ? '#FF2D55' : '#8E8E93' }} />
    {type === 'date' ? 'Date' : 'Event'}
  </span>
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


/* ---------- the calendar ---------- */

// renders its own header, body and floating button so the shell can hand the
// whole viewport over while this tab is open
export default function Calendar({ me, partner, allReservations, loading }) {
  const [calMode, setCalMode] = useState('day')
  const [anchor, setAnchor] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [openRes, setOpenRes] = useState(null)
  const [asking, setAsking] = useState(null) // reservation id a release request is being written for
  const [askNote, setAskNote] = useState('')
  const [sheet, setSheet] = useState(null) // {day, start, end, type, guestName, details}

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
    if (!me) return
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

  const handleDelete = async (dStr, key, message = 'Delete this reservation?') => {
    if (!window.confirm(message)) return
    try {
      await remove(ref(db, `reservations/${dStr}/${key}`))
    } catch (error) {
      alert('Error deleting reservation: ' + error.message)
    }
  }

  // asking someone to give up their slot. Requests are stored on the reservation
  // itself (reservations/{day}/{key}/requests/{from}), so they need no extra
  // database rule and disappear with the reservation.
  const sendRequest = async (dStr, key) => {
    if (!me) return
    try {
      await set(ref(db, `reservations/${dStr}/${key}/requests/${me}`), {
        from: me,
        note: askNote.trim(),
        timestamp: new Date().toISOString()
      })
      setAsking(null)
      setAskNote('')
    } catch (error) {
      alert('Could not send the request: ' + error.message)
    }
  }

  const dropRequest = async (dStr, key, from) => {
    try {
      await remove(ref(db, `reservations/${dStr}/${key}/requests/${from}`))
    } catch (error) {
      alert('Could not update the request: ' + error.message)
    }
  }

  /* ---------- reservation card ---------- */

  const ResCard = ({ res, dStr, compact }) => {
    const mine = res.name === me
    const id = `${dStr}-${res.key}`
    const open = openRes === id
    const showDetails = mine || open
    const requests = Object.values(res.requests || {}).sort((a, b) =>
      (a.timestamp || '').localeCompare(b.timestamp || '')
    )
    const myRequest = me ? (res.requests || {})[me] : null
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
          {mine && open && requests.length ? (
            <div className="req-list">
              {requests.map((r) => (
                <div key={r.from} className="req-item">
                  <Avatar name={r.from} size={22} />
                  <span>
                    <strong>{r.from}</strong> asked you to release this
                    {r.note ? ` — “${r.note}”` : ''}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          {mine && open ? (
            <button
              type="button"
              className="res-delete"
              onClick={(e) => {
                e.stopPropagation()
                handleDelete(dStr, res.key)
              }}
            >
              {requests.length ? 'Release the couch' : 'Delete reservation'}
            </button>
          ) : null}
          {!mine && open && me ? (
            myRequest ? (
              <div className="req-sent">
                You asked {res.name} to release this.
                <button
                  type="button"
                  className="req-link"
                  onClick={(e) => {
                    e.stopPropagation()
                    dropRequest(dStr, res.key, me)
                  }}
                >
                  Withdraw
                </button>
              </div>
            ) : asking === id ? (
              <div className="req-form" onClick={(e) => e.stopPropagation()}>
                <input
                  className="req-input"
                  type="text"
                  placeholder="Add a note (optional)"
                  value={askNote}
                  onChange={(e) => setAskNote(e.target.value)}
                />
                <div className="req-actions">
                  <button type="button" className="res-delete ask" onClick={() => sendRequest(dStr, res.key)}>
                    Send
                  </button>
                  <button
                    type="button"
                    className="req-link"
                    onClick={() => {
                      setAsking(null)
                      setAskNote('')
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="res-delete ask"
                onClick={(e) => {
                  e.stopPropagation()
                  setAskNote('')
                  setAsking(id)
                }}
              >
                Ask {res.name} to release it
              </button>
            )
          ) : null}
        </div>
      </div>
    )
  }

  /* ---------- requests waiting on me ---------- */

  // every request other people have made against my reservations, shown at the
  // top of the calendar until I release the slot or keep it
  const inbox = []
  if (me) {
    Object.entries(allReservations).forEach(([dStr, dayRes]) => {
      dayList(dayRes).forEach((res) => {
        if (res.name !== me || !res.requests) return
        Object.values(res.requests).forEach((r) => inbox.push({ dStr, res, from: r.from, note: r.note }))
      })
    })
    inbox.sort((a, b) => a.dStr.localeCompare(b.dStr) || a.res.start - b.res.start)
  }

  const renderInbox = () =>
    inbox.length ? (
      <div className="glass-card inbox">
        <div className="inbox-head">Couch requests</div>
        {inbox.map((item) => (
          <div key={`${item.dStr}-${item.res.key}-${item.from}`} className="inbox-item">
            <Avatar name={item.from} size={30} />
            <div className="res-main">
              <span className="res-name">{item.from} wants the couch</span>
              <div className="res-time">
                {fmtDay(item.dStr)} · {rangeLabel(item.res.start, item.res.end)}
              </div>
              {item.note ? <div className="res-detail">“{item.note}”</div> : null}
              <div className="inbox-actions">
                <button
                  type="button"
                  className="chip"
                  onClick={() =>
                    handleDelete(
                      item.dStr,
                      item.res.key,
                      `Release the couch to ${item.from}? Your reservation will be deleted.`
                    )
                  }
                >
                  Release it
                </button>
                <button type="button" className="chip" onClick={() => dropRequest(item.dStr, item.res.key, item.from)}>
                  Keep it
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    ) : null

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
        <div className="cal-empty">
          <div className="cal-empty-badge">
            <span className="cal-empty-ring" />
          </div>
          <div className="cal-empty-title">The couch is all yours</div>
          <p className="cal-empty-sub">
            Nothing booked on {anchor.toLocaleDateString('en-US', { weekday: 'long' })}. Tap Reserve to claim a
            stretch of it.
          </p>
        </div>
      )
    return <div className="stack">{rows}</div>
  }

  /* ---------- selected day (under the week strip and the month grid) ---------- */

  const renderSelectedDay = () => {
    const selKey = dateKey(anchor)
    const selRows = dayList(allReservations[selKey])
    return (
      <div className="group">
        <div className="group-label">
          {anchor.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          {selKey === todayKey ? ' · Today' : ''}
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
    )
  }

  /* ---------- week ---------- */

  // the day pills in the header select a day; the body shows that day, the same
  // way the month grid does, instead of jumping to the Day view
  const renderWeek = () => <div className="stack">{renderSelectedDay()}</div>

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
        {renderSelectedDay()}
      </div>
    )
  }

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
                  <span className="field-title narrow">With</span>
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
    calMode === 'day'
      ? anchor.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
      : calMode === 'week'
        ? `${weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
        : anchor.toLocaleDateString('en-US', { month: 'long' })

  const eyebrow =
    calMode === 'day'
      ? anchor.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()
      : calMode === 'week'
        ? 'THIS WEEK'
        : anchor.getFullYear()

  return (
    <>
      <header className="x-head">
        <div className="head-top">
          <div>
            <div className="cal-eyebrow">{eyebrow}</div>
            <h1>{title}</h1>
          </div>
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
        </div>

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
                <button key={k} type="button" className={`pill${sel ? ' on' : ''}`} onClick={() => setAnchor(new Date(d))}>
                  <span className="pill-day">{d.toLocaleDateString('en-US', { weekday: 'narrow' })}</span>
                  <span className="pill-num">{d.getDate()}</span>
                  <i className="pill-mark" style={{ opacity: has ? 1 : 0 }} />
                </button>
              )
            })}
          </div>
        ) : null}
      </header>

      <main className="x-body with-fab">
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
        ) : (
          <>
            {renderInbox()}
            {calMode === 'day' ? renderDay() : calMode === 'week' ? renderWeek() : renderMonth()}
          </>
        )}
      </main>

      {!loading ? (
        <button type="button" className="fab" onClick={() => openSheet(anchor, 19 * 60)}>
          <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
            <path d="M7.5 1.5v12M1.5 7.5h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Reserve
        </button>
      ) : null}

      {renderSheet()}
    </>
  )
}

// the requests other people made against my bookings, for the tab badge
export const countRequests = (allReservations, me) => {
  if (!me) return 0
  let n = 0
  Object.values(allReservations || {}).forEach((dayRes) => {
    Object.values(dayRes || {}).forEach((res) => {
      if (res && res.name === me && res.requests) n += Object.keys(res.requests).length
    })
  })
  return n
}
