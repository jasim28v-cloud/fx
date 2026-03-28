// script.js - Main Application Logic with Ultra Modern UI
import { initializeApp } from "firebase/app";
import { 
    getDatabase, ref, push, set, update, get, query, 
    orderByChild, limitToLast, onChildAdded, onChildChanged,
    onDisconnect, remove, serverTimestamp 
} from "firebase/database";
import { 
    getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
    onAuthStateChanged, signOut, updateProfile 
} from "firebase/auth";

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// Cloudinary Configuration
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dnillsbmi/upload";
const UPLOAD_PRESET = "ekxzvogb";

// Global State
let currentUser = null;
let currentChatId = null;
let allChats = new Map();
let messagesCache = new Map();
let bannedUsers = new Set();
let onlineUsers = new Set();
let activeFolder = 'all';
let searchQuery = '';

// DOM Elements
let chatListContainer, messagesContainer, messageInput, sendBtn, fileInput;
let searchInput, scrollToBottom, chatName, chatStatus, chatAvatar;
let loginForm, registerForm, loginTab, registerTab, authContainer, chatInterface;
let adminModal, toast;

// Toast Notification
function showToast(message, isError = false) {
    if (!toast) return;
    toast.textContent = message;
    toast.style.background = isError ? '#dc2626' : '#2481cc';
    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Create Particles Background
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;
    
    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        const size = Math.random() * 4 + 2;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.animationDuration = `${Math.random() * 20 + 10}s`;
        particle.style.animationDelay = `${Math.random() * 5}s`;
        particlesContainer.appendChild(particle);
    }
}

// Upload Media
async function uploadMedia(file, onProgress) {
    return new Promise((resolve, reject) => {
        let blobToUpload = file;
        
        if (file.type.startsWith('image/') && file.size > 1024 * 1024) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    let width = img.width, height = img.height;
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

function uploadToCloudinary(blob, fileType, onProgress) {
    const formData = new FormData();
    formData.append('file', blob);
    formData.append('upload_preset', UPLOAD_PRESET);
    
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable && onProgress) {
                onProgress((e.loaded / e.total) * 100);
            }
        });
        xhr.onload = () => {
            if (xhr.status === 200) {
                resolve(JSON.parse(xhr.responseText).secure_url);
            } else {
                reject(new Error('Upload failed'));
            }
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.open('POST', CLOUDINARY_URL);
        xhr.send(formData);
    });
}

// Authentication Functions
async function login(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        currentUser = userCredential.user;
        
        const bannedSnap = await get(ref(db, `banned/${currentUser.uid}`));
        if (bannedSnap.exists()) {
            await signOut(auth);
            showToast('هذا الحساب محظور', true);
            return false;
        }
        
        await set(ref(db, `users/${currentUser.uid}`), {
            email: currentUser.email,
            displayName: currentUser.displayName || currentUser.email.split('@')[0],
            lastSeen: Date.now(),
            online: true
        });
        
        const presenceRef = ref(db, `presence/${currentUser.uid}`);
        await set(presenceRef, { online: true, lastSeen: Date.now() });
        onDisconnect(presenceRef).set({ online: false, lastSeen: Date.now() });
        
        showToast('تم تسجيل الدخول بنجاح');
        return true;
    } catch (error) {
        showToast(error.message, true);
        return false;
    }
}

async function register(email, password, displayName) {
    if (!displayName || displayName.trim() === '') {
        showToast('الرجاء إدخال الاسم', true);
        return false;
    }
    
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        currentUser = userCredential.user;
        
        await updateProfile(currentUser, { displayName });
        await set(ref(db, `users/${currentUser.uid}`), {
            email: email,
            displayName: displayName,
            createdAt: Date.now(),
            online: true,
            lastSeen: Date.now()
        });
        
        showToast('تم إنشاء الحساب بنجاح');
        return true;
    } catch (error) {
        showToast(error.message, true);
        return false;
    }
}

// Chat Functions
async function loadChats() {
    const userChatsQuery = query(ref(db, `userChats/${currentUser.uid}`));
    const snapshot = await get(userChatsQuery);
    
    if (snapshot.exists()) {
        for (const [chatId] of Object.entries(snapshot.val())) {
            await loadChatDetails(chatId);
        }
    }
    
    onChildAdded(userChatsQuery, async (snap) => {
        await loadChatDetails(snap.key);
    });
}

