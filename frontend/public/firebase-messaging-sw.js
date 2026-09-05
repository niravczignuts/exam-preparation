// Background push handler (KAN-72). Service workers are static files, not
// bundled by Vite, so this config is duplicated here rather than read from
// import.meta.env — Firebase's web config is not secret, only mirror the
// same values you put in frontend/.env (VITE_FIREBASE_*).
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDgqpWm7lMmkZ2UJngzw2ichy2ZbtG7qbY",
  authDomain: "exam-preparation-e3fad.firebaseapp.com",
  projectId: "exam-preparation-e3fad",
  storageBucket: "exam-preparation-e3fad.firebasestorage.app",
  messagingSenderId: "1079110780487",
  appId: "1:1079110780487:web:b14e0a4b9d2e08cee59362",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || "Exam Prep", {
    body: body || "",
    icon: "/pwa-icon.png",
  });
});
