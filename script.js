// script.js - Main Application Logic
import {
    db, auth, usersRef, chatsRef, messagesRef, mediaLogsRef,
    bannedRef, presenceRef, userChatsRef,
    ref, push, set, update, get, query, orderByChild,
    limitToLast, onChildAdded, onChildChanged, onChildRemoved,
    onDisconnect, serverTimestamp, remove, runTransaction,
    signInWithEmailAndPassword, createUserWithEmailAndPassword,
    onAuthStateChanged, signOut, updateProfile,
    generateId, formatTime, escapeHtml, uploadMedia
} from './firebase-config.js';

// Global State
let currentUser = null;
let currentChatId = null;
let allChats = new Map();
let messagesCache = new Map();
let bannedUsers = new Set();
let onlineUsers = new Set();
let typingTimeouts = new Map();
let activeFolder = 'all';
let searchQuery = '';

// DOM Elements
const chatListContainer = document.getElementById('chatListContainer');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const fileInput = document.getElementById('fileInput');
const searchInput = document.getElementById('searchInput');
const scrollToBottom = document.getElementById('scrollToBottom');
const loginModal = document.getElementById('loginModal');
const adminModal = document.getElementById('adminModal');
const contextMenu = document.getElementById('contextMenu');
const chatName = document.getElementById('chatName');
const chatStatus = document.getElementById('chatStatus');
const chatAvatar = document.getElementById('chatAvatar');

// ==================== AUTHENTICATION ====================
async function login(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        currentUser = userCredential.user;
        
        // Check if banned
        const bannedSnap = await get(ref(db, `banned/${currentUser.uid}`));
        if (bannedSnap.exists()) {
            await signOut(auth);
            alert('هذا الحساب محظور من قبل المسؤول');
            return false;
        }
        
        // Set online presence
        const userPresenceRef = ref(db, `presence/${currentUser.uid}`);
        await set(userPresenceRef, {
            online: true,
            lastSeen: Date.now(),
            email: currentUser.email
        });
        
        onDisconnect(userPresenceRef).set({
            online: false,
            lastSeen: Date.now(),
            email: currentUser.email
        });
        
        // Update user info
        await update(ref(db, `users/${currentUser.uid}`), {
            email: currentUser.email,
            displayName: currentUser.email.split('@')[0],
            lastSeen: Date.now(),
            online: true
        });
        
        loginModal.classList.add('hidden');
        initializeApp();
        return true;
    } catch (error) {
        alert(error.message);
        return false;
    }
}

async function register(email, password, displayName) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        currentUser = userCredential.user;
        
        await updateProfile(currentUser, { displayName });
        await set(ref(db, `users/${currentUser.uid}`), {
            email: email,
            displayName: displayName || email.split('@')[0],
            createdAt: Date.now(),
            online: true,
            lastSeen: Date.now()
        });
        
        loginModal.classList.add('hidden');
        initializeApp();
        return true;
    } catch (error) {
        alert(error.message);
        return false;
    }
}

// ==================== CHAT MANAGEMENT ====================
async function loadChats() {
    const userChatsQuery = query(ref(db, `userChats/${currentUser.uid}`));
    const snapshot = await get(userChatsQuery);
    
    if (snapshot.exists()) {
        const chats = snapshot.val();
        for (const [chatId, value] of Object.entries(chats)) {
            await loadChatDetails(chatId);
        }
    }
    
    // Listen for new chats
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
        } else if (chatData.type === 'channel') {
            chatName = chatData.name || 'قناة';
        } else if (chatData.type === 'group') {
            chatName = chatData.name || 'مجموعة';
        }
        
        allChats.set(chatId, {
            id: chatId,
            name: chatName,
            lastMessage: chatData.lastMessage || 'ابدأ المحادثة',
            lastUpdated: chatData.lastUpdated || 0,
            unread: chatData.unread?.[currentUser.uid] || 0,
            type: chatData.type || 'private',
            participants: chatData.participants || {},
            avatarColor: getAvatarColor(chatName)
        });
        
        renderChatList();
    }
}