async function loadChatDetails(chatId) {
    const chatSnap = await get(ref(db, `chats/${chatId}`));
    if (chatSnap.exists()) {
        const chatData = chatSnap.val();
        const otherUserId = Object.keys(chatData.participants || {}).find(id => id !== currentUser.uid);
        let chatName = 'محادثة';
        
        if (otherUserId) {
            const userSnap = await get(ref(db, `users/${otherUserId}`));
            if (userSnap.exists()) {
                chatName = userSnap.val().displayName || userSnap.val().email.split('@')[0];
            }
        }
        
        allChats.set(chatId, {
            id: chatId,
            name: chatName,
            lastMessage: chatData.lastMessage || 'ابدأ المحادثة',
            lastUpdated: chatData.lastUpdated || 0,
            unread: chatData.unread?.[currentUser.uid] || 0,
            type: chatData.type || 'private'
        });
        
        renderChatList();
    }
}

function renderChatList() {
    if (!chatListContainer) return;
    
    let filtered = Array.from(allChats.values());
    
    if (activeFolder === 'personal') {
        filtered = filtered.filter(chat => chat.type === 'private');
    } else if (activeFolder === 'channels') {
        filtered = filtered.filter(chat => chat.type === 'channel');
    } else if (activeFolder === 'groups') {
        filtered = filtered.filter(chat => chat.type === 'group');
    }
    
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(chat => chat.name.toLowerCase().includes(query));
    }
    
    filtered.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
    
    chatListContainer.innerHTML = filtered.map(chat => `
        <div class="chat-item p-3 flex items-center gap-3 cursor-pointer transition-all hover:bg-white/5 rounded-xl mx-2 ${currentChatId === chat.id ? 'bg-[#2481cc]/20' : ''}" data-chat-id="${chat.id}">
            <div class="relative">
                <div class="w-12 h-12 rounded-full bg-gradient-to-r from-[#2481cc] to-[#2b5278] flex items-center justify-center text-white font-bold text-lg">
                    ${chat.name[0]?.toUpperCase() || '?'}
                </div>
                ${onlineUsers.has(chat.id) ? '<span class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#17212b]"></span>' : ''}
            </div>
            <div class="flex-1 min-w-0">
                <div class="font-semibold text-sm">${escapeHtml(chat.name)}</div>
                <div class="text-xs text-gray-400 truncate">${chat.lastMessage}</div>
            </div>
            <div class="text-right">
                <div class="text-[10px] text-gray-500">${formatTime(chat.lastUpdated)}</div>
                ${chat.unread > 0 ? `<div class="mt-1 bg-[#2481cc] text-white text-[10px] rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center">${chat.unread}</div>` : ''}
            </div>
        </div>
    `).join('');
    
    document.querySelectorAll('.chat-item').forEach(el => {
        el.addEventListener('click', () => openChat(el.dataset.chatId));
    });
}

async function openChat(chatId) {
    if (currentChatId === chatId) return;
    
    currentChatId = chatId;
    const chat = allChats.get(chatId);
    
    if (chat) {
        chatName.textContent = chat.name;
        chatAvatar.textContent = chat.name[0]?.toUpperCase() || '?';
        
        await update(ref(db, `chats/${chatId}/unread`), { [currentUser.uid]: 0 });
        chat.unread = 0;
        renderChatList();
        await loadMessages(chatId);
        messageInput.focus();
        
        // Close mobile chat list
        document.querySelector('.chat-list-pane')?.classList.remove('open');
    }
}

async function loadMessages(chatId) {
    const messagesQuery = query(ref(db, `chats/${chatId}/messages`), orderByChild('timestamp'), limitToLast(100));
    const snapshot = await get(messagesQuery);
    const messages = [];
    
    snapshot.forEach(child => {
        messages.push({ id: child.key, ...child.val() });
    });
    
    messages.sort((a, b) => a.timestamp - b.timestamp);
    messagesCache.set(chatId, messages);
    renderMessages(messages);
    listenForMessages(chatId);
}

