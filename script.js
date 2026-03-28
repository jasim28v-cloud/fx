// script.js
import {
    db, auth, ref, push, set, update, get, query, orderByChild,
    limitToLast, onChildAdded, onChildChanged, onDisconnect, remove,
    signInWithEmailAndPassword, createUserWithEmailAndPassword,
    onAuthStateChanged, signOut, updateProfile,
    formatTime, escapeHtml, uploadMedia
} from './firebase-config.js';

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
let authContainer, chatInterface, adminModal, toast;

// Toast
function showToast(msg, isError = false) {
    if (!toast) return;
    toast.textContent = msg;
    toast.style.background = isError ? '#dc2626' : '#2481cc';
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

// Particles
function createParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    for (let i = 0; i < 50; i++) {
        const p = document.createElement('div');
        p.classList.add('particle');
        const size = Math.random() * 4 + 2;
        p.style.width = `${size}px`;
        p.style.height = `${size}px`;
        p.style.left = `${Math.random() * 100}%`;
        p.style.animationDuration = `${Math.random() * 20 + 10}s`;
        p.style.animationDelay = `${Math.random() * 5}s`;
        container.appendChild(p);
    }
}

// Auth Functions
async function login(email, password) {
    try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        currentUser = cred.user;
        
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
        
        showToast('تم تسجيل الدخول');
        return true;
    } catch (error) {
        showToast(error.message, true);
        return false;
    }
}

async function register(email, password, name) {
    if (!name || !name.trim()) {
        showToast('الرجاء إدخال الاسم', true);
        return false;
    }
    try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        currentUser = cred.user;
        await updateProfile(currentUser, { displayName: name });
        await set(ref(db, `users/${currentUser.uid}`), {
            email, displayName: name, createdAt: Date.now(), online: true, lastSeen: Date.now()
        });
        showToast('تم إنشاء الحساب');
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
        for (const chatId of Object.keys(snapshot.val())) {
            await loadChatDetails(chatId);
        }
    }
    onChildAdded(userChatsQuery, async (snap) => await loadChatDetails(snap.key));
}

async function loadChatDetails(chatId) {
    const chatSnap = await get(ref(db, `chats/${chatId}`));
    if (chatSnap.exists()) {
        const chatData = chatSnap.val();
        const otherId = Object.keys(chatData.participants || {}).find(id => id !== currentUser.uid);
        let chatName = 'محادثة';
        if (otherId) {
            const userSnap = await get(ref(db, `users/${otherId}`));
            if (userSnap.exists()) chatName = userSnap.val().displayName || userSnap.val().email.split('@')[0];
        }
        allChats.set(chatId, {
            id: chatId, name: chatName, lastMessage: chatData.lastMessage || 'ابدأ المحادثة',
            lastUpdated: chatData.lastUpdated || 0, unread: chatData.unread?.[currentUser.uid] || 0,
            type: chatData.type || 'private'
        });
        renderChatList();
    }
}

