const firebaseConfig = {
    apiKey: "AIzaSyA0i1EPCS5ZEZA_u7weqYhPL6cqExuj_eU",
    authDomain: "toke-800a7.firebaseapp.com",
    databaseURL: "https://toke-800a7-default-rtdb.firebaseio.com",
    projectId: "toke-800a7",
    storageBucket: "toke-800a7.firebasestorage.app",
    messagingSenderId: "332051016484",
    appId: "1:332051016484:web:f6b71128c6013d991b21b1",
    measurementId: "G-HZZ98K6HB6"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.database();
const storage = firebase.storage();

const CLOUD_NAME = 'daemk3hut';
const UPLOAD_PRESET = 'fok2_k';

const AGORA_APP_ID_CALL = '4017f66ea15f4ce088e8d8993a072a5b';

const ADMIN_EMAIL = 'jasim300v@gmail.com';
const ADMIN_PASSWORD = 'xx2314xx';

console.log('✅ TOKE - Firebase, Cloudinary & Agora Ready');
