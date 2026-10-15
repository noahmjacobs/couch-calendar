// Hand-rolled SVG charts: thin 2px lines, hairline grid, an area wash, a crosshair
// tooltip that snaps to the nearest day, and a table twin so no value is gated
// behind hover. Colours arrive as CSS variables so light and dark each get their
// own validated stroke.

import { useMemo, useRef, useState } from 'react'
import { fmtMoney, fmtDay } from './market.js'

const niceTicks = (min, max, count = 3) => {
  const span = max - min || 1
  const rough = span / (count - 1)
  const mag = Math.pow(10, Math.floor(Math.log10(rough)))
  const steps = [1, 2, 2.5, 5, 10]
  const step = steps.map((s) => s * mag).find((s) => s >= rough) || 10 * mag
  const start = Math.ceil(min / step) * step
  const out = []
  for (let v = start; v <= max + 1e-9; v += step) out.push(Math.round(v * 100) / 100)
  return out
}

const scale = (values, height, pad) => {
  let lo = Math.min(...values)
  let hi = Math.max(...values)
  if (hi === lo) {
    lo -= 1
    hi += 1
  }
  const room = (hi - lo) * 0.12
  lo -= room
  hi += room
  return { lo, hi, y: (v) => pad.top + (1 - (v - lo) / (hi - lo)) * (height - pad.top - pad.bottom) }
}

/* ---------- sparkline (no axes, no tooltip: the row's number is the label) ---------- */

