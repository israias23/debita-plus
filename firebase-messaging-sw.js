importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

// Configuração EMBUITIDA: O Service Worker DEVE ter a configuração completa.
firebase.initializeApp({
  apiKey: "AIzaSyAfNZIeDhfZ-JgvhFmHPuLeyXDm8Pvf6iE",
  authDomain: "debitaplus.firebaseapp.com",
  projectId: "debitaplus", // ESSENCIAL: O Service Worker precisa disso hardcoded
  storageBucket: "debitaplus.firebasestorage.app",
  messagingSenderId: "172288027756",
  appId: "1:172288027756:web:171dad6cfb9cf6806dfc49"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload){
  const title = payload.notification?.title || 'Débita+';
  const options = { body: payload.notification?.body || '', icon: '/assets/icons/icon-192.png' };
  self.registration.showNotification(title, options);
});