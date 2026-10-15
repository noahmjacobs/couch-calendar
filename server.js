// Serves the built site on Railway: dist/ at /, every other path 404.
// `npm run build` must have produced dist/ first (Railway runs it automatically).

import { createServer } from 'node:http'
import sirv from 'sirv'

const port = Number(process.env.PORT) || 3000

const files = sirv('dist', {
  etag: true,
  setHeaders(res, pathname) {
    // Vite fingerprints everything under /assets/, so those can be cached for
    // good; the HTML must always be re-checked so a deploy shows up at once
    res.setHeader('Cache-Control', pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache')
  }
})

createServer((req, res) => {
  // the old exchange address keeps working
  if (req.url === '/exchange' || (req.url || '').startsWith('/exchange/')) req.url = '/' + (req.url.split('?')[1] ? `?${req.url.split('?')[1]}` : '')
  files(req, res, () => {
    res.statusCode = 404
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end('Not found')
  })
}).listen(port, '0.0.0.0', () => {
  console.log(`449 Boyos listening on ${port}`)
})
