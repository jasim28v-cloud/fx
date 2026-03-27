import { auth, db } from './firebase-config.js';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut 
} from "firebase/auth";
import { 
    ref, set, push, onChildAdded, onChildChanged, onChildRemoved, 
    get, update, query, orderByChild, equalTo, remove, serverTimestamp 
} from "firebase/database";

// ========== GLOBAL STATE ==========
let currentUser = null;
let currentChatId = null;
let currentFolder = 'all';
let chatListCache = [];
let messageListeners = {};
let typingTimeout = null;

// DOM Elements
const chatListContainer = document.getElementById('chatListContainer');
const messagesContainer = document.getElementById('messagesContainer');
const chatTitle = document.getElementById('chatTitle');
const chatStatus = document.getElementById('chatStatus');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendMessageBtn');
const attachMediaBtn = document.getElementById('attachMediaBtn');
const voiceNoteBtn = document.getElementById('voiceNoteBtn');
const scrollBtn = document.getElementById('scrollToBottomBtn');
const searchInput = document.getElementById('searchChats');
const newChatBtn = document.getElementById('newChatBtn');
const adminModal = document.getElementById('adminModal');
const closeAdminModal = document.getElementById('closeAdminModal');
const broadcastMsg = document.getElementById('broadcastMsg');
const sendBroadcastBtn = document.getElementById('sendBroadcastBtn');
const refreshMediaGalleryBtn = document.getElementById('refreshMediaGalleryBtn');
const mediaGalleryList = document.getElementById('mediaGalleryList');
const banUidInput = document.getElementById('banUidInput');
const banUserBtn = document.getElementById('banUserBtn');
const adminUserList = document.getElementById('adminUserList');
const newChatModal = document.getElementById('newChatModal');
const searchUserInput = document.getElementById('searchUserInput');
const userSearchResults = document.getElementById('userSearchResults');
const closeNewChatModal = document.getElementById('closeNewChatModal');
const contextMenu = document.getElementById('contextMenu');
const folders = document.querySelectorAll('.folder-icon');
const adminFolderIcon = document.querySelector('.admin-folder');

// Helper: Cloudinary upload
async function uploadMedia(file, isVoice = false) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'ekxzvogb');
    // Client-side compression for images
    if (file.type.startsWith('image/')) {
        const compressed = await compressImage(file);
        formData.set('file', compressed);
    }
    const response = await fetch('https://api.cloudinary.com/v1_1/dnillsbmi/upload', {
        method: 'POST',
        body: formData
    });
    const data = await response.json();
    return data.secure_url;
}

function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const maxSize = 1024;
                if (width > maxSize || height > maxSize) {
                    if (width > height) {
                        height *= maxSize / width;
                        width = maxSize;
                    } else {
                        width *= maxSize / height;
                        height = maxSize;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/jpeg', 0.8);
            };
        };
    });
}

// Send message (text or media)
async function sendMessage(text, mediaUrl = null, type = 'text') {
    if (!currentChatId || (!text.trim() && !mediaUrl)) return;
    const newMsgRef = push(ref(db, `messages/${currentChatId}`));
    const messageData = {
        text: text.trim(),
        senderId: currentUser.uid,
        timestamp: serverTimestamp(),
        readBy: { [currentUser.uid]: true },
        type: type,
        mediaUrl: mediaUrl
    };
    await set(newMsgRef, messageData);
    // Update last message in chat
    await update(ref(db, `chats/${currentChatId}`), {
        lastMessage: text.trim() || (type === 'image' ? '📷 Photo' : '🎤 Voice'),
        lastUpdated: serverTimestamp()
    });
    messageInput.value = '';
    scrollToBottom();
}

// Attach media handler
attachMediaBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const url = await uploadMedia(file);
        sendMessage('', url, file.type.startsWith('image/') ? 'image' : 'video');
    };
    input.click();
});