function getAvatarColor(name) {
    const colors = ['#2481cc', '#2b5278', '#4a6b8f', '#1e3a5f', '#5c8bb3'];
    const index = name.length % colors.length;
    return colors[index];
}

function renderChatList() {
    if (!chatListContainer) return;
    
    let filtered = Array.from(allChats.values());
    
    // Filter by folder
    if (activeFolder === 'personal') {
        filtered = filtered.filter(chat => chat.type === 'private');
    } else if (activeFolder === 'channels') {
        filtered = filtered.filter(chat => chat.type === 'channel');
    } else if (activeFolder === 'groups') {
        filtered = filtered.filter(chat => chat.type === 'group');
    }
    
    // Filter by search
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(chat => chat.name.toLowerCase().includes(query));
    }
    
    // Sort by last updated
    filtered.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
    
    chatListContainer.innerHTML = filtered.map(chat => `
        <div class="chat-item p-3 flex items-center gap-3 border-b border-white/5 ${currentChatId === chat.id ? 'active' : ''}" data-chat-id="${chat.id}">
            <div class="relative">
                <div class="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg" style="background: ${chat.avatarColor}">
                    ${chat.name[0]?.toUpperCase() || '?'}
                </div>
                ${onlineUsers.has(chat.id) ? '<span class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#17212b]"></span>' : ''}
            </div>
            <div class="flex-1 min-w-0">
                <div class="font-semibold text-sm">${escapeHtml(chat.name)}</div>
                <div class="text-xs text-gray-400 truncate">
                    ${chat.lastMessage || 'لا توجد رسائل'}
                </div>
            </div>
            <div class="text-right">
                <div class="text-[10px] text-gray-500">${formatTime(chat.lastUpdated)}</div>
                ${chat.unread > 0 ? `<div class="mt-1 bg-[#2481cc] text-white text-[10px] rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center">${chat.unread}</div>` : ''}
            </div>
        </div>
    `).join('');
    
    // Add click handlers
    document.querySelectorAll('.chat-item').forEach(el => {
        el.addEventListener('click', () => openChat(el.dataset.chatId));
    });
}

