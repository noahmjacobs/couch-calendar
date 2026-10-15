// Pieces both the market and the calendar use.

import { useEffect, createContext, useContext } from 'react'
import { ROOMMATES, COLOR, INK } from './roommates.js'

export const load = (key, fallback) => {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : v
  } catch {
    return fallback
  }
}

export const save = (key, value) => {
  try {
    localStorage.setItem(key, value)
  } catch {}
}

export const describeAuthError = (e) => {
  const code = (e && e.code) || ''
  if (code === 'auth/operation-not-allowed') return 'Google sign-in is not switched on in Firebase yet.'
  if (code === 'auth/unauthorized-domain') return 'This address is not on the Firebase authorized domains list yet.'
  if (code === 'auth/popup-closed-by-user') return 'The sign-in window was closed before finishing.'
  if (code === 'auth/network-request-failed') return 'No connection. Try again in a moment.'
  return (e && e.message) || 'Sign-in failed.'
}

/* ---------- avatars ---------- */

// profile photos live in the shared database under profiles/{name}/photo so
// every phone shows them; this carries the loaded map down to every Avatar
export const PhotoContext = createContext({})

const PHOTO_SIZE = 160

// centre-crop the chosen image to a small square JPEG, so the database entry is
// a few KB rather than a multi-megabyte camera photo
export const squarePhoto = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const side = Math.min(img.width, img.height)
      const c = document.createElement('canvas')
      c.width = c.height = PHOTO_SIZE
      c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That file could not be read as an image.'))
    }
    img.src = url
  })

export const Avatar = ({ name, size = 36 }) => {
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
        // the roommate colour stays on as a ring around a photo
        boxShadow: photo ? `0 0 0 ${size >= 34 ? 2 : 1.5}px ${color}` : undefined
      }}
    >
      {photo ? null : name ? name[0] : '?'}
    </div>
  )
}

export const Chevron = () => (
  <svg className="chev" width="8" height="13" viewBox="0 0 8 13" aria-hidden="true">
    <path d="M1.5 1.5L6.5 6.5L1.5 11.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/* ---------- splash ---------- */

export const Splash = ({ leaving }) => (
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

/* iOS reports a short viewport while a standalone launch is still settling, and
   again when the app is resumed from the switcher, which left a strip of the
   screen uncovered until something forced a repaint. CSS units cannot see that,
   so the height is measured here and re-measured on every event that can follow
   a cold start. */
export const useAppHeight = () => {
  useEffect(() => {
    const apply = () => {
      const cands = [window.innerHeight, window.visualViewport && window.visualViewport.height, document.documentElement.clientHeight]
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