export const Sparkline = ({ points, color, width = 72, height = 28 }) => {
  if (!points || points.length < 2) return <svg width={width} height={height} aria-hidden="true" />
  const pad = { top: 4, bottom: 4 }
  const { y } = scale(points, height, pad)
  const x = (i) => 5 + (i / (points.length - 1)) * (width - 10)
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p).toFixed(1)}`).join(' ')
  const last = points.length - 1
  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={d} fill="none" style={{ stroke: color }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(last)} cy={y(points[last])} r="4.5" className="spark-ring" />
      <circle cx={x(last)} cy={y(points[last])} r="3" style={{ fill: color }} />
    </svg>
  )
}

/* ---------- shared hover machinery ---------- */

const useHover = (count) => {
  const [idx, setIdx] = useState(null)
  const onMove = (e, left, right) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    const t = (px - left) / (right - left)
    const i = Math.max(0, Math.min(count - 1, Math.round(t * (count - 1))))
    setIdx(i)
  }
  const onKey = (e) => {
    if (e.key === 'ArrowRight') setIdx((i) => Math.min(count - 1, (i == null ? count - 1 : i) + 1))
    else if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, (i == null ? count - 1 : i) - 1))
    else if (e.key === 'Escape') setIdx(null)
    else return
    e.preventDefault()
  }
  return { idx, setIdx, onMove, onKey }
}

// first, middle and last day; the opening point says IPO rather than repeating
// the date of the first close
const xLabels = (points) => {
  const text = (i) => (i === 0 && points[0].label ? points[0].label : fmtDay(points[i].day))
  if (points.length <= 1) return [{ i: 0, text: text(0) }]
  const mid = Math.floor((points.length - 1) / 2)
  const idxs = points.length >= 3 ? [0, mid, points.length - 1] : [0, points.length - 1]
  return idxs.map((i) => ({ i, text: text(i) }))
}

/* ---------- one listing ---------- */

export const PriceChart = ({ series, color, height = 220, title = 'Price' }) => {
  const wrap = useRef(null)
  const [width, setWidth] = useState(340)
  const n = series.length
  const { idx, setIdx, onMove, onKey } = useHover(n)

  // measured once laid out; charts live in a fixed-width column so this is stable
  const measure = (el) => {
    wrap.current = el
    if (el && el.clientWidth && el.clientWidth !== width) setWidth(el.clientWidth)
  }

  const pad = { top: 14, right: 64, bottom: 26, left: 10 }
  const values = series.map((p) => p.price)
  const { lo, hi, y } = scale(values, height, pad)
  const x = (i) => pad.left + (n > 1 ? (i / (n - 1)) * (width - pad.left - pad.right) : 0)
  const ticks = niceTicks(lo, hi, 3)
  const path = series.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.price).toFixed(1)}`).join(' ')
  const area = n > 1 ? `${path} L${x(n - 1).toFixed(1)} ${(height - pad.bottom).toFixed(1)} L${x(0).toFixed(1)} ${(height - pad.bottom).toFixed(1)} Z` : ''
  const last = series[n - 1]
  const gradId = useMemo(() => `wash-${Math.random().toString(36).slice(2, 8)}`, [])
  const hovered = idx != null ? series[idx] : null
  const labels = xLabels(series)

  return (
    <div className="chart">
      <div
        className="chart-plot"
        ref={measure}
        tabIndex={0}
        role="img"
        aria-label={`${title} chart, ${n} points, latest ${fmtMoney(last.price)}`}
        onKeyDown={onKey}
        onBlur={() => setIdx(null)}
      >
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <defs>
            <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" style={{ stopColor: color, stopOpacity: 0.16 }} />
              <stop offset="1" style={{ stopColor: color, stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line className="grid" x1={pad.left} x2={width - pad.right + 6} y1={y(t)} y2={y(t)} />
              <text className="tick" x={width - pad.right + 10} y={y(t) + 4}>
                {fmtMoney(t)}
              </text>
            </g>
          ))}
          {labels.map((l) => (
            <text
              key={l.i}
              className="tick"
              x={x(l.i)}
              y={height - 6}
              textAnchor={l.i === 0 ? 'start' : l.i === n - 1 ? 'end' : 'middle'}
            >
              {l.text}
            </text>
          ))}
          {area ? <path d={area} fill={`url(#${gradId})`} /> : null}
          <path d={path} fill="none" style={{ stroke: color }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {hovered ? (
            <line className="crosshair" x1={x(idx)} x2={x(idx)} y1={pad.top - 6} y2={height - pad.bottom} />
          ) : null}
          <circle cx={x(n - 1)} cy={y(last.price)} r="6" className="ring" />
          <circle cx={x(n - 1)} cy={y(last.price)} r="4" style={{ fill: color }} />
          {hovered && idx !== n - 1 ? (
            <>
              <circle cx={x(idx)} cy={y(hovered.price)} r="6" className="ring" />
              <circle cx={x(idx)} cy={y(hovered.price)} r="4" style={{ fill: color }} />
            </>
          ) : null}
          <rect
            className="hit"
            x="0"
            y="0"
            width={width}
            height={height}
            onPointerMove={(e) => onMove(e, x(0), x(n - 1))}
            onPointerDown={(e) => onMove(e, x(0), x(n - 1))}
            onPointerLeave={() => setIdx(null)}
          />
        </svg>
        {hovered ? (
          <div
            className="tip"
            style={{
              left: Math.min(Math.max(x(idx), 70), width - 70),
              top: Math.max(0, y(hovered.price) - 58)
            }}
          >
            <div className="tip-value">{fmtMoney(hovered.price)}</div>
            <div className="tip-label">
              {hovered.label ? `${hovered.label} · ` : ''}
              {hovered.live ? 'Now · ' : ''}
              {fmtDay(hovered.day, { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          </div>
        ) : null}
      </div>
      <details className="chart-table">
        <summary>Show as table</summary>
        <table>
          <thead>
            <tr>
              <th>Day</th>
              <th>{title}</th>
            </tr>
          </thead>
          <tbody>
            {[...series].reverse().map((p) => (
              <tr key={p.day + (p.live ? '-live' : '')}>
                <td>
                  {fmtDay(p.day)}
                  {p.label ? ` (${p.label})` : p.live ? ' (now)' : ''}
                </td>
                <td>{fmtMoney(p.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}

/* ---------- every listing on one axis ---------- */

// series: [{ key, label, color, points: [{day, price}] }], all on the same days
export const MultiChart = ({ series, height = 240 }) => {
  const [width, setWidth] = useState(340)
  const days = series[0].points.map((p) => p.day)
  const n = days.length
  const { idx, setIdx, onMove, onKey } = useHover(n)
  const measure = (el) => {
    if (el && el.clientWidth && el.clientWidth !== width) setWidth(el.clientWidth)
  }
  const pad = { top: 12, right: 54, bottom: 26, left: 58 }
  const all = series.flatMap((s) => s.points.map((p) => p.price))
  const { lo, hi, y } = scale(all, height, pad)
  const x = (i) => pad.left + (n > 1 ? (i / (n - 1)) * (width - pad.left - pad.right) : 0)
  const ticks = niceTicks(lo, hi, 3)
  const labels = xLabels(series[0].points)

  // end labels: sorted by position, nudged apart so none overlap; a short leader
  // joins each label to its line end when it had to move
  const ends = series
    .map((s) => ({ key: s.key, label: s.label, color: s.color, yLine: y(s.points[n - 1].price) }))
    .sort((a, b) => a.yLine - b.yLine)
  const MIN_GAP = 14
  let cursor = -Infinity
  ends.forEach((e) => {
    e.yLabel = Math.max(e.yLine, cursor + MIN_GAP)
    cursor = e.yLabel
  })
  // push back up if the bottom overflowed
  const overflow = cursor - (height - pad.bottom - 4)
  if (overflow > 0) {
    for (let i = ends.length - 1, limit = height - pad.bottom - 4; i >= 0; i--) {
      ends[i].yLabel = Math.min(ends[i].yLabel, limit)
      limit = ends[i].yLabel - MIN_GAP
    }
  }

  return (
    <div className="chart">
      <div
        className="chart-plot"
        ref={measure}
        tabIndex={0}
        role="img"
        aria-label={`All listings, ${n} trading days`}
        onKeyDown={onKey}
        onBlur={() => setIdx(null)}
      >
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line className="grid" x1={pad.left} x2={width - pad.right - 4} y1={y(t)} y2={y(t)} />
              <text className="tick" x={pad.left - 8} y={y(t) + 4} textAnchor="end">
                {fmtMoney(t)}
              </text>
            </g>
          ))}
          {labels.map((l) => (
            <text
              key={l.i}
              className="tick"
              x={x(l.i)}
              y={height - 6}
              textAnchor={l.i === 0 ? 'start' : l.i === n - 1 ? 'end' : 'middle'}
            >
              {l.text}
            </text>
          ))}
          {series.map((s) => (
            <path
              key={s.key}
              d={s.points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.price).toFixed(1)}`).join(' ')}
              fill="none"
              style={{ stroke: s.color }}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {idx != null ? <line className="crosshair" x1={x(idx)} x2={x(idx)} y1={pad.top - 6} y2={height - pad.bottom} /> : null}
          {series.map((s) => {
            const i = idx != null ? idx : n - 1
            return (
              <g key={s.key}>
                <circle cx={x(i)} cy={y(s.points[i].price)} r="5.5" className="ring" />
                <circle cx={x(i)} cy={y(s.points[i].price)} r="3.5" style={{ fill: s.color }} />
              </g>
            )
          })}
          {ends.map((e) => (
            <g key={e.key}>
              {Math.abs(e.yLabel - e.yLine) > 1 ? (
                <line className="leader" x1={x(n - 1) + 6} y1={e.yLine} x2={width - pad.right + 8} y2={e.yLabel} />
              ) : null}
              <text className="end-label" x={width - pad.right + 11} y={e.yLabel + 4}>
                {e.label}
              </text>
            </g>
          ))}
          <rect
            className="hit"
            x="0"
            y="0"
            width={width}
            height={height}
            onPointerMove={(e) => onMove(e, x(0), x(n - 1))}
            onPointerDown={(e) => onMove(e, x(0), x(n - 1))}
            onPointerLeave={() => setIdx(null)}
          />
        </svg>
        {idx != null ? (
          <div className="tip multi" style={{ left: Math.min(Math.max(x(idx), 84), width - 84), top: 0 }}>
            <div className="tip-label">
              {fmtDay(days[idx], { weekday: 'short', month: 'short', day: 'numeric' })}
              {series[0].points[idx].live ? ' · now' : ''}
            </div>
            {[...series]
              .sort((a, b) => b.points[idx].price - a.points[idx].price)
              .map((s) => (
                <div key={s.key} className="tip-row">
                  <i className="key" style={{ background: s.color }} />
                  <span className="tip-value">{fmtMoney(s.points[idx].price)}</span>
                  <span className="tip-name">{s.label}</span>
                </div>
              ))}
          </div>
        ) : null}
      </div>
      <details className="chart-table">
        <summary>Show as table</summary>
        <table>
          <thead>
            <tr>
              <th>Day</th>
              {series.map((s) => (
                <th key={s.key}>{s.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d, i) => i).reverse().map((i) => (
              <tr key={days[i] + i}>
                <td>{fmtDay(days[i])}</td>
                {series.map((s) => (
                  <td key={s.key}>{fmtMoney(s.points[i].price)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
