import { 
    auth, database, firestore,
    ref, set, get, push, onValue, update, remove,
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    updateProfile,
    doc, setDoc, getDoc, collection, addDoc, fsQuery, where, getDocs, updateDoc, deleteDoc, onSnapshot, fsOrderBy,
    ADMIN_EMAIL, ADMIN_CODE,
    CLOUDINARY_CONFIG
} from './firebase-config.js';

// ============ المتغيرات العامة ============
let currentUser = null;
let currentChatUser = null;
let isAdmin = false;
let usersCache = new Map();
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

// ============ عناصر DOM ============
const authContainer = document.getElementById('authContainer');
const appContainer = document.getElementById('appContainer');
const emailInput = document.getElementById('email');
const usernameInput = document.getElementById('username');
const usernameGroup = document.getElementById('usernameGroup');
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

let isLoginMode = true;
let typingTimeout = null;
let currentMessagesUnsubscribe = null;

// ============ التحقق من المدير ============
function checkAdmin(email) {
    return email === ADMIN_EMAIL;
}

// ============ مراقبة حالة تسجيل الدخول ============
onAuthStateChanged(auth, async (user) => {
    console.log("📌 Auth state changed:", user ? user.email : "No user");
    
    if (user) {
        currentUser = user;
        isAdmin = checkAdmin(user.email);
        
        try {
            // حفظ المستخدم في Firestore
            const userRef = doc(firestore, 'users', user.uid);
            const userSnap = await getDoc(userRef);
            
            if (!userSnap.exists()) {
                const username = user.displayName || user.email.split('@')[0];
                await setDoc(userRef, {
                    uid: user.uid,
                    email: user.email,
                    username: username,
                    createdAt: new Date().toISOString(),
                    isAdmin: isAdmin,
                    isBanned: false
                });
                console.log("✅ New user saved to Firestore");
            }
            
            showMainApp();
            loadUsers();
            loadChats();
            loadProfile();
            
        } catch (error) {
            console.error("❌ Error loading user data:", error);
        }
        
    } else {
        showAuthScreen();
    }
});

// ============ عرض الشاشات ============
function showAuthScreen() {
    if (authContainer) authContainer.style.display = 'flex';
    if (appContainer) appContainer.style.display = 'none';
    currentUser = null;
    isAdmin = false;
}

function showMainApp() {
    if (authContainer) authContainer.style.display = 'none';
    if (appContainer) appContainer.style.display = 'block';
}

// ============ تبديل وضع تسجيل الدخول/التسجيل ============
if (toggleAuth) {
    toggleAuth.addEventListener('click', () => {
        isLoginMode = !isLoginMode;
        
        if (isLoginMode) {
            submitBtn.textContent = 'تسجيل دخول';
            toggleAuth.textContent = 'ليس لديك حساب؟ إنشاء حساب';
            if (usernameGroup) usernameGroup.style.display = 'none';
        } else {
            submitBtn.textContent = 'إنشاء حساب';
            toggleAuth.textContent = 'لديك حساب؟ سجل دخول';
            if (usernameGroup) usernameGroup.style.display = 'block';
        }
    });
}

// ============ معالج التسجيل والدخول ============
if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const username = usernameInput ? usernameInput.value.trim() : '';
        
        if (!email || !password) {
            alert('يرجى إدخال البريد الإلكتروني وكلمة المرور');
            return;
        }
        
        try {
            if (isLoginMode) {
                // تسجيل الدخول
                console.log("🔐 Logging in...");
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                console.log("✅ Login successful:", userCredential.user.email);
            } else {
                // إنشاء حساب جديد
                if (!username) {
                    alert('يرجى إدخال اسم المستخدم');
                    return;
                }
                if (password.length < 6) {
                    alert('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
                    return;
                }
                
                console.log("📝 Creating account...");
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(userCredential.user, { displayName: username });
                console.log("✅ Account created:", userCredential.user.email);
            }
        } catch (error) {
            console.error("❌ Auth error:", error);
            let errorMessage = 'حدث خطأ، يرجى المحاولة مرة أخرى';
            
            switch (error.code) {
                case 'auth/email-already-in-use':
                    errorMessage = 'البريد الإلكتروني مستخدم بالفعل';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'البريد الإلكتروني غير صحيح';
                    break;
                case 'auth/weak-password':
                    errorMessage = 'كلمة المرور ضعيفة (6 أحرف على الأقل)';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'كلمة المرور غير صحيحة';
                    break;
                case 'auth/user-not-found':
                    errorMessage = 'المستخدم غير موجود';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'محاولات كثيرة، يرجى المحاولة لاحقاً';
                    break;
            }
            alert(errorMessage);
        }
    });
}

