import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getDatabase, ref, set, get, push, onValue, update, remove, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query as fsQuery, where, getDocs, updateDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAQEHv1K69ZtA48l1TpqUfAIJlmM20gZyA",
    authDomain: "tlgr-1436a.firebaseapp.com",
    databaseURL: "https://tlgr-1436a-default-rtdb.firebaseio.com",
    projectId: "tlgr-1436a",
    storageBucket: "tlgr-1436a.firebasestorage.app",
    messagingSenderId: "128259219683",
    appId: "1:128259219683:web:b59f803204f226a5bda5d6",
    measurementId: "G-K4W3BBTV0G"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
const firestore = getFirestore(app);

// Admin credentials
const ADMIN_EMAIL = "jasim28v@gmail.com";
const ADMIN_CODE = "vv2314vv";

export { 
    auth, 
    database, 
    firestore,
    ref, set, get, push, onValue, update, remove, query, orderByChild, equalTo,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    doc, setDoc, getDoc, collection, addDoc, fsQuery, where, getDocs, updateDoc, deleteDoc, onSnapshot,
    ADMIN_EMAIL,
    ADMIN_CODE
};
