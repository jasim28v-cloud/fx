import { auth, db } from './firebase-config.js';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    onAuthStateChanged 
} from "firebase/auth";
import { 
    ref, set, push, onChildAdded, onChildChanged, onChildRemoved, 
    get, update, query, orderByChild, equalTo, remove, serverTimestamp 
} from "firebase/database";

// ------------------- عناصر DOM -------------------
const loginScreen = document.getElementById('loginScreen');
const appContainer = document.getElementById('appContainer');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');
const loginError = document.getElementById('loginError');

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
const toggleEncryption = document.getElementById('toggleEncryption');
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

// ------------------- متغيرات الحالة -------------------
let currentUser = null;
let currentChatId = null;
let currentFolder = 'all';
let chatListCache = [];
let messageListeners = {};
let typingTimeout = null;
let mediaRecorder = null;
let audioChunks = [];
let chatEncryptionEnabled = false;   // لتشفير المحادثة الحالية
let encryptionKeys = {};             // تخزين المفاتيح لكل محادثة

// ------------------- دوال التشفير (E2EE) -------------------
async function generateKey() {
    return await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
}

async function exportKey(key) {
    return window.btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey("raw", key))));
}
async function importKey(base64Key) {
    const keyData = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
    return await crypto.subtle.importKey("raw", keyData, "AES-GCM", true, ["encrypt", "decrypt"]);
}

async function encryptMessage(text, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(text);
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    return window.btoa(String.fromCharCode(...combined));
}

async function decryptMessage(encryptedBase64, key) {
    const data = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
    const iv = data.slice(0, 12);
    const encrypted = data.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
    return new TextDecoder().decode(decrypted);
}

// إعداد مفتاح للمحادثة
async function setupEncryptionForChat(chatId) {
    if (!encryptionKeys[chatId]) {
        const newKey = await generateKey();
        encryptionKeys[chatId] = newKey;
        // حفظ المفتاح في قاعدة البيانات مشفراً بمفتاح المستخدم (مبسط: نخزنه في localStorage)
        const exported = await exportKey(newKey);
        localStorage.setItem(`key_${chatId}`, exported);
    } else {
        const stored = localStorage.getItem(`key_${chatId}`);
        if (stored) encryptionKeys[chatId] = await importKey(stored);
    }
}

// ------------------- رفع الوسائط -------------------
async function uploadMedia(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'ekxzvogb');
    if (file.type.startsWith('image/')) {
        const compressed = await compressImage(file);
        formData.set('file', compressed);
    }
    const res = await fetch('https://api.cloudinary.com/v1_1/dnillsbmi/upload', {
        method: 'POST',
        body: formData
    });
    const data = await res.json();
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
                let w = img.width, h = img.height;
                const maxSize = 1024;
                if (w > maxSize || h > maxSize) {
                    if (w > h) {
                        h *= maxSize / w;
                        w = maxSize;
                    } else {
                        w *= maxSize / h;
                        h = maxSize;
                    }
                }
                canvas.width = w;
                canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                canvas.toBlob(resolve, 'image/jpeg', 0.8);
            };
        };
    });
}

// ------------------- إرسال الرسالة -------------------
async function sendMessage(text, mediaUrl = null, type = 'text') {
    if (!currentChatId || (!text.trim() && !mediaUrl)) return;
    let finalText = text.trim();
    if (chatEncryptionEnabled && finalText && type === 'text') {
        const key = encryptionKeys[currentChatId];
        if (key) finalText = await encryptMessage(finalText, key);
    }
    const newMsgRef = push(ref(db, `messages/${currentChatId}`));
    await set(newMsgRef, {
        text: finalText,
        senderId: currentUser.uid,
        timestamp: serverTimestamp(),
        readBy: { [currentUser.uid]: true },
        type: type,
        mediaUrl: mediaUrl || null,
        encrypted: chatEncryptionEnabled && type === 'text'
    });
    await update(ref(db, `chats/${currentChatId}`), {
        lastMessage: text.trim() || (type === 'image' ? '📷 صورة' : '🎤 صوت'),
        lastUpdated: serverTimestamp()
    });
    messageInput.value = '';
    scrollToBottom();
}

