import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, remove, set, onValue } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAQEHv1K69ZtA48l1TpqUfAIJlmM20gZyA",
  databaseURL: "https://tlgr-1436a-default-rtdb.firebaseio.com",
  authDomain: "tlgr-1436a.firebaseapp.com",
  projectId: "tlgr-1436a"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// مراقب حالة تسجيل الدخول للمسؤول jasim28v
onAuthStateChanged(auth, (user) => {
  if (user && user.email === 'jasim28v@gmail.com') {
    console.log("Admin session initialized for jasim28v");
  }
});

export { 
  app, db, auth, provider, 
  signInWithPopup, onAuthStateChanged, signOut,
  ref, push, onChildAdded, remove, set, onValue 
};