function renderChatList() {
    if (!chatListContainer) return;
    let filtered = Array.from(allChats.values());
    if (activeFolder === 'personal') filtered = filtered.filter(c => c.type === 'private');
    if (activeFolder === 'groups') filtered = filtered.filter(c => c.type === 'group');
    if (searchQuery) filtered = filtered.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
    filtered.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
    
    chatListContainer.innerHTML = filtered.map(chat => `
        <div class="chat-item p-3 flex items-center gap-3 cursor-pointer hover:bg-white/5 rounded-xl mx-2 ${currentChatId === chat.id ? 'bg-[#2481cc]/20' : ''}" data-chat-id="${chat.id}">
            <div class="relative">
                <div class="w-12 h-12 rounded-full bg-gradient-to-r from-[#2481cc] to-[#2b5278] flex items-center justify-center text-white font-bold text-lg">${chat.name[0]?.toUpperCase() || '?'}</div>
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
        document.querySelector('.chat-list-pane')?.classList.remove('open');
    }
}

async function loadMessages(chatId) {
    const msgsQuery = query(ref(db, `chats/${chatId}/messages`), orderByChild('timestamp'), limitToLast(100));
    const snapshot = await get(msgsQuery);
    const msgs = [];
    snapshot.forEach(child => msgs.push({ id: child.key, ...child.val() }));
    msgs.sort((a, b) => a.timestamp - b.timestamp);
    messagesCache.set(chatId, msgs);
    renderMessages(msgs);
    listenForMessages(chatId);
}

function listenForMessages(chatId) {
    const msgsQuery = query(ref(db, `chats/${chatId}/messages`), orderByChild('timestamp'), limitToLast(1));
    onChildAdded(msgsQuery, (snap) => {
        const newMsg = { id: snap.key, ...snap.val() };
        const current = messagesCache.get(chatId) || [];
        if (!current.some(m => m.id === newMsg.id)) {
            current.push(newMsg);
            current.sort((a, b) => a.timestamp - b.timestamp);
            messagesCache.set(chatId, current);
            if (currentChatId === chatId) {
                renderMessages(current);
                scrollToBottomMessage();
            } else {
                const chat = allChats.get(chatId);
                if (chat && newMsg.senderId !== currentUser.uid) {
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
                <div class="${isMe ? 'message-bubble-me' : 'message-bubble-them'} max-w-[75%] p-3">
                    ${msg.text ? `<div class="text-sm break-words">${escapeHtml(msg.text)}</div>` : ''}
                    ${mediaHtml}
                    <div class="text-[10px] text-left opacity-70 mt-1 flex justify-end gap-1">
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
    if (!text || !currentChatId) return;
    const msgId = Date.now().toString();
    const msgData = { id: msgId, text, senderId: currentUser.uid, senderName: currentUser.email.split('@')[0], timestamp: Date.now(), type: 'text', read: false };
    const current = messagesCache.get(currentChatId) || [];
    current.push(msgData);
    messagesCache.set(currentChatId, current);
    renderMessages(current);
    scrollToBottomMessage();
    await set(ref(db, `chats/${currentChatId}/messages/${msgId}`), msgData);
    await update(ref(db, `chats/${currentChatId}`), { lastMessage: text, lastUpdated: Date.now() });
    messageInput.value = '';
}

async function sendMedia(file) {
    if (!currentChatId) return;
    const type = file.type.startsWith('image/') ? 'image' : 'video';
    const progressDiv = document.getElementById('uploadProgress');
    progressDiv.classList.remove('hidden');
    progressDiv.innerHTML = '<div class="text-xs text-[#2481cc]">جاري الرفع... <span id="uploadPercent">0</span>%</div>';
    try {
        const url = await uploadMedia(file, (p) => { document.getElementById('uploadPercent').textContent = Math.round(p); });
        const msgId = Date.now().toString();
        const msgData = { id: msgId, text: '', senderId: currentUser.uid, senderName: currentUser.email.split('@')[0], timestamp: Date.now(), type, mediaUrl: url, read: false };
        await set(ref(db, `chats/${currentChatId}/messages/${msgId}`), msgData);
        await update(ref(db, `chats/${currentChatId}`), { lastMessage: type === 'image' ? '📷 صورة' : '🎥 فيديو', lastUpdated: Date.now() });
        await push(ref(db, 'mediaLogs'), { url, userId: currentUser.uid, email: currentUser.email, timestamp: Date.now() });
        showToast('تم الرفع بنجاح');
    } catch (error) {
        showToast('فشل الرفع', true);
    } finally {
        progressDiv.classList.add('hidden');
    }
}

function scrollToBottomMessage() {
    if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Admin Functions
async function loadAdminData() {
    const mediaSnap = await get(query(ref(db, 'mediaLogs'), orderByChild('timestamp'), limitToLast(15)));
    const gallery = document.getElementById('mediaGallery');
    if (gallery) {
        let html = '';
        mediaSnap.forEach(c => { html += `<img src="${c.val().url}" class="w-full h-20 object-cover rounded cursor-pointer" onclick="window.open('${c.val().url}','_blank')">`; });
        gallery.innerHTML = html || '<div class="text-gray-400 col-span-3 text-center">لا توجد وسائط</div>';
    }
    const bannedSnap = await get(ref(db, 'banned'));
    if (bannedSnap.exists()) {
        bannedUsers = new Set(Object.keys(bannedSnap.val()));
        document.getElementById('bannedList').innerHTML = Array.from(bannedUsers).join('<br>') || 'لا يوجد';
    }
}

async function sendBroadcast(msg) {
    const usersSnap = await get(ref(db, 'users'));
    let count = 0;
    for (const [uid] of Object.entries(usersSnap.val() || {})) {
        if (uid !== currentUser.uid && !bannedUsers.has(uid)) {
            const chatId = `broadcast_${uid}_${Date.now()}`;
            await set(ref(db, `chats/${chatId}/messages/broadcast`), {
                text: `📢 إعلان: ${msg}`, senderId: currentUser.uid, senderName: 'المسؤول', timestamp: Date.now(), type: 'text'
            });
            count++;
        }
    }
    showToast(`تم الإرسال إلى ${count} مستخدم`);
}

async function banUser(email) {
    const usersSnap = await get(ref(db, 'users'));
    let uid = null;
    for (const [key, val] of Object.entries(usersSnap.val() || {})) {
        if (val.email === email) { uid = key; break; }
    }
    if (uid) {
        await set(ref(db, `banned/${uid}`), { email, bannedAt: Date.now() });
        await loadAdminData();
        showToast(`تم حظر: ${email}`);
    } else {
        showToast('لم يتم العثور على المستخدم', true);
    }
}

// Event Listeners
function setupEventListeners() {
    sendBtn?.addEventListener('click', sendMessage);
    messageInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
    fileInput?.addEventListener('change', async (e) => { if (e.target.files[0]) await sendMedia(e.target.files[0]); fileInput.value = ''; });
    searchInput?.addEventListener('input', (e) => { searchQuery = e.target.value; renderChatList(); });
    scrollToBottom?.addEventListener('click', scrollToBottomMessage);
    messagesContainer?.addEventListener('scroll', () => {
        const near = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 200;
        scrollToBottom?.classList.toggle('hidden', near);
    });
    
    document.querySelectorAll('.folder-icon').forEach(el => {
        el.addEventListener('click', () => {
            document.querySelectorAll('.folder-icon').forEach(f => f.classList.remove('active'));
            el.classList.add('active');
            activeFolder = el.dataset.folder;
            renderChatList();
        });
    });
    
    const menuToggle = document.getElementById('menuToggle');
    const mobileToggle = document.getElementById('mobileChatListToggle');
    const listPane = document.querySelector('.chat-list-pane');
    menuToggle?.addEventListener('click', () => listPane?.classList.toggle('open'));
    mobileToggle?.addEventListener('click', () => listPane?.classList.remove('open'));
    
    document.getElementById('logoutBtn')?.addEventListener('click', async () => { await signOut(auth); location.reload(); });
    
    document.getElementById('adminFolderBtn')?.addEventListener('click', () => {
        if (currentUser?.email === 'jasim28v@gmail.com') { loadAdminData(); adminModal.classList.remove('hidden'); }
        else showToast('للمسؤول فقط', true);
    });
    document.getElementById('closeAdminModal')?.addEventListener('click', () => adminModal.classList.add('hidden'));
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
function initApp() {
    setupEventListeners();
    loadChats();
    onChildAdded(ref(db, 'presence'), (snap) => {
        const presence = snap.val();
        if (presence.online) onlineUsers.add(snap.key);
        else onlineUsers.delete(snap.key);
        renderChatList();
    });
}

// Auth State
onAuthStateChanged(auth, async (user) => {
    const authDiv = document.getElementById('authContainer');
    const chatDiv = document.getElementById('chatInterface');
    if (user) {
        currentUser = user;
        authDiv.classList.add('hidden');
        chatDiv.classList.remove('hidden');
        createParticles();
        initApp();
    } else {
        authDiv.classList.remove('hidden');
        chatDiv.classList.add('hidden');
    }
});

// DOM Ready
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
    authContainer = document.getElementById('authContainer');
    chatInterface = document.getElementById('chatInterface');
    adminModal = document.getElementById('adminModal');
    toast = document.getElementById('toast');
    
    document.getElementById('loginBtn')?.addEventListener('click', async () => {
        await login(document.getElementById('loginEmail').value, document.getElementById('loginPassword').value);
    });
    
    document.getElementById('registerBtn')?.addEventListener('click', async () => {
        await register(document.getElementById('regEmail').value, document.getElementById('regPassword').value, document.getElementById('regName').value);
    });
    
    document.getElementById('showRegisterBtn')?.addEventListener('click', () => {
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('registerForm').classList.remove('hidden');
    });
    
    document.getElementById('backToLoginBtn')?.addEventListener('click', () => {
        document.getElementById('registerForm').classList.add('hidden');
        document.getElementById('loginForm').classList.remove('hidden');
    });
    
    createParticles();
});