// ------------------- عرض الرسائل -------------------
async function renderMessage(msg, msgId) {
    let displayText = msg.text;
    if (msg.encrypted && msg.senderId !== currentUser.uid && encryptionKeys[currentChatId]) {
        try {
            displayText = await decryptMessage(msg.text, encryptionKeys[currentChatId]);
        } catch(e) { displayText = '🔒 رسالة مشفرة (تعذر فكها)'; }
    } else if (msg.encrypted && msg.senderId === currentUser.uid && encryptionKeys[currentChatId]) {
        // الرسائل الصادرة المخزنة مشفرة، نحتاج فكها للعرض
        try {
            displayText = await decryptMessage(msg.text, encryptionKeys[currentChatId]);
        } catch(e) { displayText = '🔒 رسالة مشفرة'; }
    }
    const isOutgoing = msg.senderId === currentUser.uid;
    const bubbleClass = isOutgoing ? 'message-outgoing' : 'message-incoming';
    const readStatus = isOutgoing && msg.readBy && Object.keys(msg.readBy).length > 1 ? '<i class="fas fa-check-double read-receipt"></i>' : '<i class="fas fa-check"></i>';
    let content = '';
    if (msg.type === 'image') content = `<img src="${msg.mediaUrl}" class="max-w-[200px] rounded-lg cursor-pointer" onclick="window.open('${msg.mediaUrl}')">`;
    else if (msg.type === 'video') content = `<video controls class="max-w-[250px] rounded-lg"><source src="${msg.mediaUrl}"></video>`;
    else if (msg.type === 'voice') content = `<audio controls src="${msg.mediaUrl}" class="h-8"></audio>`;
    else content = `<span>${displayText}</span>`;
    const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : '';
    return `<div id="msg-${msgId}" class="message-bubble ${bubbleClass} flex flex-col" data-msg-id="${msgId}" data-sender="${msg.senderId}">${content}<div class="text-right text-[10px] mt-1 text-gray-300">${time} ${readStatus}</div></div>`;
}