// Voice recording
let mediaRecorder;
let audioChunks = [];
voiceNoteBtn.addEventListener('click', async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        voiceNoteBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/ogg' });
        const url = await uploadMedia(audioBlob, true);
        sendMessage('', url, 'voice');
        stream.getTracks().forEach(track => track.stop());
    };
    mediaRecorder.start();
    voiceNoteBtn.innerHTML = '<i class="fas fa-stop"></i>';
    setTimeout(() => {
        if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
    }, 60000); // max 1 min
});

// Render chat list with folder and search filter
function renderChatList() {
    let filtered = [...chatListCache];
    // Folder filter
    if (currentFolder !== 'all') {
        filtered = filtered.filter(chat => chat.type === currentFolder);
    }
    // Regex search
    const searchTerm = searchInput.value.trim();
    if (searchTerm) {
        try {
            const regex = new RegExp(searchTerm, 'i');
            filtered = filtered.filter(chat => regex.test(chat.name) || regex.test(chat.lastMessage || ''));
        } catch(e) { /* invalid regex, ignore */ }
    }
    chatListContainer.innerHTML = filtered.map(chat => `
        <div class="chat-item p-3 flex items-center gap-3 cursor-pointer hover:bg-white/5 transition ${currentChatId === chat.id ? 'bg-[#2481cc20]' : ''}" data-chat-id="${chat.id}">
            <div class="w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center text-lg font-bold">${chat.name[0]}</div>
            <div class="flex-1 overflow-hidden">
                <div class="flex justify-between"><span class="font-semibold">${chat.name}</span><span class="text-xs text-gray-400">${chat.time || ''}</span></div>
                <div class="flex items-center gap-1 text-sm text-gray-400 truncate">
                    ${chat.unread ? `<span class="bg-[#2481cc] rounded-full w-5 h-5 text-center text-xs leading-5 mr-1">${chat.unread}</span>` : ''}
                    ${chat.typing ? '<span class="typing-dots"><span></span><span></span><span></span></span>' : (chat.lastMessage || 'No messages')}
                </div>
            </div>
        </div>
    `).join('');
    document.querySelectorAll('.chat-item').forEach(el => {
        el.addEventListener('click', () => openChat(el.dataset.chatId));
    });
}

// Load messages for a chat
function openChat(chatId) {
    if (messageListeners[chatId]) return;
    currentChatId = chatId;
    if (messageListeners[currentChatId]) {
        Object.values(messageListeners[currentChatId]).forEach(off => off());
    }
    messageListeners[currentChatId] = {};
    // Real-time messages
    const messagesRef = ref(db, `messages/${chatId}`);
    const onAdded = onChildAdded(messagesRef, (snap) => {
        const msg = snap.val();
        msg.id = snap.key;
        renderMessage(msg);
        scrollToBottomIfNeeded();
    });
    const onChanged = onChildChanged(messagesRef, (snap) => {
        const msg = snap.val();
        document.getElementById(`msg-${snap.key}`)?.replaceWith(createMessageElement(msg, snap.key));
    });
    messageListeners[currentChatId] = { onAdded, onChanged };
    // Mark messages as read
    const updates = {};
    const unreadQuery = query(messagesRef, orderByChild('readBy'), equalTo(null));
    get(unreadQuery).then(snapshot => {
        snapshot.forEach(child => {
            updates[`messages/${chatId}/${child.key}/readBy/${currentUser.uid}`] = true;
        });
        if (Object.keys(updates).length) update(ref(db), updates);
    });
    // Update chat title
    const chatData = chatListCache.find(c => c.id === chatId);
    chatTitle.innerText = chatData?.name || 'Chat';
    chatStatus.innerText = 'Online'; // mock status
    messagesContainer.innerHTML = '';
    scrollToBottom();
}

