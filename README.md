# 🛋️📈 449 Boyos

One app for the apartment, at the couch calendar's address:

- **Market, Events, About**: the 449 Exchange, the roommate stock market.
  Public. Anyone can watch the board and report an event; only roommates
  see the events behind the numbers. The rules, the pricing and the daily
  routine are in [EXCHANGE.md](EXCHANGE.md).
- **Calendar**: the couch reservation calendar, roommates only. Google
  sign-in, then each roommate claims their name once and it sticks to that
  Google account. Day, week and month views, bookings on a 15-minute grid,
  requests to release a booking, partner autofill, profile photos.
- **You** (the About tab once signed in): profile photo, partner, appearance,
  sign out.

Everything opens behind the 449 Boyos splash.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # the pricing engine's unit tests
npm run build && npm start   # what Railway runs
```

Add `?demo` to the address to see the board with made-up history, signed in
as Noah; `?demo&outsider` shows what the public sees.

## Hosting

Railway builds with `npm run build` and starts `server.js`, a small static
server over `dist/`. One service, deploying from `main`. The old `/exchange/`
address redirects to the root.

## Firebase

Both halves use the same Firebase project and Realtime Database, with the
config in `src/firebase.js`. Google sign-in must be enabled and the site's
domain listed under Authentication → Settings → Authorized domains. The
database rules are checked in as `database.rules.json` and published from
the console (Realtime Database → Rules); they keep reservations private to
signed-in roommates, let a name be claimed once, let anyone add an event
report and only Noah's account change or delete one.