// ------------------- تحميل المحادثات -------------------
function loadChats() {
    const chatsRef = ref(db, 'chats');
    get(chatsRef).then(snapshot => {
        const chats = [];
        snapshot.forEach(child => {
            const chat = child.val();
            if (chat.participants && chat.participants[currentUser.uid]) {
                const otherUid = Object.keys(chat.participants).find(uid => uid !== currentUser.uid);
                get(ref(db, `users/${otherUid}`)).then(userSnap => {
                    const name = userSnap.val()?.email?.split('@')[0] || 'مستخدم';
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

function renderChatList() {
    let filtered = [...chatListCache];
    if (currentFolder !== 'all') {
        filtered = filtered.filter(chat => chat.type === currentFolder);
    }
    const searchTerm = searchInput.value.trim();
    if (searchTerm) {
        try {
            const regex = new RegExp(searchTerm, 'i');
            filtered = filtered.filter(chat => regex.test(chat.name) || regex.test(chat.lastMessage || ''));
        } catch(e) {}
    }
    chatListContainer.innerHTML = filtered.map(chat => `
        <div class="chat-item p-3 flex items-center gap-3 cursor-pointer hover:bg-white/5 transition ${currentChatId === chat.id ? 'bg-[#2481cc20]' : ''}" data-chat-id="${chat.id}">
            <div class="w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center text-lg font-bold">${chat.name[0]}</div>
            <div class="flex-1 overflow-hidden">
                <div class="flex justify-between"><span class="font-semibold">${chat.name}</span><span class="text-xs text-gray-400">${chat.time || ''}</span></div>
                <div class="flex items-center gap-1 text-sm text-gray-400 truncate">
                    ${chat.unread ? `<span class="bg-[#2481cc] rounded-full w-5 h-5 text-center text-xs leading-5 ml-1">${chat.unread}</span>` : ''}
                    ${chat.typing ? '<span class="typing-dots"><span></span><span></span><span></span></span>' : (chat.lastMessage || 'لا توجد رسائل')}
                </div>
            </div>
        </div>
    `).join('');
    document.querySelectorAll('.chat-item').forEach(el => {
        el.addEventListener('click', () => openChat(el.dataset.chatId));
    });
}

// ------------------- فتح محادثة -------------------
async function openChat(chatId) {
    if (messageListeners[chatId]) {
        Object.values(messageListeners[chatId]).forEach(off => off());
    }
    currentChatId = chatId;
    // إعداد التشفير للمحادثة إذا لم يكن موجوداً
    await setupEncryptionForChat(chatId);
    chatEncryptionEnabled = !!encryptionKeys[chatId];
    toggleEncryption.className = chatEncryptionEnabled ? 'fas fa-lock text-[#2481cc] cursor-pointer' : 'fas fa-lock-open text-gray-300 cursor-pointer';
    // تحميل الرسائل
    const messagesRef = ref(db, `messages/${chatId}`);
    const onAdded = onChildAdded(messagesRef, async (snap) => {
        const msg = snap.val();
        msg.id = snap.key;
        const msgHtml = await renderMessage(msg, msg.id);
        messagesContainer.insertAdjacentHTML('beforeend', msgHtml);
        scrollToBottomIfNeeded();
    });
    const onChanged = onChildChanged(messagesRef, async (snap) => {
        const msg = snap.val();
        const newHtml = await renderMessage(msg, snap.key);
        document.getElementById(`msg-${snap.key}`)?.replaceWith(newHtml);
    });
    messageListeners[chatId] = { onAdded, onChanged };
    // تحديث عنوان الدردشة
    const chatData = chatListCache.find(c => c.id === chatId);
    chatTitle.innerText = chatData?.name || 'محادثة';
    chatStatus.innerText = 'متصل';
    messagesContainer.innerHTML = '';
    scrollToBottom();
    // وضع علامة قراءة
    const updates = {};
    const unreadQuery = query(messagesRef, orderByChild('readBy'), equalTo(null));
    get(unreadQuery).then(snapshot => {
        snapshot.forEach(child => {
            updates[`messages/${chatId}/${child.key}/readBy/${currentUser.uid}`] = true;
        });
        if (Object.keys(updates).length) update(ref(db), updates);
    });
}

// ------------------- إدارة الوسائط -------------------
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
        const url = await uploadMedia(audioBlob);
        sendMessage('', url, 'voice');
        stream.getTracks().forEach(track => track.stop());
    };
    mediaRecorder.start();
    voiceNoteBtn.innerHTML = '<i class="fas fa-stop"></i>';
    setTimeout(() => {
        if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
    }, 60000);
});

// ------------------- الإرسال -------------------
sendBtn.addEventListener('click', () => sendMessage(messageInput.value));
messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(messageInput.value);
    }
});

// ------------------- التمرير -------------------
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

// ------------------- البحث -------------------
searchInput.addEventListener('input', renderChatList);

// ------------------- المجلدات -------------------
folders.forEach(f => f.addEventListener('click', () => {
    folders.forEach(fo => fo.classList.remove('active'));
    f.classList.add('active');
    currentFolder = f.dataset.folder;
    renderChatList();
}));

// ------------------- المصادقة -------------------
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        loginScreen.classList.add('hidden');
        appContainer.classList.remove('hidden');
        if (currentUser.email === 'jasim28v@gmail.com') adminFolderIcon.classList.remove('hidden');
        loadChats();
    } else {
        loginScreen.classList.remove('hidden');
        appContainer.classList.add('hidden');
    }
});

