# Setup & Deployment Guide

## Local Development (Works Now!)

The app is currently using **localStorage** for data storage, which means:
- ✅ Reservations persist in your browser
- ✅ Works offline
- ⚠️ Each device has its own separate data

Start it with:
```bash
npm install
npm run dev
```

Then open http://localhost:3000

## Firebase Setup (Optional - For Real Sharing)

If you want everyone in your apartment to see the same reservations in real-time, use Firebase:

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Name it something like "couch-calendar"
4. Click "Create project"

### 2. Enable Realtime Database

1. In Firebase Console, go to **Build** → **Realtime Database**
2. Click "Create Database"
3. Start in **Test Mode** (easy for now, add security rules later)
4. Choose a region (us-central1 is fine)
5. Click "Enable"

### 3. Get Your Config

1. Click the gear icon → **Project Settings**
2. Scroll to **Your apps** section
3. Click the `</>` (web) icon to register a web app
4. Copy the Firebase config object

### 4. Update the App

Edit `src/firebase.js` and replace the placeholder values:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
  databaseURL: "https://YOUR_PROJECT.firebaseio.com"
}
```

### 5. Update App.jsx to Use Firebase

Replace the current `src/App.jsx` with the Firebase version (see comments in repo for the Firebase version).

### 6. Security Rules

In Firebase Console → Realtime Database → Rules, paste:

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

## Deploy to Railway

### Option 1: Using Railway CLI

```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### Option 2: GitHub + Railway Web

1. Push your code to GitHub
2. Go to [Railway.app](https://railway.app/)
3. Click "New Project" → "Deploy from GitHub"
4. Connect your GitHub account and select this repo
5. Railway auto-detects it's a Node.js project
6. Set environment variables if needed (Firebase config can be in code for simplicity)
7. Click "Deploy"

### Option 3: Using Dockerfile

Create `Dockerfile`:

```dockerfile
FROM node:20
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "preview"]
```

Then deploy to Railway.

## Switching Between localStorage and Firebase

### To Use localStorage (Default):
Current code already uses localStorage. Just run it!

### To Switch to Firebase:

Uncomment the Firebase import and replace the `useEffect` hook:

```javascript
import { db } from './firebase'
import { ref, onValue, set, remove } from 'firebase/database'

useEffect(() => {
  const dateStr = date.toISOString().split('T')[0]
  const resRef = ref(db, `reservations/${dateStr}`)

  const unsubscribe = onValue(resRef, (snapshot) => {
    if (snapshot.exists()) {
      setReservations(snapshot.val())
    } else {
      setReservations({})
    }
    setLoading(false)
  })

  return () => unsubscribe()
}, [date])
```

And update `handleReserve` and `handleDelete` to use Firebase's `set()` and `remove()` instead of localStorage.

## Features

- 📅 Daily couch reservation calendar (8 AM - 11 PM)
- 👤 Add your name to reservations
- 📝 Add event details (who's coming, what's happening)
- 🗑️ Delete your own reservations
- 📱 Mobile-friendly responsive design
- 🔄 Real-time sync with Firebase (optional)
- ✨ Super simple, clean UI

## Troubleshooting

**"Cannot parse Firebase url" error?**
- You haven't set up Firebase yet, OR
- Your Firebase config is incomplete
- Use localStorage for now, add Firebase later

**Reservations disappear after refresh?**
- You're using localStorage (normal, browser-specific)
- Set up Firebase to share across devices

**Port 3000 already in use?**
- Change the port in `vite.config.js`
- Or kill the process: `lsof -i :3000` then `kill -9 <PID>`

## Questions?

Firebase Docs: https://firebase.google.com/docs/database
Railway Docs: https://docs.railway.app
React Docs: https://react.dev