function listenForMessages(chatId) {
    const messagesQuery = query(ref(db, `chats/${chatId}/messages`), orderByChild('timestamp'), limitToLast(1));
    
    onChildAdded(messagesQuery, (snap) => {
        const newMessage = { id: snap.key, ...snap.val() };
        const currentMessages = messagesCache.get(chatId) || [];
        
        if (!currentMessages.some(m => m.id === newMessage.id)) {
            currentMessages.push(newMessage);
            currentMessages.sort((a, b) => a.timestamp - b.timestamp);
            messagesCache.set(chatId, currentMessages);
            
            if (currentChatId === chatId) {
                renderMessages(currentMessages);
                scrollToBottomMessage();
            } else {
                const chat = allChats.get(chatId);
                if (chat && newMessage.senderId !== currentUser.uid) {
                    chat.unread = (chat.unread || 0) + 1;
                    update(ref(db, `chats/${chatId}/unread`), { [currentUser.uid]: chat.unread });
                    renderChatList();
                }
            }
        }
    });
}

function renderMessages(messages) {
    if (!messagesContainer) return;
    
    messagesContainer.innerHTML = messages.map(msg => {
        const isMe = msg.senderId === currentUser?.uid;
        
        let mediaHtml = '';
        if (msg.type === 'image' && msg.mediaUrl) {
            mediaHtml = `<img src="${msg.mediaUrl}" class="max-w-[200px] max-h-48 rounded-lg mt-2 cursor-pointer" onclick="window.open('${msg.mediaUrl}','_blank')">`;
        } else if (msg.type === 'video' && msg.mediaUrl) {
            mediaHtml = `<video controls class="max-w-[200px] max-h-48 rounded-lg mt-2"><source src="${msg.mediaUrl}"></video>`;
        }
        
        return `
            <div class="flex ${isMe ? 'justify-end' : 'justify-start'}">
                <div class="${isMe ? 'message-bubble-me' : 'message-bubble-them'} max-w-[75%] p-3 relative">
                    ${msg.text ? `<div class="text-sm break-words">${escapeHtml(msg.text)}</div>` : ''}
                    ${mediaHtml}
                    <div class="text-[10px] text-left opacity-70 mt-1 flex items-center gap-1 justify-end">
                        ${formatTime(msg.timestamp)}
                        ${isMe ? '<i class="fas fa-check-double text-[#2481cc] text-xs"></i>' : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    setTimeout(() => scrollToBottomMessage(), 100);
}

async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text && !currentChatId) return;
    
    const messageId = Date.now().toString();
    const messageData = {
        id: messageId,
        text: text,
        senderId: currentUser.uid,
        senderName: currentUser.email.split('@')[0],
        timestamp: Date.now(),
        type: 'text',
        read: false
    };
    
    const currentMessages = messagesCache.get(currentChatId) || [];
    currentMessages.push(messageData);
    messagesCache.set(currentChatId, currentMessages);
    renderMessages(currentMessages);
    scrollToBottomMessage();
    
    await set(ref(db, `chats/${currentChatId}/messages/${messageId}`), messageData);
    await update(ref(db, `chats/${currentChatId}`), {
        lastMessage: text,
        lastUpdated: Date.now()
    });
    
    messageInput.value = '';
}

async function sendMedia(file) {
    if (!currentChatId) return;
    
    const fileType = file.type.startsWith('image/') ? 'image' : 'video';
    const progressDiv = document.getElementById('uploadProgress');
    progressDiv.classList.remove('hidden');
    progressDiv.innerHTML = '<div class="text-xs text-[#2481cc]">جاري الرفع... <span id="uploadPercent">0</span>%</div>';
    
    try {
        const mediaUrl = await uploadMedia(file, (percent) => {
            document.getElementById('uploadPercent').textContent = Math.round(percent);
        });
        
        const messageId = Date.now().toString();
        const messageData = {
            id: messageId,
            text: '',
            senderId: currentUser.uid,
            senderName: currentUser.email.split('@')[0],
            timestamp: Date.now(),
            type: fileType,
            mediaUrl: mediaUrl,
            read: false
        };
        
        await set(ref(db, `chats/${currentChatId}/messages/${messageId}`), messageData);
        await update(ref(db, `chats/${currentChatId}`), {
            lastMessage: fileType === 'image' ? '📷 صورة' : '🎥 فيديو',
            lastUpdated: Date.now()
        });
        
        await push(ref(db, 'mediaLogs'), {
            url: mediaUrl,
            userId: currentUser.uid,
            email: currentUser.email,
            timestamp: Date.now()
        });
        
        showToast('تم رفع الملف بنجاح');
    } catch (error) {
        showToast('فشل رفع الملف', true);
    } finally {
        progressDiv.classList.add('hidden');
    }
}

// Admin Functions
async function loadAdminData() {
    const mediaQuery = query(ref(db, 'mediaLogs'), orderByChild('timestamp'), limitToLast(15));
    const mediaSnap = await get(mediaQuery);
    const galleryDiv = document.getElementById('mediaGallery');
    if (galleryDiv) {
        let html = '';
        mediaSnap.forEach(child => {
            const media = child.val();
            html += `<img src="${media.url}" class="w-full h-20 object-cover rounded cursor-pointer" onclick="window.open('${media.url}','_blank')">`;
        });
        galleryDiv.innerHTML = html || '<div class="text-gray-400 col-span-3 text-center">لا توجد وسائط</div>';
    }
    
    const bannedSnap = await get(ref(db, 'banned'));
    if (bannedSnap.exists()) {
        bannedUsers = new Set(Object.keys(bannedSnap.val()));
        document.getElementById('bannedList').innerHTML = Array.from(bannedUsers).join('<br>') || 'لا يوجد';
    }
}

async function sendBroadcast(message) {
    const usersSnap = await get(ref(db, 'users'));
    let count = 0;
    
    for (const [uid, userData] of Object.entries(usersSnap.val() || {})) {
        if (uid !== currentUser.uid && !bannedUsers.has(uid)) {
            const chatId = `broadcast_${uid}_${Date.now()}`;
            await set(ref(db, `chats/${chatId}/messages/broadcast`), {
                text: `📢 إعلان: ${message}`,
                senderId: currentUser.uid,
                senderName: 'المسؤول',
                timestamp: Date.now(),
                type: 'text'
            });
            count++;
        }
    }
    
    showToast(`تم إرسال الإعلان إلى ${count} مستخدم`);
}

async function banUser(email) {
    const usersSnap = await get(ref(db, 'users'));
    let userId = null;
    
    for (const [key, value] of Object.entries(usersSnap.val() || {})) {
        if (value.email === email) {
            userId = key;
            break;
        }
    }
    
    if (userId) {
        await set(ref(db, `banned/${userId}`), { email, bannedAt: Date.now() });
        await loadAdminData();
        showToast(`تم حظر المستخدم: ${email}`);
    } else {
        showToast('لم يتم العثور على المستخدم', true);
    }
}

// Helper Functions
function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'الآن';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} د`;
    if (diff < 86400000) return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    return `${date.getDate()}/${date.getMonth() + 1}`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function scrollToBottomMessage() {
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

// Event Listeners Setup
function setupEventListeners() {
    sendBtn?.addEventListener('click', sendMessage);
    messageInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    fileInput?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) await sendMedia(file);
        fileInput.value = '';
    });
    
    searchInput?.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderChatList();
    });
    
    scrollToBottom?.addEventListener('click', scrollToBottomMessage);
    
    messagesContainer?.addEventListener('scroll', () => {
        const isNearBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 200;
        scrollToBottom?.classList.toggle('hidden', isNearBottom);
    });
    
    // Folders
    document.querySelectorAll('.folder-icon').forEach(el => {
        el.addEventListener('click', () => {
            document.querySelectorAll('.folder-icon').forEach(f => f.classList.remove('active'));
            el.classList.add('active');
            activeFolder = el.dataset.folder;
            renderChatList();
        });
    });
    
    // Mobile menu toggle
    const menuToggle = document.getElementById('menuToggle');
    const mobileToggle = document.getElementById('mobileChatListToggle');
    const chatListPane = document.querySelector('.chat-list-pane');
    
    menuToggle?.addEventListener('click', () => {
        chatListPane?.classList.toggle('open');
    });
    
    mobileToggle?.addEventListener('click', () => {
        chatListPane?.classList.remove('open');
    });
    
    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    logoutBtn?.addEventListener('click', async () => {
        await signOut(auth);
        location.reload();
    });
    
    // Admin
    const adminFolderBtn = document.getElementById('adminFolderBtn');
    adminFolderBtn?.addEventListener('click', () => {
        if (currentUser?.email === 'jasim28v@gmail.com') {
            loadAdminData();
            adminModal.classList.remove('hidden');
        } else {
            showToast('هذه الخاصية متاحة للمسؤول فقط', true);
        }
    });
    
    document.getElementById('closeAdminModal')?.addEventListener('click', () => {
        adminModal.classList.add('hidden');
    });
    
    document.getElementById('sendBroadcastBtn')?.addEventListener('click', async () => {
        const msg = document.getElementById('broadcastMsg').value;
        if (msg) await sendBroadcast(msg);
    });
    
    document.getElementById('banUserBtn')?.addEventListener('click', async () => {
        const email = document.getElementById('banEmail').value;
        if (email) await banUser(email);
    });
}

