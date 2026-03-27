// إعدادات Firebase الخاصة بك
const firebaseConfig = {
    apiKey: "AIzaSyAQEHv1K69ZtA48l1TpqUfAIJlmM20gZyA",
    authDomain: "tlgr-1436a.firebaseapp.com",
    databaseURL: "https://tlgr-1436a-default-rtdb.firebaseio.com/",
    projectId: "tlgr-1436a",
    storageBucket: "tlgr-1436a.appspot.com",
    messagingSenderId: "128259219683",
    appId: "1:128259219683:web:b59f803204f226a5bda5d6",
    measurementId: "G-K4W3BBTV0G"
};

// تهيئة Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();
const storage = firebase.storage();

// إعداد Cloudinary
const CLOUDINARY_CLOUD_NAME = "dnillsbmi";
const CLOUDINARY_UPLOAD_PRESET = "ekxzvogb";