function createMessageElement(msg, msgId) {
    const isOutgoing = msg.senderId === currentUser.uid;
    const bubbleClass = isOutgoing ? 'message-outgoing' : 'message-incoming';
    const readStatus = isOutgoing && msg.readBy && Object.keys(msg.readBy).length > 1 ? '<i class="fas fa-check-double read-receipt"></i>' : '<i class="fas fa-check"></i>';
    let content = '';
    if (msg.type === 'image') content = `<img src="${msg.mediaUrl}" class="max-w-[200px] rounded-lg cursor-pointer" onclick="window.open('${msg.mediaUrl}')">`;
    else if (msg.type === 'video') content = `<video controls class="max-w-[250px] rounded-lg"><source src="${msg.mediaUrl}"></video>`;
    else if (msg.type === 'voice') content = `<audio controls src="${msg.mediaUrl}" class="h-8"></audio>`;
    else content = `<span>${msg.text}</span>`;
    return `<div id="msg-${msgId}" class="message-bubble ${bubbleClass} flex flex-col" data-msg-id="${msgId}" data-sender="${msg.senderId}">${content}<div class="text-right text-[10px] mt-1 text-gray-300">${new Date(msg.timestamp).toLocaleTimeString()} ${readStatus}</div></div>`;
}

function renderMessage(msg) {
    messagesContainer.insertAdjacentHTML('beforeend', createMessageElement(msg, msg.id));
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    scrollBtn.classList.add('hidden');
}
function scrollToBottomIfNeeded() {
    const isNearBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 100;
    if (isNearBottom) scrollToBottom();
    else scrollBtn.classList.remove('hidden');
}
scrollBtn.addEventListener('click', scrollToBottom);
messagesContainer.addEventListener('scroll', () => {
    if (messagesContainer.scrollTop + messagesContainer.clientHeight >= messagesContainer.scrollHeight - 50) scrollBtn.classList.add('hidden');
    else scrollBtn.classList.remove('hidden');
});

// Send button
sendBtn.addEventListener('click', () => sendMessage(messageInput.value));
messageInput.addEventListener('keydown', (e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(messageInput.value); } });

// Search filter
searchInput.addEventListener('input', renderChatList);

// Folder switching
folders.forEach(f => f.addEventListener('click', () => {
    folders.forEach(fo => fo.classList.remove('active'));
    f.classList.add('active');
    currentFolder = f.dataset.folder;
    renderChatList();
}));

// Authentication & Admin gateway
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        const email = prompt('Email:');
        const password = prompt('Password:');
        try {
            if (email === 'jasim28v@gmail.com' && password === 'vv2314vv') {
                const cred = await signInWithEmailAndPassword(auth, email, password);
                currentUser = cred.user;
                adminFolderIcon.classList.remove('hidden');
            } else {
                const cred = await signInWithEmailAndPassword(auth, email, password);
                currentUser = cred.user;
            }
        } catch(e) {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            currentUser = cred.user;
        }
        // Create user record in DB
        await set(ref(db, `users/${currentUser.uid}`), { email: currentUser.email, createdAt: serverTimestamp() });
        loadChats();
    } else {
        currentUser = user;
        if (currentUser.email === 'jasim28v@gmail.com') adminFolderIcon.classList.remove('hidden');
        loadChats();
    }
});

// Load chats from DB
function loadChats() {
    const chatsRef = ref(db, 'chats');
    get(chatsRef).then(snapshot => {
        const chats = [];
        snapshot.forEach(child => {
            const chat = child.val();
            if (chat.participants && chat.participants[currentUser.uid]) {
                const otherUid = Object.keys(chat.participants).find(uid => uid !== currentUser.uid);
                get(ref(db, `users/${otherUid}`)).then(userSnap => {
                    const name = userSnap.val()?.email?.split('@')[0] || 'Unknown';
                    chats.push({ id: child.key, name, lastMessage: chat.lastMessage, type: chat.type || 'personal', unread: 0 });
                    if (chats.length === snapshot.size) {
                        chatListCache = chats;
                        renderChatList();
                    }
                });
            }
        });
    });
}