// Initialize App
function initializeApp() {
    setupEventListeners();
    loadChats();
    
    // Listen for online status
    onChildAdded(ref(db, 'presence'), (snap) => {
        const userId = snap.key;
        const presence = snap.val();
        if (presence.online) {
            onlineUsers.add(userId);
        } else {
            onlineUsers.delete(userId);
        }
        renderChatList();
    });
}

// Auth State
onAuthStateChanged(auth, async (user) => {
    const authContainer = document.getElementById('authContainer');
    const chatInterface = document.getElementById('chatInterface');
    
    if (user) {
        currentUser = user;
        authContainer.classList.add('hidden');
        chatInterface.classList.remove('hidden');
        createParticles();
        initializeApp();
    } else {
        authContainer.classList.remove('hidden');
        chatInterface.classList.add('hidden');
    }
});

// Get DOM Elements after load
document.addEventListener('DOMContentLoaded', () => {
    chatListContainer = document.getElementById('chatListContainer');
    messagesContainer = document.getElementById('messagesContainer');
    messageInput = document.getElementById('messageInput');
    sendBtn = document.getElementById('sendBtn');
    fileInput = document.getElementById('fileInput');
    searchInput = document.getElementById('searchInput');
    scrollToBottom = document.getElementById('scrollToBottom');
    chatName = document.getElementById('chatName');
    chatStatus = document.getElementById('chatStatus');
    chatAvatar = document.getElementById('chatAvatar');
    loginForm = document.getElementById('loginForm');
    registerForm = document.getElementById('registerForm');
    loginTab = document.getElementById('loginTab');
    registerTab = document.getElementById('registerTab');
    authContainer = document.getElementById('authContainer');
    chatInterface = document.getElementById('chatInterface');
    adminModal = document.getElementById('adminModal');
    toast = document.getElementById('toast');
    
    // Tab switching
    loginTab?.addEventListener('click', () => {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        loginTab.classList.add('bg-[#2481cc]', 'text-white');
        loginTab.classList.remove('text-gray-400');
        registerTab.classList.remove('bg-[#2481cc]', 'text-white');
        registerTab.classList.add('text-gray-400');
    });
    
    registerTab?.addEventListener('click', () => {
        registerForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
        registerTab.classList.add('bg-[#2481cc]', 'text-white');
        registerTab.classList.remove('text-gray-400');
        loginTab.classList.remove('bg-[#2481cc]', 'text-white');
        loginTab.classList.add('text-gray-400');
    });
    
    // Login button
    document.getElementById('loginBtn')?.addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        await login(email, password);
    });
    
    // Register button
    document.getElementById('registerBtn')?.addEventListener('click', async () => {
        const name = document.getElementById('regName').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        const confirm = document.getElementById('regConfirmPassword').value;
        
        if (password !== confirm) {
            showToast('كلمات المرور غير متطابقة', true);
            return;
        }
        
        await register(email, password, name);
    });
    
    createParticles();
});
