import { 
    auth, database, firestore,
    ref, set, get, push, onValue, update, remove,
    createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile,
    doc, setDoc, getDoc, collection, addDoc, fsQuery, where, getDocs, updateDoc, deleteDoc, onSnapshot, fsOrderBy,
    ADMIN_EMAIL, ADMIN_CODE,
    CLOUDINARY_CONFIG
} from './firebase-config.js';

// Global Variables
let currentUser = null;
let currentChatUser = null;
let isAdmin = false;
let usersCache = new Map();
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let peerConnection = null;
let localStream = null;
let remoteStream = null;
let currentCall = null;

// DOM Elements
const authContainer = document.getElementById('authContainer');
const appContainer = document.getElementById('appContainer');
const emailInput = document.getElementById('email');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const submitBtn = document.getElementById('submitBtn');
const toggleAuth = document.getElementById('toggleAuth');
const chatsList = document.getElementById('chatsList');
const usersList = document.getElementById('usersList');
const profileContent = document.getElementById('profileContent');
const chatArea = document.getElementById('chatArea');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const closeChat = document.getElementById('closeChat');
const chatUserName = document.getElementById('chatUserName');
const typingIndicator = document.getElementById('typingIndicator');
const imageUploadBtn = document.getElementById('imageUploadBtn');
const recordAudioBtn = document.getElementById('recordAudioBtn');
const voiceCallBtn = document.getElementById('voiceCallBtn');
const callModal = document.getElementById('callModal');
const callStatus = document.getElementById('callStatus');
const endCallBtn = document.getElementById('endCallBtn');
const acceptCallBtn = document.getElementById('acceptCallBtn');
const callAvatar = document.getElementById('callAvatar');

let isLoginMode = true;
let typingTimeout = null;
let currentMessagesUnsubscribe = null;

// ============ AUTHENTICATION ============
function checkAdmin(email) { return email === ADMIN_EMAIL; }

onAuthStateChanged(auth, async (user) => {
    console.log("Auth state:", user);
    if (user) {
        currentUser = user;
        isAdmin = checkAdmin(user.email);
        try {
            const userRef = doc(firestore, 'users', user.uid);
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) {
                await setDoc(userRef, {
                    uid: user.uid, email: user.email,
                    username: user.displayName || user.email.split('@')[0],
                    createdAt: new Date().toISOString(),
                    isAdmin: isAdmin, isBanned: false
                });
            } else if (isAdmin && !userSnap.data().isAdmin) {
                await updateDoc(userRef, { isAdmin: true });
            }
            showMainApp();
            loadUsers(); loadChats(); loadProfile();
            setupCallListeners();
        } catch (error) { console.error("Error:", error); }
    } else { showAuthScreen(); }
});

function showAuthScreen() { if (authContainer) authContainer.style.display = 'flex'; if (appContainer) appContainer.style.display = 'none'; }
function showMainApp() { if (authContainer) authContainer.style.display = 'none'; if (appContainer) appContainer.style.display = 'block'; }

if (toggleAuth) {
    toggleAuth.addEventListener('click', () => {
        isLoginMode = !isLoginMode;
        submitBtn.textContent = isLoginMode ? 'تسجيل دخول' : 'إنشاء حساب';
        toggleAuth.textContent = isLoginMode ? 'ليس لديك حساب؟ إنشاء حساب' : 'لديك حساب؟ سجل دخول';
        if (usernameInput) usernameInput.style.display = isLoginMode ? 'none' : 'block';
    });
}

if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const username = usernameInput.value.trim();
        if (!email || !password) { alert('يرجى إدخال البريد الإلكتروني وكلمة المرور'); return; }
        try {
            if (isLoginMode) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                if (!username) { alert('يرجى إدخال اسم المستخدم'); return; }
                if (password.length < 6) { alert('كلمة المرور 6 أحرف على الأقل'); return; }
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(userCredential.user, { displayName: username });
            }
        } catch (error) {
            let msg = { 'auth/email-already-in-use': 'البريد مستخدم', 'auth/invalid-email': 'بريد غير صحيح', 'auth/weak-password': 'كلمة مرور ضعيفة', 'auth/wrong-password': 'كلمة مرور خاطئة', 'auth/user-not-found': 'مستخدم غير موجود' }[error.code] || 'حدث خطأ';
            alert(msg);
        }
    });
}