// ============ رفع الصور إلى Cloudinary ============
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
        .then(data => {
            if (data.secure_url) {
                resolve({ url: data.secure_url, public_id: data.public_id });
            } else {
                reject(new Error('Upload failed'));
            }
        })
        .catch(reject);
    });
}

// ============ رفع الصورة ============
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
            } catch (error) {
                console.error("Upload error:", error);
                alert('فشل رفع الصورة');
            } finally {
                imageUploadBtn.disabled = false;
                imageUploadBtn.innerHTML = '<i class="fas fa-image"></i>';
            }
        };
        input.click();
    });
}

// ============ تسجيل الصوت ============
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
                
                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) audioChunks.push(event.data);
                };
                
                mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    const file = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
                    
                    recordAudioBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                    try {
                        const result = await uploadToCloudinary(file, 'video');
                        await sendMessage('🎤 رسالة صوتية', result.url, 'audio');
                    } catch (error) {
                        console.error("Audio upload error:", error);
                        alert('فشل رفع التسجيل');
                    } finally {
                        recordAudioBtn.innerHTML = '<i class="fas fa-microphone"></i>';
                    }
                    stream.getTracks().forEach(track => track.stop());
                };
                
                mediaRecorder.start();
                recordAudioBtn.classList.add('recording-btn');
                recordAudioBtn.innerHTML = '<i class="fas fa-stop"></i>';
                isRecording = true;
                
                // Auto-stop after 30 seconds
                setTimeout(() => {
                    if (mediaRecorder && mediaRecorder.state === 'recording') {
                        mediaRecorder.stop();
                        recordAudioBtn.classList.remove('recording-btn');
                        recordAudioBtn.innerHTML = '<i class="fas fa-microphone"></i>';
                        isRecording = false;
                    }
                }, 30000);
                
            } catch (error) {
                console.error("Microphone error:", error);
                alert('لا يمكن الوصول إلى الميكروفون');
            }
        }
    });
}

// ============ إرسال رسالة ============
async function sendMessage(text, fileUrl = null, fileType = null) {
    if (!currentChatUser || (!text && !fileUrl)) return;
    
    const chatId = getChatId(currentUser.uid, currentChatUser.uid);
    
    try {
        // تحديث أو إنشاء المحادثة
        const chatRef = doc(firestore, 'chats', chatId);
        const chatSnap = await getDoc(chatRef);
        
        const lastMessage = text || (fileType === 'image' ? '📷 صورة' : '🎤 رسالة صوتية');
        
        if (!chatSnap.exists()) {
            await setDoc(chatRef, {
                participants: [currentUser.uid, currentChatUser.uid],
                createdAt: new Date().toISOString(),
                lastMessage: lastMessage,
                lastMessageTime: new Date().toISOString()
            });
        } else {
            await updateDoc(chatRef, {
                lastMessage: lastMessage,
                lastMessageTime: new Date().toISOString()
            });
        }
        
        // إضافة الرسالة
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
        
    } catch (error) {
        console.error("Send message error:", error);
        alert('فشل إرسال الرسالة');
    }
}

// ============ تحميل الرسائل ============
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
            if (msg.fileUrl && msg.fileType === 'image') {
                content += `<img src="${msg.fileUrl}" class="message-image" onclick="window.open('${msg.fileUrl}')" />`;
            }
            if (msg.fileUrl && msg.fileType === 'audio') {
                content += `<div class="message-audio"><audio controls src="${msg.fileUrl}"></audio></div>`;
            }
            
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

