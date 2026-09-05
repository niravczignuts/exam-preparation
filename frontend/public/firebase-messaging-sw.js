// Background push handler (KAN-72). Service workers are static files, not
// bundled by Vite, so this config is duplicated here rather than read from
// import.meta.env — Firebase's web config is not secret, only mirror the
// same values you put in frontend/.env (VITE_FIREBASE_*).
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "REPLACE_WITH_VITE_FIREBASE_API_KEY",
  authDomain: "REPLACE_WITH_VITE_FIREBASE_AUTH_DOMAIN",
  projectId: "REPLACE_WITH_VITE_FIREBASE_PROJECT_ID",
  storageBucket: "REPLACE_WITH_VITE_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "REPLACE_WITH_VITE_FIREBASE_MESSAGING_SENDER_ID",
  appId: "REPLACE_WITH_VITE_FIREBASE_APP_ID",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || "Exam Prep", {
    body: body || "",
    icon: "/pwa-icon.png",
  });
});
