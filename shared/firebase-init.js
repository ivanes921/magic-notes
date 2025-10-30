// /shared/firebase-init.js
const firebaseConfig = {
  apiKey: "AIzaSyAq94jzATkSmLw8HrBa2dgzGdOT5VVBEt",
  authDomain: "magic-nootes.firebaseapp.com",
  databaseURL: "https://magic-nootes-default-rtdb.firebaseio.com",
  projectId: "magic-nootes",
  storageBucket: "magic-nootes.appspot.com",
  messagingSenderId: "413341740753",
  appId: "1:413341740753:web:c194789ff81a47f7675ff0"
};

(function init(){
  if (window.firebaseApp) return;
  firebase.initializeApp(firebaseConfig);
  window.firebaseApp = firebase.app();
  window.firebaseDb = firebase.database();
  firebase.auth().signInAnonymously().catch(console.error);
})();