// ============ تحميل المستخدمين ============
async function loadUsers() {
    try {
        const q = fsQuery(collection(firestore, 'users'), where('isBanned', '==', false));
        const snapshot = await getDocs(q);
        usersCache.clear();
        
        let html = '';
        snapshot.forEach(doc => {
            const user = doc.data();
            if (user.uid !== currentUser?.uid) {
                usersCache.set(user.uid, user);
                html += `
                    <div class="chat-item" onclick="window.startChat('${user.uid}', '${escapeHtml(user.username)}')">
                        <div class="chat-avatar">${escapeHtml(user.username.charAt(0).toUpperCase())}</div>
                        <div class="chat-info">
                            <div class="chat-name">${escapeHtml(user.username)}</div>
                        </div>
                    </div>
                `;
            }
        });
        
        if (usersList) {
            usersList.innerHTML = html || '<div style="padding:20px;text-align:center;">لا يوجد مستخدمين</div>';
        }
    } catch (error) {
        console.error("Load users error:", error);
    }
}

// ============ تحميل المحادثات ============
async function loadChats() {
    if (!currentUser) return;
    
    try {
        const q = fsQuery(collection(firestore, 'chats'), where('participants', 'array-contains', currentUser.uid));
        const snapshot = await getDocs(q);
        
        let html = '';
        for (const doc of snapshot.docs) {
            const chat = doc.data();
            const otherId = chat.participants.find(id => id !== currentUser.uid);
            const other = await getUserById(otherId);
            
            if (other && !other.isBanned) {
                html += `
                    <div class="chat-item" onclick="window.startChat('${other.uid}', '${escapeHtml(other.username)}')">
                        <div class="chat-avatar">${escapeHtml(other.username.charAt(0).toUpperCase())}</div>
                        <div class="chat-info">
                            <div class="chat-name">${escapeHtml(other.username)}</div>
                            <div class="chat-lastmsg">${escapeHtml((chat.lastMessage || '').substring(0, 30))}</div>
                        </div>
                    </div>
                `;
            }
        }
        
        if (chatsList) {
            chatsList.innerHTML = html || '<div style="padding:20px;text-align:center;">لا يوجد محادثات</div>';
        }
    } catch (error) {
        console.error("Load chats error:", error);
    }
}

// ============ الحصول على مستخدم بواسطة ID ============
async function getUserById(uid) {
    if (usersCache.has(uid)) return usersCache.get(uid);
    
    try {
        const snap = await getDoc(doc(firestore, 'users', uid));
        if (snap.exists()) {
            const user = snap.data();
            usersCache.set(uid, user);
            return user;
        }
    } catch (error) {
        console.error("Get user error:", error);
    }
    return null;
}

// ============ تحميل الملف الشخصي ============
async function loadProfile() {
    if (!currentUser) return;
    
    try {
        const userSnap = await getDoc(doc(firestore, 'users', currentUser.uid));
        const userData = userSnap.exists() ? userSnap.data() : { username: currentUser.email.split('@')[0] };
        
        let html = `
            <div class="admin-stat">
                <i class="fas fa-user-circle" style="font-size:60px;"></i>
                <h3>${escapeHtml(userData.username)}</h3>
                <p>${escapeHtml(currentUser.email)}</p>
            </div>
            <div class="admin-panel">
                <div style="padding:20px;">
                    <button class="btn btn-danger" id="logoutBtn" style="width:100%;">تسجيل الخروج</button>
                </div>
            </div>
        `;
        
        // لوحة تحكم المدير
        if (isAdmin) {
            const usersSnap = await getDocs(collection(firestore, 'users'));
            let adminHtml = `
                <div class="admin-panel">
                    <div style="padding:20px;background:linear-gradient(135deg,#f56565,#ed64a6);color:white;">
                        <h3>👑 لوحة التحكم</h3>
                        <p>رمز التحقق: ${ADMIN_CODE}</p>
                    </div>
                    <div>
            `;
            
            usersSnap.forEach(doc => {
                const u = doc.data();
                if (u.uid !== currentUser.uid) {
                    adminHtml += `
                        <div class="user-list-item">
                            <div>
                                <strong>${escapeHtml(u.username)}</strong><br>
                                <small>${escapeHtml(u.email)}</small>
                                ${u.isBanned ? ' <span style="color:red;">(محظور)</span>' : ''}
                            </div>
                            <div>
                                <button class="ban-user-btn" onclick="window.toggleBanUser('${u.uid}', ${!u.isBanned})">
                                    ${u.isBanned ? 'إلغاء الحظر' : 'حظر'}
                                </button>
                                <button class="delete-user-btn" onclick="window.deleteUser('${u.uid}')">
                                    حذف
                                </button>
                            </div>
                        </div>
                    `;
                }
            });
            
            adminHtml += '</div></div>';
            html += adminHtml;
        }
        
        if (profileContent) profileContent.innerHTML = html;
        
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                await signOut(auth);
                showAuthScreen();
            });
        }
        
    } catch (error) {
        console.error("Load profile error:", error);
    }
}

