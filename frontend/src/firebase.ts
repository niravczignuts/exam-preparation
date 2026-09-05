import { initializeApp } from "firebase/app";
import { getMessaging, getToken, isSupported, type Messaging } from "firebase/messaging";

// All public — Firebase web config is not a secret, it's baked into the
// client bundle. Real values come from Vite env vars (see .env.example).
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

/**
 * Requests notification permission and returns an FCM registration token,
 * or null if unsupported/denied. Send the token to the backend's
 * device-token endpoint (KAN-72) so scheduled jobs can push to this device.
 */
export async function requestPushToken(): Promise<string | null> {
  if (!(await isSupported())) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const messaging: Messaging = getMessaging(app);
  return getToken(messaging, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
}

export { app };