loginBtn.addEventListener('click', async () => {
    const email = loginEmail.value.trim();
    const password = loginPassword.value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
        loginError.innerText = err.message;
        loginError.classList.remove('hidden');
    }
});

signupBtn.addEventListener('click', async () => {
    const email = loginEmail.value.trim();
    const password = loginPassword.value;
    try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await set(ref(db, `users/${cred.user.uid}`), { email: cred.user.email, createdAt: serverTimestamp() });
    } catch (err) {
        loginError.innerText = err.message;
        loginError.classList.remove('hidden');
    }
});

// ------------------- إدارة المدير -------------------
adminFolderIcon.addEventListener('click', () => {
    if (currentUser.email !== 'jasim28v@gmail.com') return;
    adminModal.classList.remove('hidden');
    get(ref(db, 'users')).then(snap => {
        adminUserList.innerHTML = '';
        snap.forEach(child => {
            adminUserList.innerHTML += `<div>${child.val().email} (${child.key})</div>`;
        });
    });
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
        const chatId = `broadcast_${userSnap.key}`;
        await push(ref(db, `messages/${chatId}`), { text: msg, senderId: currentUser.uid, timestamp: serverTimestamp(), type: 'broadcast' });
    });
    alert('تم الإرسال');
});
banUserBtn.addEventListener('click', async () => {
    const uid = banUidInput.value;
    await update(ref(db, `users/${uid}`), { banned: true });
    alert(`تم حظر المستخدم ${uid}`);
});

// ------------------- محادثة جديدة -------------------
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

// ------------------- قائمة السياق -------------------
messagesContainer.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const msgDiv = e.target.closest('.message-bubble');
    if (!msgDiv) return;
    const msgId = msgDiv.dataset.msgId;
    const senderId = msgDiv.dataset.sender;
    const isOwn = senderId === currentUser.uid;
    const items = [];
    items.push({ label: 'رد', action: () => { /* يمكن تنفيذ الرد لاحقاً */ } });
    if (isOwn) items.push({ label: 'تعديل', action: () => { const newText = prompt('تعديل الرسالة:'); if(newText) update(ref(db, `messages/${currentChatId}/${msgId}`), { text: newText }); } });
    if (isOwn || currentUser.email === 'jasim28v@gmail.com') items.push({ label: 'حذف للجميع', action: () => remove(ref(db, `messages/${currentChatId}/${msgId}`)) });
    contextMenu.innerHTML = items.map(i => `<div>${i.label}</div>`).join('');
    contextMenu.style.top = `${e.pageY}px`;
    contextMenu.style.left = `${e.pageX}px`;
    contextMenu.classList.remove('hidden');
    contextMenu.querySelectorAll('div').forEach((div, idx) => div.addEventListener('click', () => { items[idx].action(); contextMenu.classList.add('hidden'); }));
});
document.addEventListener('click', () => contextMenu.classList.add('hidden'));

// ------------------- مؤشر الكتابة -------------------
messageInput.addEventListener('input', () => {
    if (!currentChatId) return;
    const typingRef = ref(db, `typing/${currentChatId}/${currentUser.uid}`);
    set(typingRef, true);
    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => remove(typingRef), 2000);
});

// ------------------- تبديل التشفير -------------------
toggleEncryption.addEventListener('click', async () => {
    if (!currentChatId) return;
    chatEncryptionEnabled = !chatEncryptionEnabled;
    if (chatEncryptionEnabled) {
        await setupEncryptionForChat(currentChatId);
        toggleEncryption.className = 'fas fa-lock text-[#2481cc] cursor-pointer';
    } else {
        toggleEncryption.className = 'fas fa-lock-open text-gray-300 cursor-pointer';
        // لا نحذف المفتاح حتى يمكن إعادة تفعيله لاحقاً
    }
});