// ============ بدء محادثة ============
window.startChat = async (uid, username) => {
    currentChatUser = { uid, username };
    if (chatUserName) chatUserName.textContent = username;
    if (chatArea) chatArea.style.display = 'block';
    await loadMessages(currentChatUser);
    listenTyping();
};

// ============ مؤشر الكتابة ============
function listenTyping() {
    if (!currentChatUser || !currentUser) return;
    
    const typingRef = ref(database, `typing/${getChatId(currentUser.uid, currentChatUser.uid)}/${currentChatUser.uid}`);
    onValue(typingRef, (snapshot) => {
        if (typingIndicator) {
            if (snapshot.exists()) {
                typingIndicator.style.display = 'block';
                typingIndicator.textContent = `${currentChatUser.username} يكتب...`;
                setTimeout(() => {
                    if (typingIndicator) typingIndicator.style.display = 'none';
                }, 3000);
            } else {
                typingIndicator.style.display = 'none';
            }
        }
    });
}

function sendTypingStatus(isTyping) {
    if (currentChatUser && currentUser) {
        const typingRef = ref(database, `typing/${getChatId(currentUser.uid, currentChatUser.uid)}/${currentUser.uid}`);
        if (isTyping) {
            set(typingRef, true);
            setTimeout(() => remove(typingRef), 3000);
        } else {
            remove(typingRef);
        }
    }
}

// ============ إرسال رسالة ============
if (sendMessageBtn) {
    sendMessageBtn.addEventListener('click', async () => {
        const text = messageInput?.value.trim();
        if (text) await sendMessage(text);
        if (messageInput) messageInput.value = '';
    });
}

if (messageInput) {
    messageInput.addEventListener('input', () => {
        sendTypingStatus(true);
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => sendTypingStatus(false), 2000);
    });
    
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessageBtn.click();
    });
}

// ============ إغلاق المحادثة ============
if (closeChat) {
    closeChat.addEventListener('click', () => {
        if (chatArea) chatArea.style.display = 'none';
        currentChatUser = null;
    });
}

// ============ التنقل بين الصفحات ============
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        
        const page = item.dataset.page;
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const pageElement = document.getElementById(`${page}Page`);
        if (pageElement) pageElement.classList.add('active');
        
        if (page === 'chats') loadChats();
        if (page === 'users') loadUsers();
        if (page === 'profile') loadProfile();
    });
});

// ============ وظائف المدير ============
window.toggleBanUser = async (uid, banned) => {
    if (!isAdmin) return;
    try {
        await updateDoc(doc(firestore, 'users', uid), { isBanned: !banned });
        alert(banned ? 'تم حظر المستخدم' : 'تم إلغاء حظر المستخدم');
        loadProfile();
        loadUsers();
        loadChats();
    } catch (error) {
        console.error("Ban error:", error);
        alert('فشل تغيير حالة المستخدم');
    }
};

window.deleteUser = async (uid) => {
    if (!isAdmin) return;
    if (confirm('هل أنت متأكد من حذف هذا المستخدم نهائياً؟')) {
        try {
            await deleteDoc(doc(firestore, 'users', uid));
            alert('تم حذف المستخدم');
            loadProfile();
            loadUsers();
            loadChats();
        } catch (error) {
            console.error("Delete error:", error);
            alert('فشل حذف المستخدم');
        }
    }
};

// ============ دوال مساعدة ============
function getChatId(a, b) {
    return [a, b].sort().join('_');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============ مكالمات صوتية (مبسطة) ============
if (voiceCallBtn) {
    voiceCallBtn.addEventListener('click', () => {
        if (currentChatUser) {
            alert(`جاري الاتصال بـ ${currentChatUser.username}...\n(ميزة الصوت قيد التطوير)`);
        }
    });
}

console.log("✅ TAGRAME - Ready!");
