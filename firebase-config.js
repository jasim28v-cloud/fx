// ============================================
// FIREBASE CONFIGURATION - TELGRAMI
// ============================================

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
firebase.initializeApp(firebaseConfig);

// التصدير للاستخدام العالمي
const auth = firebase.auth();
const database = firebase.database();
const storage = firebase.storage();

// إعدادات Cloudinary
const CLOUDINARY_CLOUD_NAME = "dnillsbmi";
const CLOUDINARY_UPLOAD_PRESET = "ekxzvogb";

// دوال مساعدة عامة
function generateId() {
    return database.ref().push().key;
}

function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'الآن';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' د';
    if (diff < 86400000) return date.getHours() + ':' + String(date.getMinutes()).padStart(2, '0');
    if (diff < 604800000) {
        const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        return days[date.getDay()];
    }
    return date.toLocaleDateString('ar-EG');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getAuthErrorMessage(errorCode) {
    const errors = {
        'auth/invalid-email': 'البريد الإلكتروني غير صالح',
        'auth/user-disabled': 'هذا الحساب معطل',
        'auth/user-not-found': 'لا يوجد حساب بهذا البريد الإلكتروني',
        'auth/wrong-password': 'كلمة المرور غير صحيحة',
        'auth/email-already-in-use': 'هذا البريد الإلكتروني مستخدم بالفعل',
        'auth/weak-password': 'كلمة المرور ضعيفة جداً',
        'auth/operation-not-allowed': 'هذه العملية غير مسموحة',
        'auth/network-request-failed': 'فشل الاتصال بالشبكة'
    };
    return errors[errorCode] || 'حدث خطأ غير متوقع';
}

// تصدير للاستخدام العالمي
window.auth = auth;
window.db = database;
window.storage = storage;
window.CLOUDINARY_CLOUD_NAME = CLOUDINARY_CLOUD_NAME;
window.CLOUDINARY_UPLOAD_PRESET = CLOUDINARY_UPLOAD_PRESET;
window.generateId = generateId;
window.formatTime = formatTime;
window.escapeHtml = escapeHtml;
window.getAuthErrorMessage = getAuthErrorMessage;