// ==================== MESSAGING ====================
async function openChat(chatId) {
    if (currentChatId === chatId) return;
    
    currentChatId = chatId;
    const chat = allChats.get(chatId);
    
    if (chat) {
        chatName.textContent = chat.name;
        chatAvatar.textContent = chat.name[0]?.toUpperCase() || '?';
        chatAvatar.style.background = chat.avatarColor;
        
        // Get user status
        const otherUserId = Object.keys(chat.participants || {}).find(id => id !== currentUser.uid);
        if (otherUserId) {
            const presenceSnap = await get(ref(db, `presence/${otherUserId}`));
            if (presenceSnap.exists()) {
                const presence = presenceSnap.val();
                chatStatus.textContent = presence.online ? 'متصل الآن' : `آخر ظهور ${formatTime(presence.lastSeen)}`;
            }
        }
        
        // Clear unread
        await update(ref(db, `chats/${chatId}/unread`), { [currentUser.uid]: 0 });
        chat.unread = 0;
        renderChatList();
        
        // Load messages
        await loadMessages(chatId);
        
        // Mark as read
        messageInput.value = '';
        messageInput.focus();
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
    
    // Listen for new messages
    listenForMessages(chatId);
}

function listenForMessages(chatId) {
    const messagesQuery = query(ref(db, `chats/${chatId}/messages`), orderByChild('timestamp'), limitToLast(1));
    
    onChildAdded(messagesQuery, async (snap) => {
        const newMessage = { id: snap.key, ...snap.val() };
        const currentMessages = messagesCache.get(chatId) || [];
        
        // Check for duplicates
        const exists = currentMessages.some(m => m.id === newMessage.id);
        if (!exists) {
            currentMessages.push(newMessage);
            currentMessages.sort((a, b) => a.timestamp - b.timestamp);
            messagesCache.set(chatId, currentMessages);
            
            if (currentChatId === chatId) {
                renderMessages(currentMessages);
                scrollToBottomMessage();
            } else {
                // Update unread count
                const chat = allChats.get(chatId);
                if (chat && newMessage.senderId !== currentUser.uid) {
                    chat.unread = (chat.unread || 0) + 1;
                    await update(ref(db, `chats/${chatId}/unread`), { [currentUser.uid]: chat.unread });
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
        const bubbleClass = isMe ? 'bubble-me' : 'bubble-them';
        const alignClass = isMe ? 'justify-end' : 'justify-start';
        
        let mediaHtml = '';
        if (msg.type === 'image' && msg.mediaUrl) {
            mediaHtml = `<img src="${msg.mediaUrl}" class="max-w-[250px] max-h-60 rounded-lg mt-2 cursor-pointer image-preview" onclick="window.open('${msg.mediaUrl}','_blank')">`;
        } else if (msg.type === 'video' && msg.mediaUrl) {
            mediaHtml = `<video controls class="max-w-[250px] max-h-60 rounded-lg mt-2">
                <source src="${msg.mediaUrl}" type="video/mp4">
            </video>`;
        } else if (msg.type === 'voice' && msg.mediaUrl) {
            mediaHtml = `<audio controls class="mt-2 w-48">
                <source src="${msg.mediaUrl}" type="audio/mpeg">
            </audio>`;
        }
        
        return `
            <div class="flex ${alignClass} message-animate">
                <div class="${bubbleClass} max-w-[70%] p-2.5 relative">
                    <div class="text-sm break-words">${escapeHtml(msg.text || '')}</div>
                    ${mediaHtml}
                    <div class="text-[10px] text-left opacity-70 mt-1 flex items-center gap-1 justify-end">
                        ${formatTime(msg.timestamp)}
                        ${isMe ? (msg.read ? '<i class="fas fa-check-double text-[#2481cc] text-xs"></i>' : '<i class="fas fa-check text-xs"></i>') : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text && !currentChatId) return;
    
    const messageId = generateId();
    const messageData = {
        id: messageId,
        text: text,
        senderId: currentUser.uid,
        senderName: currentUser.email.split('@')[0],
        timestamp: Date.now(),
        type: 'text',
        read: false,
        delivered: true
    };
    
    // Optimistic update
    const currentMessages = messagesCache.get(currentChatId) || [];
    currentMessages.push(messageData);
    messagesCache.set(currentChatId, currentMessages);
    renderMessages(currentMessages);
    scrollToBottomMessage();
    
    // Send to Firebase
    await set(ref(db, `chats/${currentChatId}/messages/${messageId}`), messageData);
    await update(ref(db, `chats/${currentChatId}`), {
        lastMessage: text,
        lastUpdated: Date.now()
    });
    
    messageInput.value = '';
}

async function sendMedia(file) {
    if (!currentChatId) return;
    
    const fileType = file.type.startsWith('image/') ? 'image' : 
                     file.type.startsWith('video/') ? 'video' : 'voice';
    
    // Show progress
    const progressDiv = document.getElementById('uploadProgress');
    progressDiv.classList.remove('hidden');
    progressDiv.innerHTML = '<div class="text-xs text-[#2481cc]">جاري الرفع... <span id="uploadPercent">0</span>%</div>';
    
    try {
        const mediaUrl = await uploadMedia(file, (percent) => {
            document.getElementById('uploadPercent').textContent = Math.round(percent);
        });
        
        const messageId = generateId();
        const messageData = {
            id: messageId,
            text: '',
            senderId: currentUser.uid,
            senderName: currentUser.email.split('@')[0],
            timestamp: Date.now(),
            type: fileType,
            mediaUrl: mediaUrl,
            read: false,
            delivered: true
        };
        
        await set(ref(db, `chats/${currentChatId}/messages/${messageId}`), messageData);
        await update(ref(db, `chats/${currentChatId}`), {
            lastMessage: fileType === 'image' ? '📷 صورة' : fileType === 'video' ? '🎥 فيديو' : '🎤 رسالة صوتية',
            lastUpdated: Date.now()
        });
        
        // Log media
        await push(ref(db, 'mediaLogs'), {
            url: mediaUrl,
            userId: currentUser.uid,
            email: currentUser.email,
            timestamp: Date.now(),
            type: fileType
        });
        
    } catch (error) {
        console.error('Upload failed:', error);
        alert('فشل رفع الملف');
    } finally {
        progressDiv.classList.add('hidden');
    }
}

function scrollToBottomMessage() {
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

// ==================== ADMIN FUNCTIONS ====================
async function loadAdminData() {
    // Load media gallery
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
    
    // Load banned users
    const bannedSnap = await get(ref(db, 'banned'));
    if (bannedSnap.exists()) {
        bannedUsers = new Set(Object.keys(bannedSnap.val()));
        document.getElementById('bannedList').innerHTML = Array.from(bannedUsers).join('<br>') || 'لا يوجد';
    }
}

async function sendBroadcast(message) {
    const usersSnap = await get(ref(db, 'users'));
    let count = 0;
    
    for (const userSnap of usersSnap.forEach) {
        // Implement broadcast logic
    }
    
    alert(`تم إرسال الإعلان إلى ${count} مستخدم`);
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
        await set(ref(db, `banned/${userId}`), { email: email, bannedAt: Date.now() });
        await loadAdminData();
        alert(`تم حظر المستخدم: ${email}`);
    } else {
        alert('لم يتم العثور على المستخدم');
    }
}

async function nukeChat(chatId) {
    if (confirm('هل أنت متأكد؟ هذه العملية لا رجعة فيها!')) {
        await remove(ref(db, `chats/${chatId}`));
        alert('تم محو المحادثة');
        if (currentChatId === chatId) {
            currentChatId = null;
            chatName.textContent = 'اختر محادثة';
            messagesContainer.innerHTML = '<div class="text-center text-gray-500 mt-10">اختر محادثة للبدء</div>';
        }
        allChats.delete(chatId);
        renderChatList();
    }
}

// ==================== TYPING INDICATOR ====================
function sendTypingIndicator() {
    if (!currentChatId) return;
    
    const typingRef = ref(db, `chats/${currentChatId}/typing/${currentUser.uid}`);
    set(typingRef, true);
    
    if (typingTimeouts.has(currentChatId)) {
        clearTimeout(typingTimeouts.get(currentChatId));
    }
    
    const timeout = setTimeout(() => {
        remove(typingRef);
    }, 2000);
    
    typingTimeouts.set(currentChatId, timeout);
}

// ==================== INITIALIZATION ====================
function initializeApp() {
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
    
    onChildChanged(ref(db, 'presence'), (snap) => {
        const userId = snap.key;
        const presence = snap.val();
        if (presence.online) {
            onlineUsers.add(userId);
        } else {
            onlineUsers.delete(userId);
        }
        renderChatList();
    });
    
    // Typing indicators
    if (currentChatId) {
        onChildAdded(ref(db, `chats/${currentChatId}/typing`), () => {
            // Show typing indicator
        });
    }
}

// ==================== EVENT LISTENERS ====================
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
    sendTypingIndicator();
});

fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        await sendMedia(file);
    }
    fileInput.value = '';
});

searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderChatList();
});

scrollToBottom.addEventListener('click', scrollToBottomMessage);

messagesContainer?.addEventListener('scroll', () => {
    const isNearBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 200;
    scrollToBottom.classList.toggle('hidden', isNearBottom);
});

// Folder navigation
document.querySelectorAll('.folder-icon').forEach(el => {
    el.addEventListener('click', () => {
        document.querySelectorAll('.folder-icon').forEach(f => f.classList.remove('active'));
        el.classList.add('active');
        activeFolder = el.dataset.folder;
        renderChatList();
    });
});

// Admin modal
const adminFolderBtn = document.getElementById('adminFolderBtn');
adminFolderBtn?.addEventListener('click', () => {
    if (currentUser?.email === 'jasim28v@gmail.com') {
        loadAdminData();
        adminModal.classList.remove('hidden');
    } else {
        alert('هذه الخاصية متاحة للمسؤول فقط');
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

document.getElementById('nukeChatBtn')?.addEventListener('click', async () => {
    const chatId = document.getElementById('nukeChatId').value;
    if (chatId) await nukeChat(chatId);
});

// Context menu
document.addEventListener('contextmenu', (e) => {
    const messageDiv = e.target.closest('.bubble-me, .bubble-them');
    if (messageDiv) {
        e.preventDefault();
        contextMenu.style.top = `${e.clientY}px`;
        contextMenu.style.left = `${e.clientX}px`;
        contextMenu.classList.remove('hidden');
        contextMenu.innerHTML = `
            <div class="context-menu-item" data-action="reply"><i class="fas fa-reply ml-2"></i>رد</div>
            <div class="context-menu-item" data-action="copy"><i class="fas fa-copy ml-2"></i>نسخ</div>
            <div class="context-menu-item text-red-400" data-action="delete"><i class="fas fa-trash ml-2"></i>حذف للجميع</div>
        `;
        
        document.addEventListener('click', () => contextMenu.classList.add('hidden'), { once: true });
    }
});

// Login modal handlers
document.getElementById('loginBtn')?.addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    await login(email, password);
});

document.getElementById('showRegisterBtn')?.addEventListener('click', () => {
    const modal = document.getElementById('loginModal');
    modal.innerHTML = `
        <div class="bg-[#17212b] rounded-2xl p-8 w-96 border border-white/20">
            <div class="text-center mb-6">
                <i class="fas fa-user-plus text-5xl text-[#2481cc] mb-3"></i>
                <h2 class="text-2xl font-bold">إنشاء حساب</h2>
            </div>
            <div class="space-y-4">
                <input type="text" id="regName" placeholder="الاسم" class="w-full bg-[#0e1621] rounded-lg p-3 outline-none focus:ring-1 focus:ring-[#2481cc]">
                <input type="email" id="regEmail" placeholder="البريد الإلكتروني" class="w-full bg-[#0e1621] rounded-lg p-3 outline-none focus:ring-1 focus:ring-[#2481cc]">
                <input type="password" id="regPassword" placeholder="كلمة المرور" class="w-full bg-[#0e1621] rounded-lg p-3 outline-none focus:ring-1 focus:ring-[#2481cc]">
                <button id="registerBtn" class="w-full bg-[#2481cc] rounded-lg p-2 font-semibold">تسجيل</button>
                <button id="backToLogin" class="w-full text-[#2481cc] text-sm">لديك حساب؟ تسجيل الدخول</button>
            </div>
        </div>
    `;
    
    document.getElementById('registerBtn')?.addEventListener('click', async () => {
        const name = document.getElementById('regName').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        await register(email, password, name);
    });
    
    document.getElementById('backToLogin')?.addEventListener('click', () => {
        location.reload();
    });
});

// Check auth state
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loginModal.classList.add('hidden');
        initializeApp();
    } else {
        loginModal.classList.remove('hidden');
    }
});

// Initial scroll check
setInterval(() => {
    if (messagesContainer) {
        const isNearBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 200;
        scrollToBottom.classList.toggle('hidden', isNearBottom);
    }
}, 1000);
