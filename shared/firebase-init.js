// Пока заглушка. На шаге 3 вставим реальные ключи Firebase.
window.firebaseConfig = {
  apiKey: "TODO",
  authDomain: "TODO",
  databaseURL: "TODO",
  projectId: "TODO",
  appId: "TODO"
};

window.initFirebase = function() {
  if (!window.firebase || window.firebaseApp) return;
  window.firebaseApp = firebase.initializeApp(window.firebaseConfig);
  window.firebaseDb = firebase.database();
  firebase.auth().signInAnonymously().catch(console.error);
};
