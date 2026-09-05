import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initOfflineSync } from './lib/offlineQueue'

// Registered unconditionally on load (KAN-63/64) — not gated behind the
// "Enable notifications" button, so offline caching works for everyone.
// firebase.ts's requestPushToken() reuses this same registration instead of
// registering a second service worker at the same scope.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/firebase-messaging-sw.js')
      .then(() => initOfflineSync())
      .catch((err) => console.error('Service worker registration failed', err))
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
