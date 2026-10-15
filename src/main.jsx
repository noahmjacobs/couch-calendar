import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './exchange/Exchange'
import './style.css'
import './exchange/exchange.css'
import './calendar/calendar.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
