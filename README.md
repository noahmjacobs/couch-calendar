# 🛋️ Couch Reservation Calendar

A simple shared calendar to reserve your apartment couch. No overbooking allowed!

## Features

- **Simple UI**: Just click a time slot to reserve it
- **Real-time sync**: Changes show up instantly for everyone
- **Daily view**: Navigate through dates with Previous/Next buttons
- **Full details**: Add your name and event details (who's coming, what's happening)
- **Delete reservations**: Remove your own reservations anytime
- **Mobile friendly**: Works on phones too

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use existing)
3. Enable **Realtime Database** (create in test mode for now)
4. Go to Project Settings → Service Accounts → Get your config
5. Copy your Firebase config values
6. Open `src/firebase.js` and replace the placeholder values with your real config:

```javascript
const firebaseConfig = {
  apiKey: "your_api_key_here",
  authDomain: "your_project.firebaseapp.com",
  projectId: "your_project_id",
  storageBucket: "your_project.appspot.com",
  messagingSenderId: "your_sender_id",
  appId: "your_app_id",
  databaseURL: "https://your_project.firebaseio.com"
}
```

### 3. Run Locally

```bash
npm run dev
```

Open http://localhost:3000 in your browser!

## Firebase Database Rules

For production, update your Firebase Realtime Database rules to this:

```json
{
  "rules": {
    "reservations": {
      ".read": true,
      ".write": true
    }
  }
}
```

Go to Firebase Console → Database → Rules and paste that in.

## Deploy to Railway

1. Push your code to GitHub
2. Go to [Railway.app](https://railway.app/)
3. Create new project → GitHub Repo
4. Select this repository
5. Add environment variables (same as your firebase.js)
6. Deploy!

Or use Railway CLI:
```bash
npm install -g @railway/cli
railway init
railway up
```

## How to Use

1. **Browse dates**: Use Previous/Next to navigate
2. **Pick a time**: Click any available (blue) time slot
3. **Fill info**: Enter your name and what the reservation is for
4. **Reserve**: Click the Reserve button
5. **Delete**: Click the X button on any reservation to remove it

Times available: 8 AM to 11 PM every day

Enjoy your organized couch! 🛋️
