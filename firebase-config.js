// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getDatabase, 
    ref, 
    push, 
    set, 
    update, 
    get, 
    query, 
    orderByChild, 
    limitToLast, 
    onChildAdded, 
    onChildChanged, 
    onChildRemoved,
    onDisconnect,
    serverTimestamp,
    remove,
    runTransaction
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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
const db = getDatabase(app);
const auth = getAuth(app);

// Database References
const usersRef = ref(db, 'users');
const chatsRef = ref(db, 'chats');
const messagesRef = ref(db, 'messages');
const mediaLogsRef = ref(db, 'mediaLogs');
const bannedRef = ref(db, 'banned');
const presenceRef = ref(db, 'presence');
const userChatsRef = ref(db, 'userChats');

// Cloudinary Configuration
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dnillsbmi/upload";
const UPLOAD_PRESET = "ekxzvogb";

// Helper Functions
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'الآن';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} د`;
    if (diff < 86400000) return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) return ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][date.getDay()];
    return `${date.getDate()}/${date.getMonth() + 1}`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Upload Media with Compression
async function uploadMedia(file, onProgress) {
    return new Promise((resolve, reject) => {
        const maxSize = 1024 * 1024; // 1MB for compression trigger
        let blobToUpload = file;
        
        // Compress images if larger than 1MB
        if (file.type.startsWith('image/') && file.size > maxSize) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    let width = img.width;
                    let height = img.height;
                    const maxDim = 1280;
                    
                    if (width > maxDim || height > maxDim) {
                        if (width > height) {
                            height = (height * maxDim) / width;
                            width = maxDim;
                        } else {
                            width = (width * maxDim) / height;
                            height = maxDim;
                        }
                    }
                    
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    canvas.toBlob((blob) => {
                        uploadToCloudinary(blob, file.type, onProgress).then(resolve).catch(reject);
                    }, file.type, 0.7);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            uploadToCloudinary(file, file.type, onProgress).then(resolve).catch(reject);
        }
    });
}

async function uploadToCloudinary(blob, fileType, onProgress) {
    const formData = new FormData();
    formData.append('file', blob);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('folder', 'tlgrami');
    
    const xhr = new XMLHttpRequest();
    
    return new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable && onProgress) {
                onProgress((e.loaded / e.total) * 100);
            }
        });
        
        xhr.onload = () => {
            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                resolve(response.secure_url);
            } else {
                reject(new Error('Upload failed'));
            }
        };
        
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.open('POST', CLOUDINARY_URL);
        xhr.send(formData);
    });
}

export {
    db,
    auth,
    usersRef,
    chatsRef,
    messagesRef,
    mediaLogsRef,
    bannedRef,
    presenceRef,
    userChatsRef,
    ref,
    push,
    set,
    update,
    get,
    query,
    orderByChild,
    limitToLast,
    onChildAdded,
    onChildChanged,
    onChildRemoved,
    onDisconnect,
    serverTimestamp,
    remove,
    runTransaction,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    updateProfile,
    generateId,
    formatTime,
    escapeHtml,
    uploadMedia,
    CLOUDINARY_URL,
    UPLOAD_PRESET
};