// Admin features
adminFolderIcon.addEventListener('click', () => {
    if (currentUser.email !== 'jasim28v@gmail.com') return alert('Access denied.');
    adminModal.classList.remove('hidden');
    // Load users
    get(ref(db, 'users')).then(snap => {
        adminUserList.innerHTML = '';
        snap.forEach(child => {
            adminUserList.innerHTML += `<div>${child.val().email} (${child.key})</div>`;
        });
    });
    // Load media gallery from Cloudinary? We'll query messages media
    get(ref(db, 'messages')).then(snap => {
        const mediaUrls = [];
        snap.forEach(chatMsgs => {
            chatMsgs.forEach(msg => {
                if (msg.val().mediaUrl) mediaUrls.push(msg.val().mediaUrl);
            });
        });
        mediaGalleryList.innerHTML = mediaUrls.map(url => `<img src="${url}" class="rounded-lg w-full h-20 object-cover">`).join('');
    });
});
closeAdminModal.addEventListener('click', () => adminModal.classList.add('hidden'));
sendBroadcastBtn.addEventListener('click', async () => {
    const msg = broadcastMsg.value;
    if (!msg) return;
    const usersSnap = await get(ref(db, 'users'));
    usersSnap.forEach(async userSnap => {
        const userChatId = `broadcast_${userSnap.key}`;
        await push(ref(db, `messages/${userChatId}`), { text: msg, senderId: currentUser.uid, timestamp: serverTimestamp(), type: 'broadcast' });
    });
    alert('Broadcast sent');
});
banUserBtn.addEventListener('click', async () => {
    const uid = banUidInput.value;
    await update(ref(db, `users/${uid}`), { banned: true });
    alert(`User ${uid} banned.`);
});

// New chat
newChatBtn.addEventListener('click', () => newChatModal.classList.remove('hidden'));
closeNewChatModal.addEventListener('click', () => newChatModal.classList.add('hidden'));
searchUserInput.addEventListener('input', async () => {
    const term = searchUserInput.value.toLowerCase();
    const usersSnap = await get(ref(db, 'users'));
    const results = [];
    usersSnap.forEach(snap => {
        const email = snap.val().email;
        if (email !== currentUser.email && email.toLowerCase().includes(term)) {
            results.push({ uid: snap.key, email });
        }
    });
    userSearchResults.innerHTML = results.map(u => `<div class="p-2 hover:bg-white/10 cursor-pointer" data-uid="${u.uid}">${u.email}</div>`).join('');
    document.querySelectorAll('#userSearchResults div').forEach(el => {
        el.addEventListener('click', async () => {
            const otherUid = el.dataset.uid;
            const chatId = [currentUser.uid, otherUid].sort().join('_');
            const chatRef = ref(db, `chats/${chatId}`);
            const exists = await get(chatRef);
            if (!exists.exists()) {
                await set(chatRef, {
                    participants: { [currentUser.uid]: true, [otherUid]: true },
                    type: 'personal',
                    lastUpdated: serverTimestamp()
                });
            }
            newChatModal.classList.add('hidden');
            loadChats();
        });
    });
});

// Context menu (reply, edit, delete)
messagesContainer.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const msgDiv = e.target.closest('.message-bubble');
    if (!msgDiv) return;
    const msgId = msgDiv.dataset.msgId;
    const senderId = msgDiv.dataset.sender;
    const isOwn = senderId === currentUser.uid;
    const items = [];
    items.push({ label: 'Reply', action: () => { /* TODO */ } });
    if (isOwn) items.push({ label: 'Edit', action: () => { const newText = prompt('Edit message:'); if(newText) update(ref(db, `messages/${currentChatId}/${msgId}`), { text: newText }); } });
    if (isOwn || currentUser.email === 'jasim28v@gmail.com') items.push({ label: 'Delete for everyone', action: () => remove(ref(db, `messages/${currentChatId}/${msgId}`)) });
    contextMenu.innerHTML = items.map(i => `<div>${i.label}</div>`).join('');
    contextMenu.style.top = `${e.pageY}px`;
    contextMenu.style.left = `${e.pageX}px`;
    contextMenu.classList.remove('hidden');
    contextMenu.querySelectorAll('div').forEach((div, idx) => div.addEventListener('click', () => { items[idx].action(); contextMenu.classList.add('hidden'); }));
});
document.addEventListener('click', () => contextMenu.classList.add('hidden'));

// Typing indicator
messageInput.addEventListener('input', () => {
    if (!currentChatId) return;
    const typingRef = ref(db, `typing/${currentChatId}/${currentUser.uid}`);
    set(typingRef, true);
    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => remove(typingRef), 2000);
});