// ============ CLOUDINARY UPLOAD ============
function uploadToCloudinary(file, type) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        
        fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/${type}/upload`, {
            method: 'POST',
            body: formData
        })
        .then(res => res.json())
        .then(data => resolve({ url: data.secure_url, public_id: data.public_id }))
        .catch(reject);
    });
}

if (imageUploadBtn) {
    imageUploadBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            imageUploadBtn.disabled = true;
            imageUploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            try {
                const result = await uploadToCloudinary(file, 'image');
                await sendMessage('📷 صورة', result.url, 'image');
            } catch (error) { alert('فشل رفع الصورة'); }
            finally { imageUploadBtn.disabled = false; imageUploadBtn.innerHTML = '<i class="fas fa-image"></i>'; }
        };
        input.click();
    });
}

// ============ AUDIO RECORDING ============
if (recordAudioBtn) {
    recordAudioBtn.addEventListener('click', async () => {
        if (isRecording) {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
                recordAudioBtn.classList.remove('recording-btn');
                recordAudioBtn.innerHTML = '<i class="fas fa-microphone"></i>';
                isRecording = false;
            }
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];
                
                mediaRecorder.ondataavailable = (event) => audioChunks.push(event.data);
                mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    const file = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
                    recordAudioBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                    try {
                        const result = await uploadToCloudinary(file, 'video'); // video for audio
                        await sendMessage('🎤 رسالة صوتية', result.url, 'audio');
                    } catch (error) { alert('فشل رفع التسجيل'); }
                    finally { recordAudioBtn.innerHTML = '<i class="fas fa-microphone"></i>'; }
                    stream.getTracks().forEach(track => track.stop());
                };
                
                mediaRecorder.start();
                recordAudioBtn.classList.add('recording-btn');
                recordAudioBtn.innerHTML = '<i class="fas fa-stop"></i>';
                isRecording = true;
                
                setTimeout(() => {
                    if (mediaRecorder && mediaRecorder.state === 'recording') {
                        mediaRecorder.stop();
                        recordAudioBtn.classList.remove('recording-btn');
                        recordAudioBtn.innerHTML = '<i class="fas fa-microphone"></i>';
                        isRecording = false;
                    }
                }, 30000); // max 30 seconds
            } catch (error) { alert('لا يمكن الوصول إلى الميكروفون'); }
        }
    });
}

// ============ VOICE CALL (WebRTC) ============
async function setupCallListeners() {
    const callsRef = ref(database, 'calls');
    onValue(callsRef, (snapshot) => {
        const calls = snapshot.val();
        if (calls && currentUser) {
            for (const [callId, call] of Object.entries(calls)) {
                if (call.to === currentUser.uid && call.status === 'calling') {
                    showIncomingCall(callId, call.from);
                }
            }
        }
    });
}

async function startVoiceCall(toUserId) {
    const callId = `${currentUser.uid}_${toUserId}_${Date.now()}`;
    const callRef = ref(database, `calls/${callId}`);
    await set(callRef, {
        from: currentUser.uid,
        to: toUserId,
        status: 'calling',
        timestamp: new Date().toISOString()
    });
    
    showCallModal('جاري الاتصال...', false);
    currentCall = { callId, toUserId };
    
    // Listen for answer
    onValue(callRef, async (snapshot) => {
        const call = snapshot.val();
        if (call && call.status === 'answered') {
            await initiateWebRTC(toUserId, callId);
        } else if (call && call.status === 'rejected') {
            closeCallModal();
            alert('المستخدم رفض المكالمة');
        } else if (call && call.status === 'ended') {
            closeCallModal();
            endWebRTC();
        }
    });
}

function showIncomingCall(callId, fromUserId) {
    getUserById(fromUserId).then(user => {
        if (!user) return;
        callModal.classList.add('active');
        callAvatar.innerHTML = `<i class="fas fa-phone-alt"></i>`;
        callStatus.textContent = `${user.username} يتصل بك...`;
        acceptCallBtn.style.display = 'block';
        currentCall = { callId, fromUserId };
        
        acceptCallBtn.onclick = async () => {
            const callRef = ref(database, `calls/${callId}`);
            await update(callRef, { status: 'answered' });
            acceptCallBtn.style.display = 'none';
            callStatus.textContent = 'جاري الاتصال...';
            await initiateWebRTC(fromUserId, callId);
        };
        
        endCallBtn.onclick = async () => {
            const callRef = ref(database, `calls/${callId}`);
            await update(callRef, { status: 'rejected' });
            closeCallModal();
        };
    });
}

async function initiateWebRTC(remoteUserId, callId) {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
        peerConnection = new RTCPeerConnection(configuration);
        
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
        
        peerConnection.ontrack = (event) => {
            remoteStream = event.streams[0];
            // Play remote audio
            const audio = new Audio();
            audio.srcObject = remoteStream;
            audio.play();
        };
        
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                const candidateRef = ref(database, `calls/${callId}/candidates/${Date.now()}`);
                set(candidateRef, event.candidate);
            }
        };
        
        // Create or answer offer
        const callRef = ref(database, `calls/${callId}`);
        const callSnap = await get(callRef);
        const call = callSnap.val();
        
        if (call && call.status === 'calling' && call.from === currentUser.uid) {
            // Caller creates offer
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            await update(callRef, { offer: offer });
        } else {
            // Callee answers
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            await update(callRef, { answer: answer });
        }
        
        // Listen for remote description
        onValue(callRef, async (snapshot) => {
            const data = snapshot.val();
            if (data && data.offer && !peerConnection.currentRemoteDescription && peerConnection.signalingState === 'stable') {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
                if (data.from === remoteUserId) {
                    const answer = await peerConnection.createAnswer();
                    await peerConnection.setLocalDescription(answer);
                    await update(callRef, { answer: answer });
                }
            }
            if (data && data.answer && !peerConnection.currentRemoteDescription) {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            }
            // Handle candidates
            if (data && data.candidates) {
                for (const key in data.candidates) {
                    const candidate = data.candidates[key];
                    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                }
            }
        });
        
        showCallModal('متصل...', true);
        
    } catch (error) {
        console.error('WebRTC error:', error);
        alert('لا يمكن بدء المكالمة');
        endWebRTC();
    }
}

function endWebRTC() {
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    if (peerConnection) peerConnection.close();
    if (currentCall) {
        const callRef = ref(database, `calls/${currentCall.callId}`);
        update(callRef, { status: 'ended' });
        setTimeout(() => remove(callRef), 5000);
    }
    localStream = null;
    peerConnection = null;
    currentCall = null;
}

function showCallModal(status, showEndOnly = false) {
    callModal.classList.add('active');
    callStatus.textContent = status;
    acceptCallBtn.style.display = 'none';
    endCallBtn.onclick = () => {
        endWebRTC();
        closeCallModal();
    };
}

function closeCallModal() {
    callModal.classList.remove('active');
    endWebRTC();
}

if (voiceCallBtn) voiceCallBtn.addEventListener('click', () => {
    if (currentChatUser) startVoiceCall(currentChatUser.uid);
});

if (endCallBtn) endCallBtn.onclick = () => { endWebRTC(); closeCallModal(); };

// ============ CHAT FUNCTIONS ============
async function sendMessage(text, fileUrl = null, fileType = null) {
    if (!currentChatUser || (!text && !fileUrl)) return;
    const chatId = getChatId(currentUser.uid, currentChatUser.uid);
    try {
        const chatRef = doc(firestore, 'chats', chatId);
        const chatSnap = await getDoc(chatRef);
        if (!chatSnap.exists()) {
            await setDoc(chatRef, {
                participants: [currentUser.uid, currentChatUser.uid],
                createdAt: new Date().toISOString(),
                lastMessage: text || (fileType === 'image' ? '📷 صورة' : '🎤 رسالة صوتية'),
                lastMessageTime: new Date().toISOString()
            });
        } else {
            await updateDoc(chatRef, {
                lastMessage: text || (fileType === 'image' ? '📷 صورة' : '🎤 رسالة صوتية'),
                lastMessageTime: new Date().toISOString()
            });
        }
        const messagesRef = collection(firestore, 'chats', chatId, 'messages');
        await addDoc(messagesRef, {
            senderId: currentUser.uid,
            text: text || '',
            fileUrl: fileUrl,
            fileType: fileType,
            timestamp: new Date().toISOString(),
            read: false
        });
        if (messageInput) messageInput.value = '';
    } catch (error) { console.error('Send error:', error); }
}

async function loadMessages(user) {
    if (currentMessagesUnsubscribe) currentMessagesUnsubscribe();
    const chatId = getChatId(currentUser.uid, user.uid);
    const messagesRef = collection(firestore, 'chats', chatId, 'messages');
    const q = fsQuery(messagesRef, fsOrderBy('timestamp', 'asc'));
    currentMessagesUnsubscribe = onSnapshot(q, (snapshot) => {
        let html = '';
        snapshot.forEach(doc => {
            const msg = doc.data();
            const isOwn = msg.senderId === currentUser.uid;
            let content = '';
            if (msg.text) content += `<div class="message-text">${escapeHtml(msg.text)}</div>`;
            if (msg.fileUrl && msg.fileType === 'image') content += `<img src="${msg.fileUrl}" class="message-image" onclick="window.open('${msg.fileUrl}')" />`;
            if (msg.fileUrl && msg.fileType === 'audio') content += `<div class="message-audio"><audio controls src="${msg.fileUrl}"></audio></div>`;
            html += `
                <div class="message ${isOwn ? 'own' : ''}">
                    <div class="message-bubble">
                        ${content}
                        <div class="message-time">${new Date(msg.timestamp).toLocaleTimeString('ar-EG')}</div>
                    </div>
                </div>
            `;
        });
        if (messagesContainer) {
            messagesContainer.innerHTML = html || '<div style="text-align:center;padding:20px;">لا توجد رسائل</div>';
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    });
}

async function loadUsers() {
    const q = fsQuery(collection(firestore, 'users'), where('isBanned', '==', false));
    const snapshot = await getDocs(q);
    usersCache.clear();
    let html = '';
    snapshot.forEach(doc => {
        const user = doc.data();
        if (user.uid !== currentUser?.uid) {
            usersCache.set(user.uid, user);
            html += `<div class="chat-item" onclick="window.startChat('${user.uid}', '${escapeHtml(user.username)}')">
                <div class="chat-avatar">${escapeHtml(user.username.charAt(0).toUpperCase())}</div>
                <div class="chat-info"><div class="chat-name">${escapeHtml(user.username)}</div></div>
            </div>`;
        }
    });
    if (usersList) usersList.innerHTML = html || '<div style="padding:20px;text-align:center;">لا يوجد مستخدمين</div>';
}

async function loadChats() {
    if (!currentUser) return;
    const q = fsQuery(collection(firestore, 'chats'), where('participants', 'array-contains', currentUser.uid));
    const snapshot = await getDocs(q);
    let html = '';
    for (const doc of snapshot.docs) {
        const chat = doc.data();
        const otherId = chat.participants.find(id => id !== currentUser.uid);
        const other = await getUserById(otherId);
        if (other && !other.isBanned) {
            html += `<div class="chat-item" onclick="window.startChat('${other.uid}', '${escapeHtml(other.username)}')">
                <div class="chat-avatar">${escapeHtml(other.username.charAt(0).toUpperCase())}</div>
                <div class="chat-info">
                    <div class="chat-name">${escapeHtml(other.username)}</div>
                    <div class="chat-lastmsg">${escapeHtml((chat.lastMessage || '').substring(0, 30))}</div>
                </div>
            </div>`;
        }
    }
    if (chatsList) chatsList.innerHTML = html || '<div style="padding:20px;text-align:center;">لا يوجد محادثات</div>';
}

async function getUserById(uid) {
    if (usersCache.has(uid)) return usersCache.get(uid);
    try {
        const snap = await getDoc(doc(firestore, 'users', uid));
        if (snap.exists()) { usersCache.set(uid, snap.data()); return snap.data(); }
    } catch(e) {}
    return null;
}

async function loadProfile() {
    if (!currentUser) return;
    const userSnap = await getDoc(doc(firestore, 'users', currentUser.uid));
    const userData = userSnap.exists() ? userSnap.data() : { username: currentUser.email.split('@')[0] };
    let html = `<div class="admin-stat"><i class="fas fa-user-circle" style="font-size:60px;"></i><h3>${escapeHtml(userData.username)}</h3><p>${escapeHtml(currentUser.email)}</p></div>
        <div class="admin-panel"><div style="padding:20px;"><button class="btn btn-danger" id="logoutBtn" style="width:100%;">تسجيل الخروج</button></div></div>`;
    if (isAdmin) {
        const usersSnap = await getDocs(collection(firestore, 'users'));
        let adminHtml = `<div class="admin-panel"><div style="padding:20px;background:linear-gradient(135deg,#f56565,#ed64a6);color:white;"><h3>👑 لوحة التحكم</h3><p>رمز: ${ADMIN_CODE}</p></div><div>`;
        usersSnap.forEach(doc => {
            const u = doc.data();
            if (u.uid !== currentUser.uid) {
                adminHtml += `<div class="user-list-item"><div><strong>${escapeHtml(u.username)}</strong><br><small>${escapeHtml(u.email)}</small>${u.isBanned ? ' <span style="color:red;">(محظور)</span>' : ''}</div>
                    <div><button class="ban-user-btn" onclick="window.toggleBanUser('${u.uid}', ${!u.isBanned})">${u.isBanned ? 'إلغاء الحظر' : 'حظر'}</button>
                    <button class="delete-user-btn" onclick="window.deleteUser('${u.uid}')">حذف</button></div></div>`;
            }
        });
        adminHtml += '</div></div>';
        html += adminHtml;
    }
    if (profileContent) profileContent.innerHTML = html;
    document.getElementById('logoutBtn')?.addEventListener('click', async () => { await signOut(auth); showAuthScreen(); });
}

window.startChat = async (uid, username) => {
    currentChatUser = { uid, username };
    if (chatUserName) chatUserName.textContent = username;
    if (chatArea) chatArea.style.display = 'block';
    await loadMessages(currentChatUser);
    listenTyping();
};

function listenTyping() {
    if (!currentChatUser || !currentUser) return;
    const typingRef = ref(database, `typing/${getChatId(currentUser.uid, currentChatUser.uid)}/${currentChatUser.uid}`);
    onValue(typingRef, (snap) => {
        if (typingIndicator) {
            if (snap.exists()) { typingIndicator.style.display = 'block'; typingIndicator.textContent = `${currentChatUser.username} يكتب...`; setTimeout(() => { if (typingIndicator) typingIndicator.style.display = 'none'; }, 3000); }
            else typingIndicator.style.display = 'none';
        }
    });
}

function sendTypingStatus(isTyping) {
    if (currentChatUser && currentUser) {
        const typingRef = ref(database, `typing/${getChatId(currentUser.uid, currentChatUser.uid)}/${currentUser.uid}`);
        if (isTyping) { set(typingRef, true); setTimeout(() => remove(typingRef), 3000); }
        else remove(typingRef);
    }
}

if (sendMessageBtn) sendMessageBtn.addEventListener('click', async () => {
    const text = messageInput?.value.trim();
    if (text) await sendMessage(text);
    if (messageInput) messageInput.value = '';
});

if (messageInput) {
    messageInput.addEventListener('input', () => { sendTypingStatus(true); clearTimeout(typingTimeout); typingTimeout = setTimeout(() => sendTypingStatus(false), 2000); });
    messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessageBtn.click(); });
}

if (closeChat) closeChat.addEventListener('click', () => { if (chatArea) chatArea.style.display = 'none'; currentChatUser = null; });

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        const page = item.dataset.page;
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`${page}Page`).classList.add('active');
        if (page === 'chats') loadChats();
        if (page === 'users') loadUsers();
        if (page === 'profile') loadProfile();
    });
});

window.toggleBanUser = async (uid, banned) => { if (isAdmin) { await updateDoc(doc(firestore, 'users', uid), { isBanned: !banned }); loadProfile(); loadUsers(); loadChats(); } };
window.deleteUser = async (uid) => { if (isAdmin && confirm('حذف نهائي؟')) { await deleteDoc(doc(firestore, 'users', uid)); loadProfile(); loadUsers(); loadChats(); } };

function getChatId(a, b) { return [a, b].sort().join('_'); }
function escapeHtml(t) { if (!t) return ''; const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

if (usernameInput) usernameInput.style.display = 'none';
console.log("TAGRAME Pro - Ready!");
