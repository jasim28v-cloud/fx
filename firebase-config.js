// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAQEHv1K69ZtA48l1TpqUfAIJlmM20gZyA",
    authDomain: "tlgr-1436a.firebaseapp.com",
    databaseURL: "https://tlgr-1436a-default-rtdb.firebaseio.com",
    projectId: "tlgr-1436a",
    storageBucket: "tlgr-1436a.firebasestorage.app",
    messagingSenderId: "128259219683",
    appId: "1:128259219683:web:b59f803204f226a5bda5d6"
};

if (typeof firebase !== 'undefined' && firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const database = firebase.database();
const storage = firebase.storage();

const CLOUDINARY_CLOUD_NAME = "dnillsbmi";
const CLOUDINARY_UPLOAD_PRESET = "ekxzvogb";

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

function getAuthErrorMessage(code) {
    const errors = {
        'auth/invalid-email': 'البريد الإلكتروني غير صالح',
        'auth/user-not-found': 'لا يوجد حساب',
        'auth/wrong-password': 'كلمة المرور غير صحيحة',
        'auth/email-already-in-use': 'البريد مستخدم',
        'auth/weak-password': 'كلمة المرور ضعيفة'
    };
    return errors[code] || 'حدث خطأ';
}

function showToast(msg, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check' : 'exclamation'}"></i> ${msg}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

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
