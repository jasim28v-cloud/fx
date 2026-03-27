// ============================================
// TELGRAMI - FIREBASE CONFIG (FIXED)
// ============================================

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAQEHv1K69ZtA48l1TpqUfAIJlmM20gZyA",
    authDomain: "tlgr-1436a.firebaseapp.com",
    databaseURL: "https://tlgr-1436a-default-rtdb.firebaseio.com",
    projectId: "tlgr-1436a",
    storageBucket: "tlgr-1436a.appspot.com",
    messagingSenderId: "128259219683",
    appId: "1:128259219683:web:b59f803204f226a5bda5d6"
};

// Initialize Firebase
let auth, database, storage;

try {
    if (typeof firebase !== 'undefined') {
        if (firebase.apps.length === 0) {
            firebase.initializeApp(firebaseConfig);
            console.log("✅ Firebase initialized");
        }
        auth = firebase.auth();
        database = firebase.database();
        storage = firebase.storage();
        console.log("✅ Firebase services ready");
    } else {
        console.error("❌ Firebase SDK not loaded");
    }
} catch (error) {
    console.error("❌ Firebase init error:", error);
}

// Cloudinary
const CLOUDINARY_CLOUD_NAME = "dnillsbmi";
const CLOUDINARY_UPLOAD_PRESET = "ekxzvogb";

// Helper Functions
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
    if (diff < 86400000) {
        return date.getHours() + ':' + String(date.getMinutes()).padStart(2, '0');
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
        'auth/weak-password': 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
        'auth/operation-not-allowed': 'تسجيل الدخول بالبريد الإلكتروني غير مفعل في Firebase',
        'auth/network-request-failed': 'فشل الاتصال بالشبكة، تأكد من اتصالك بالإنترنت',
        'auth/too-many-requests': 'تم تعطيل الحساب مؤقتاً، حاول لاحقاً'
    };
    return errors[errorCode] || 'حدث خطأ: ' + errorCode;
}

function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Export
window.auth = auth;
window.db = database;
window.storage = storage;
window.CLOUDINARY_CLOUD_NAME = CLOUDINARY_CLOUD_NAME;
window.CLOUDINARY_UPLOAD_PRESET = CLOUDINARY_UPLOAD_PRESET;
window.generateId = generateId;
window.formatTime = formatTime;
window.escapeHtml = escapeHtml;
window.getAuthErrorMessage = getAuthErrorMessage;
window.showToast = showToast;

console.log("✅ Config loaded - Auth ready:", !!auth);
