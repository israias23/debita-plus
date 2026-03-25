importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "",
  authDomain: "",
  projectId: ""
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload){
  const title = payload.notification?.title || 'Débita+';
  const options = { body: payload.notification?.body || '', icon: '/assets/icons/icon-192.png' };
  self.registration.showNotification(title, options);
});
