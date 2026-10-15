// Serves the built site on Railway.
//
// One repo, two ways to run it:
//   APP unset      the Couch App at /, the 449 Exchange at /exchange/
//   APP=exchange   the 449 Exchange at the root of its own domain, for a
//                  second Railway service created from this same repo
//
// `npm run build` must have produced dist/ first (Railway runs it automatically).

import { createServer } from 'node:http'
import sirv from 'sirv'

const app = (process.env.APP || 'couch').toLowerCase()
const port = Number(process.env.PORT) || 3000

const files = sirv('dist', {
  etag: true,
  setHeaders(res, pathname) {
    // Vite fingerprints everything under /assets/, so those can be cached for
    // good; the HTML must always be re-checked so a deploy shows up at once
    res.setHeader(
      'Cache-Control',
      pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache'
    )
  }
})

createServer((req, res) => {
  if (app === 'exchange') {
    const url = req.url || '/'
    if (url === '/' || url.startsWith('/?')) req.url = `/exchange/${url.slice(1)}`
    else if (url === '/index.html') req.url = '/exchange/index.html'
  }
  files(req, res, () => {
    res.statusCode = 404
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end('Not found')
  })
}).listen(port, '0.0.0.0', () => {
  console.log(`${app === 'exchange' ? '449 Exchange' : 'Couch App + 449 Exchange'} listening on ${port}`)
})
