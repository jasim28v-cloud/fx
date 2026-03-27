// firebase-config.js - نسخة محسنة
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

// Cloudinary للإعلاميات
const CLOUDINARY_CLOUD_NAME = "dnillsbmi";
const CLOUDINARY_UPLOAD_PRESET = "ekxzvogb";

// إعدادات إضافية
const APP_SETTINGS = {
    maxMessageLength: 4096,
    maxStoryDuration: 24, // ساعات
    callTimeout: 30000, // مللي ثانية
    typingTimeout: 3000,
    lastSeenTimeout: 60000
};

// دالة لإنشاء معرف فريد
function generateId() {
    return database.ref().push().key;
}

// دالة لتنسيق الوقت
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'الآن';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' د';
    if (diff < 86400000) return date.getHours() + ':' + date.getMinutes();
    if (diff < 604800000) return ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][date.getDay()];
    return date.toLocaleDateString('ar-EG');
}

// دالة لإظهار الإشعارات
function showNotification(title, body, icon = null) {
    if (Notification.permission === 'granted') {
        new Notification(title, { body, icon });
    }
}
