import { useState, useEffect } from 'react'
import { db } from './firebase'
import { ref, onValue, set, remove } from 'firebase/database'
import './App.css'

const ROOMMATES = ['Noah', 'Bryon', 'Jonas', 'Andrew', 'James']
const HOURS = Array.from({ length: 24 }, (_, i) => i) // 12am - 12am, full day
const DAY_END = 24 // reservations can run until midnight

const dateKey = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const formatHour = (hour) => {
  if (hour === 24) return '12:00 AM'
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:00 ${ampm}`
}

const resEnd = (res) => res.endHour || res.hour + 1

// map of hour -> reservation covering that hour
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
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1)
  copy.setDate(diff)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export default function App() {
  const [view, setView] = useState('calendar') // 'calendar' | 'roommates'
  const [calMode, setCalMode] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'day' : 'week'
  )
  const [anchor, setAnchor] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [allReservations, setAllReservations] = useState({})
  const [loading, setLoading] = useState(true)

  // form state
  const [selectedDay, setSelectedDay] = useState(null)
  const [selectedHour, setSelectedHour] = useState(null)
  const [endHour, setEndHour] = useState(null)
  const [who, setWho] = useState(null)
  const [type, setType] = useState(null) // 'event' | 'date'
  const [details, setDetails] = useState('')
  const [guestName, setGuestName] = useState('')

  const todayKey = dateKey(new Date())
  const weekStart = mondayOf(anchor)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  useEffect(() => {
    const resRef = ref(db, 'reservations')
    const unsubscribe = onValue(
      resRef,
      (snapshot) => {
        setAllReservations(snapshot.exists() ? snapshot.val() : {})
        setLoading(false)
      },
      (error) => {
        console.error('Firebase error:', error)
        setLoading(false)
      }
    )
    return () => unsubscribe()
  }, [])

  const resetForm = () => {
    setSelectedDay(null)
    setSelectedHour(null)
    setEndHour(null)
    setWho(null)
    setType(null)
    setDetails('')
    setGuestName('')
  }

  const navigate = (dir) => {
    const d = new Date(anchor)
    if (calMode === 'day') d.setDate(d.getDate() + dir)
    else if (calMode === 'week') d.setDate(d.getDate() + dir * 7)
    else d.setMonth(d.getMonth() + dir)
    setAnchor(d)
    resetForm()
  }

  const goToToday = () => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    setAnchor(d)
    resetForm()
  }

  const switchMode = (mode) => {
    setCalMode(mode)
    resetForm()
  }

  const pickStart = (day, hour) => {
    setSelectedDay(day)
    setSelectedHour(hour)
    setEndHour(hour + 1) // default: 1 hour
  }

  // latest allowed end for the selected start (can't run into the next booking)
  const maxEndFor = (day, startHour) => {
    const dayRes = allReservations[dateKey(day)] || {}
    let limit = DAY_END
    Object.values(dayRes).forEach((res) => {
      if (res.hour > startHour && res.hour < limit) limit = res.hour
    })
    return limit
  }

  const handleReserve = async (e) => {
    e.preventDefault()
    if (!selectedDay || selectedHour === null || endHour === null) return
    if (!who) {
      alert('Pick who you are!')
      return
    }
    if (!type) {
      alert('Is it an event or a date?')
      return
    }
    if (type === 'date' && !guestName.trim()) {
      alert("Who's the date with? Put their name down.")
      return
    }
    if (type === 'event' && !details.trim()) {
      alert("What's the event? Add some details.")
      return
    }

    const dStr = dateKey(selectedDay)
    const dayRes = allReservations[dStr] || {}
    const overlaps = Object.values(dayRes).some(
      (res) => Math.max(selectedHour, res.hour) < Math.min(endHour, resEnd(res))
    )
    if (overlaps) {
      alert('That time range overlaps an existing reservation!')
      return
    }

    try {
      await set(ref(db, `reservations/${dStr}/${selectedHour}`), {
        name: who,
        type,
        details: details.trim(),
        guestName: type === 'date' ? guestName.trim() : '',
        hour: selectedHour,
        endHour,
        timestamp: new Date().toISOString()
      })
      resetForm()
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

  // ---- Roommate stats ----
  const stats = ROOMMATES.map((rm) => {
    const events = []
    const dates = []
    Object.entries(allReservations).forEach(([dStr, dayRes]) => {
      Object.values(dayRes || {}).forEach((res) => {
        if (res.name !== rm) return
        if (res.type === 'date') {
          dates.push({ ...res, dateStr: dStr })
        } else {
          events.push({ ...res, dateStr: dStr })
        }
      })
    })
    const guestCounts = {}
    dates.forEach((d) => {
      const g = d.guestName || 'Unknown'
      guestCounts[g] = (guestCounts[g] || 0) + 1
    })
    return { name: rm, events, dates, guestCounts }
  })

  const navLabel = () => {
    if (calMode === 'day') {
      const label = anchor.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      })
      return dateKey(anchor) === todayKey ? `${label} (Today)` : label
    }
    if (calMode === 'week') {
      return `${weekDays[0].toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric'
      })} – ${weekDays[6].toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`
    }
    return anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  // ---- Reservation form panel (shared by day + week) ----
  const renderForm = () => (
    <div className="form-panel">
      <h3>Make a Reservation</h3>

      {!selectedDay ? (
        <p className="hint">
          {calMode === 'day'
            ? 'Tap a free time to reserve it'
            : 'Click a day or free time slot to reserve'}
        </p>
      ) : selectedHour === null ? (
        <div>
          <div className="selected-info">
            {selectedDay.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric'
            })}
          </div>
          <p className="hint">Pick a start time:</p>
          <div className="time-picker">
            {HOURS.map((hour) => {
              const dStr = dateKey(selectedDay)
              const isTaken = buildDayMap(allReservations[dStr])[hour]
              return (
                <button
                  key={hour}
                  className={`time-btn ${isTaken ? 'reserved' : ''}`}
                  onClick={() => !isTaken && pickStart(selectedDay, hour)}
                  disabled={!!isTaken}
                >
                  {formatHour(hour)}
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <form onSubmit={handleReserve}>
          <div className="selected-info">
            {selectedDay.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric'
            })}
            <br />
            {formatHour(selectedHour)} – {formatHour(endHour)}
          </div>

          <label>Until when?</label>
          <div className="time-picker end-picker">
            {Array.from(
              { length: maxEndFor(selectedDay, selectedHour) - selectedHour },
              (_, i) => selectedHour + 1 + i
            ).map((h) => (
              <button
                type="button"
                key={h}
                className={`time-btn ${endHour === h ? 'active' : ''}`}
                onClick={() => setEndHour(h)}
              >
                {formatHour(h)}
              </button>
            ))}
          </div>

          <label>Who are you?</label>
          <div className="who-picker">
            {ROOMMATES.map((rm) => (
              <button
                type="button"
                key={rm}
                className={`who-btn ${who === rm ? 'active' : ''}`}
                onClick={() => setWho(rm)}
              >
                {rm}
              </button>
            ))}
          </div>

          <label>What is it?</label>
          <div className="type-picker">
            <button
              type="button"
              className={`type-btn ${type === 'event' ? 'active' : ''}`}
              onClick={() => setType('event')}
            >
              📅 Event
            </button>
            <button
              type="button"
              className={`type-btn ${type === 'date' ? 'active date-active' : ''}`}
              onClick={() => setType('date')}
            >
              💕 Date
            </button>
          </div>

          {type === 'date' && (
            <input
              type="text"
              placeholder="Who's the date with? (required)"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
            />
          )}

          <textarea
            placeholder={
              type === 'date'
                ? 'Any other details? (optional)'
                : "What's the event? Who's coming?"
            }
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />

          <button type="submit" className="submit-btn">
            Reserve
          </button>
          <button type="button" className="cancel-btn" onClick={resetForm}>
            Cancel
          </button>
        </form>
      )}
    </div>
  )

  // ---- Day view ----
  const renderDayView = () => {
    const dStr = dateKey(anchor)
    const hourMap = buildDayMap(allReservations[dStr])

    // free hours are rows; a reservation is ONE card sized to span its hours
    const rows = []
    HOURS.forEach((hour) => {
      const res = hourMap[hour]
      if (!res) {
        rows.push(
          <div
            key={hour}
            className={`day-free-row ${selectedHour === hour && selectedDay && dateKey(selectedDay) === dStr ? 'selected' : ''}`}
            onClick={() => pickStart(anchor, hour)}
          >
            +
          </div>
        )
        return
      }
      if (res.hour !== hour) return // covered by the card below
      const span = resEnd(res) - res.hour
      const isDate = res.type === 'date'
      rows.push(
        <div
          key={hour}
          className={`day-res-card ${isDate ? 'is-date' : ''}`}
          style={{ height: `calc(${span} * var(--day-row-h) - 6px)` }}
        >
          <div className="res-card-top">
            <span className="res-name">
              {isDate ? '💕 ' : '📅 '}
              {res.name}
            </span>
            <span className="res-time">
              {formatHour(res.hour)} – {formatHour(resEnd(res))}
            </span>
          </div>
          <div className="res-card-details">
            {isDate ? `Date with ${res.guestName}` : res.details}
            {isDate && res.details ? ` — ${res.details}` : ''}
          </div>
          <button
            className="cell-delete visible"
            onClick={(e) => {
              e.stopPropagation()
              handleDelete(dStr, res.hour)
            }}
          >
            ✕
          </button>
        </div>
      )
    })

    return (
      <div className="week-view">
        <div className="day-view">
          <div className="day-grid">
            <div className="day-time-col">
              {HOURS.map((h) => (
                <div key={h} className="day-time-label">
                  {formatHour(h)}
                </div>
              ))}
            </div>
            <div className="day-body-col">{rows}</div>
          </div>
        </div>
        {renderForm()}
      </div>
    )
  }

  // ---- Week view ----
  const renderWeekView = () => (
    <div className="week-view">
      <div className="week-grid">
        <div className="grid-inner">
          <div className="time-column">
            <div className="day-header"></div>
            {HOURS.map((hour) => (
              <div key={hour} className="time-slot">
                {formatHour(hour)}
              </div>
            ))}
          </div>

          {weekDays.map((day) => {
            const dStr = dateKey(day)
            const isToday = dStr === todayKey
            const dayRes = allReservations[dStr] || {}
            const hasRes = Object.keys(dayRes).length > 0
            const hourMap = buildDayMap(dayRes)

            return (
              <div key={dStr} className={`day-column ${isToday ? 'today' : ''}`}>
                <div
                  className={`day-header clickable-header ${isToday ? 'today-header' : ''}`}
                  onClick={() => {
                    setAnchor(new Date(day))
                    switchMode('day')
                  }}
                  title="Open day view"
                >
                  <div className="day-name">
                    {day.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div className="day-date">
                    {day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>

                <div className="day-content">
                  {!hasRes ? (
                    <div
                      className="free-all clickable"
                      onClick={() => {
                        setSelectedDay(day)
                        setSelectedHour(null)
                        setEndHour(null)
                      }}
                    >
                      Free
                    </div>
                  ) : (
                    HOURS.map((hour) => {
                      const res = hourMap[hour]
                      if (!res) {
                        return (
                          <div
                            key={hour}
                            className="time-cell available"
                            onClick={() => pickStart(day, hour)}
                          >
                            <div className="cell-free"></div>
                          </div>
                        )
                      }
                      const isStart = res.hour === hour
                      const isEnd = hour === resEnd(res) - 1
                      const pos =
                        isStart && isEnd
                          ? 'res-single'
                          : isStart
                            ? 'res-start'
                            : isEnd
                              ? 'res-end'
                              : 'res-mid'
                      const isDate = res.type === 'date'
                      return (
                        <div
                          key={hour}
                          className={`time-cell reserved ${pos} ${isDate ? 'is-date' : ''}`}
                        >
                          <div className={`cell-res ${isStart ? '' : 'cell-cont'}`}>
                            {isStart && (
                              <>
                                <div className="res-name">
                                  {isDate ? '💕 ' : '📅 '}
                                  {res.name}
                                </div>
                                <div className="res-time">
                                  {formatHour(res.hour)} – {formatHour(resEnd(res))}
                                </div>
                                <div className="res-details">
                                  {isDate ? `Date with ${res.guestName}` : res.details}
                                </div>
                                <button
                                  className="cell-delete"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDelete(dStr, res.hour)
                                  }}
                                >
                                  ✕
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {renderForm()}
    </div>
  )

  // ---- Month view ----
  const renderMonthView = () => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
    const gridStart = mondayOf(first)
    const cells = []
    const cursor = new Date(gridStart)
    while (cursor <= last || cursor.getDay() !== 1) {
      cells.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
      if (cells.length > 42) break
    }

    return (
      <div className="month-view">
        <div className="month-weekdays">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="month-weekday">
              {d}
            </div>
          ))}
        </div>
        <div className="month-grid">
          {cells.map((day) => {
            const dStr = dateKey(day)
            const inMonth = day.getMonth() === anchor.getMonth()
            const isToday = dStr === todayKey
            const dayRes = Object.values(allReservations[dStr] || {}).sort(
              (a, b) => a.hour - b.hour
            )

            return (
              <div
                key={dStr}
                className={`month-cell ${inMonth ? '' : 'out-month'} ${isToday ? 'today' : ''}`}
                onClick={() => {
                  setAnchor(new Date(day))
                  switchMode('day')
                }}
              >
                <div className="month-daynum">{day.getDate()}</div>
                <div className="month-cell-items">
                  {dayRes.slice(0, 3).map((res, i) => (
                    <div
                      key={i}
                      className={`month-item ${res.type === 'date' ? 'is-date' : ''}`}
                    >
                      {res.name}
                    </div>
                  ))}
                  {dayRes.length > 3 && (
                    <div className="month-more">+{dayRes.length - 3} more</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <header className="app-header">
        <h1>🛋️ Couch Reservation</h1>
        <div className="view-toggle">
          <button
            className={view === 'calendar' ? 'active' : ''}
            onClick={() => setView('calendar')}
          >
            Calendar
          </button>
          <button
            className={view === 'roommates' ? 'active' : ''}
            onClick={() => setView('roommates')}
          >
            Roommates
          </button>
        </div>
      </header>

      {view === 'calendar' ? (
        <>
          <div className="week-nav">
            <div className="mode-toggle">
              {['day', 'week', 'month'].map((m) => (
                <button
                  key={m}
                  className={calMode === m ? 'active' : ''}
                  onClick={() => switchMode(m)}
                >
                  {m[0].toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
            <div className="nav-controls">
              <button onClick={() => navigate(-1)}>←</button>
              <h2>{navLabel()}</h2>
              <button onClick={() => navigate(1)}>→</button>
              <button className="today-btn" onClick={goToToday}>
                Today
              </button>
            </div>
          </div>

          {loading ? (
            <p className="loading-msg">Loading calendar...</p>
          ) : calMode === 'day' ? (
            renderDayView()
          ) : calMode === 'week' ? (
            renderWeekView()
          ) : (
            renderMonthView()
          )}
        </>
      ) : (
        <div className="roommates-view">
          {loading ? (
            <p className="loading-msg">Loading...</p>
          ) : (
            stats.map((rm) => (
              <div key={rm.name} className="roommate-card">
                <div className="rm-header">
                  <h3>{rm.name}</h3>
                  <div className="rm-totals">
                    <span className="badge event-badge">📅 {rm.events.length} events</span>
                    <span className="badge date-badge">💕 {rm.dates.length} dates</span>
                  </div>
                </div>

                {rm.events.length === 0 && rm.dates.length === 0 ? (
                  <p className="rm-empty">Hasn't reserved the couch yet 😴</p>
                ) : (
                  <>
                    {Object.keys(rm.guestCounts).length > 0 && (
                      <div className="rm-section">
                        <h4>Dates brought over</h4>
                        <ul>
                          {Object.entries(rm.guestCounts)
                            .sort(([, a], [, b]) => b - a)
                            .map(([guest, count]) => (
                              <li key={guest}>
                                <strong>{guest}</strong>
                                {count > 1 && (
                                  <span className="count-badge">×{count}</span>
                                )}
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}

                    {rm.events.length > 0 && (
                      <div className="rm-section">
                        <h4>Events</h4>
                        <ul>
                          {rm.events
                            .sort((a, b) => b.dateStr.localeCompare(a.dateStr))
                            .slice(0, 5)
                            .map((ev, i) => (
                              <li key={i}>
                                <span className="ev-date">
                                  {new Date(ev.dateStr + 'T00:00:00').toLocaleDateString(
                                    'en-US',
                                    { month: 'short', day: 'numeric' }
                                  )}
                                </span>{' '}
                                {ev.details}
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
