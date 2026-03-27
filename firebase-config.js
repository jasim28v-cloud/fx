// ============================================
// TELGRAMI - FIREBASE CONFIGURATION
// ============================================

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
if (typeof firebase !== 'undefined') {
    if (firebase.apps.length === 0) {
        firebase.initializeApp(firebaseConfig);
        console.log("✅ Firebase initialized successfully");
    }
} else {
    console.error("❌ Firebase SDK not loaded!");
}

// Firebase Services
const auth = firebase.auth();
const database = firebase.database();
const storage = firebase.storage();

// Cloudinary Configuration
const CLOUDINARY_CLOUD_NAME = "dnillsbmi";
const CLOUDINARY_UPLOAD_PRESET = "ekxzvogb";

// ========== Helper Functions ==========

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
    if (diff < 604800000) {
        const days = ['الأحد', 'الإثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
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
        'auth/weak-password': 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
        'auth/operation-not-allowed': 'هذه العملية غير مسموحة',
        'auth/network-request-failed': 'فشل الاتصال بالشبكة',
        'auth/too-many-requests': 'تم تعطيل الحساب مؤقتاً. حاول لاحقاً'
    };
    return errors[errorCode] || 'حدث خطأ غير متوقع';
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        <span>${message}</span>
    `;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        background: ${type === 'success' ? '#28a745' : '#dc3545'};
        color: white;
        padding: 12px 20px;
        border-radius: 30px;
        display: flex;
        align-items: center;
        gap: 10px;
        z-index: 3000;
        animation: slideUp 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Export to global
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

console.log("🚀 Telgrami Config Loaded");
