import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyBEYB7HG6Cug4kRsDeJQjhSAT6saNKPE70",
  authDomain: "couch-reservation.firebaseapp.com",
  projectId: "couch-reservation",
  storageBucket: "couch-reservation.firebasestorage.app",
  messagingSenderId: "635563517534",
  appId: "1:635563517534:web:d9be8201f8bb8e25f736cf",
  databaseURL: "https://couch-reservation-default-rtdb.firebaseio.com"
}

const app = initializeApp(firebaseConfig)
export const db = getDatabase(app)
// Google sign-in: the couch calendar is roommates only, and the exchange uses
// it to recognise the reviewer
export const auth = getAuth(app)
