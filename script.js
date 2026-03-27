import { 
    auth, database, firestore,
    ref, set, get, push, onValue, update, remove, query, orderByChild, equalTo,
    createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged,
    doc, setDoc, getDoc, collection, addDoc, fsQuery, where, getDocs, updateDoc, deleteDoc, onSnapshot,
    ADMIN_EMAIL, ADMIN_CODE
} from './firebase-config.js';

// Global variables
let currentUser = null;
let currentChatUser = null;
let isAdmin = false;
let usersCache = new Map();
let messagesUnsubscribe = null;

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

let isLoginMode = true;

// Check if user is admin
function checkAdmin(email) {
    return email === ADMIN_EMAIL;
}

// Initialize auth state
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        isAdmin = checkAdmin(user.email);
        
        // Save user to Firestore if new
        const userRef = doc(firestore, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
            await setDoc(userRef, {
                uid: user.uid,
                email: user.email,
                username: user.displayName || user.email.split('@')[0],
                createdAt: new Date().toISOString(),
                isAdmin: isAdmin,
                isBanned: false
            });
        } else {
            // Update admin status if needed
            if (isAdmin && !userSnap.data().isAdmin) {
                await updateDoc(userRef, { isAdmin: true });
            }
        }
        
        // Load user data
        const userData = userSnap.exists() ? userSnap.data() : {
            uid: user.uid,
            email: user.email,
            username: user.email.split('@')[0]
        };
        
        showMainApp();
        loadUsers();
        loadChats();
        loadProfile();
        
        // Setup real-time listeners
        setupRealtimeListeners();
        
    } else {
        showAuthScreen();
    }
});

// Setup real-time listeners for messages
function setupRealtimeListeners() {
    if (messagesUnsubscribe) messagesUnsubscribe();
    
    const chatsQuery = fsQuery(
        collection(firestore, 'chats'),
        where('participants', 'array-contains', currentUser.uid)
    );
    
    messagesUnsubscribe = onSnapshot(chatsQuery, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'modified' || change.type === 'added') {
                loadChats();
                if (currentChatUser && change.doc.data().participants.includes(currentChatUser.uid)) {
                    loadMessages(currentChatUser);
                }
            }
        });
    });
}

// Show auth screen
function showAuthScreen() {
    authContainer.style.display = 'flex';
    appContainer.style.display = 'none';
    currentUser = null;
    isAdmin = false;
}

// Show main app
function showMainApp() {
    authContainer.style.display = 'none';
    appContainer.style.display = 'block';
}

// Toggle between login and signup
toggleAuth.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    if (isLoginMode) {
        submitBtn.textContent = 'تسجيل دخول';
        toggleAuth.textContent = 'ليس لديك حساب؟ إنشاء حساب';
        usernameInput.style.display = 'none';
    } else {
        submitBtn.textContent = 'إنشاء حساب';
        toggleAuth.textContent = 'لديك حساب؟ سجل دخول';
        usernameInput.style.display = 'block';
    }
});

// Handle auth submit
submitBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const username = usernameInput.value.trim();
    
    if (!email || !password) {
        alert('يرجى إدخال البريد الإلكتروني وكلمة المرور');
        return;
    }
    
    try {
        if (isLoginMode) {
            // Login
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            console.log('تم تسجيل الدخول:', userCredential.user.email);
        } else {
            // Signup
            if (!username) {
                alert('يرجى إدخال اسم المستخدم');
                return;
            }
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(userCredential.user, { displayName: username });
            console.log('تم إنشاء الحساب:', userCredential.user.email);
        }
    } catch (error) {
        console.error('Auth error:', error);
        alert(getErrorMessage(error.code));
    }
});

// Get error message
function getErrorMessage(code) {
    const messages = {
        'auth/email-already-in-use': 'البريد الإلكتروني مستخدم بالفعل',
        'auth/invalid-email': 'البريد الإلكتروني غير صحيح',
        'auth/weak-password': 'كلمة المرور ضعيفة (6 أحرف على الأقل)',
        'auth/wrong-password': 'كلمة المرور غير صحيحة',
        'auth/user-not-found': 'المستخدم غير موجود'
    };
    return messages[code] || 'حدث خطأ، يرجى المحاولة مرة أخرى';
}

// Load all users
async function loadUsers() {
    const usersQuery = fsQuery(
        collection(firestore, 'users'),
        where('isBanned', '==', false)
    );
    
    const snapshot = await getDocs(usersQuery);
    usersCache.clear();
    
    let usersHTML = '';
    snapshot.forEach(doc => {
        const user = doc.data();
        if (user.uid !== currentUser.uid) {
            usersCache.set(user.uid, user);
            usersHTML += `
                <div class="chat-item" onclick="window.startChat('${user.uid}', '${user.username}')">
                    <div class="chat-avatar">${user.username.charAt(0).toUpperCase()}</div>
                    <div class="chat-info">
                        <div class="chat-name">${user.username}</div>
                        <div class="chat-lastmsg">${user.email}</div>
                    </div>
                </div>
            `;
        }
    });
    
    usersList.innerHTML = usersHTML || '<div style="padding: 20px; text-align: center;">لا يوجد مستخدمين</div>';
}

// Load chats
async function loadChats() {
    const chatsQuery = fsQuery(
        collection(firestore, 'chats'),
        where('participants', 'array-contains', currentUser.uid)
    );
    
    const snapshot = await getDocs(chatsQuery);
    let chatsHTML = '';
    
    for (const doc of snapshot.docs) {
        const chat = doc.data();
        const otherUserId = chat.participants.find(id => id !== currentUser.uid);
        const otherUser = await getUserById(otherUserId);
        
        if (otherUser && !otherUser.isBanned) {
            const lastMessage = chat.lastMessage || '';
            const lastMessageTime = chat.lastMessageTime ? new Date(chat.lastMessageTime).toLocaleTimeString() : '';
            
            chatsHTML += `
                <div class="chat-item" onclick="window.startChat('${otherUserId}', '${otherUser.username}')">
                    <div class="chat-avatar">${otherUser.username.charAt(0).toUpperCase()}</div>
                    <div class="chat-info">
                        <div class="chat-name">${otherUser.username}</div>
                        <div class="chat-lastmsg">${lastMessage.substring(0, 30)}</div>
                    </div>
                    <div class="chat-time">${lastMessageTime}</div>
                </div>
            `;
        }
    }
    
    chatsList.innerHTML = chatsHTML || '<div style="padding: 20px; text-align: center;">لا يوجد محادثات</div>';
}

// Get user by ID
async function getUserById(userId) {
    if (usersCache.has(userId)) return usersCache.get(userId);
    
    const userRef = doc(firestore, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
        const user = userSnap.data();
        usersCache.set(userId, user);
        return user;
    }
    return null;
}

// Load profile
async function loadProfile() {
    const userRef = doc(firestore, 'users', currentUser.uid);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.exists() ? userSnap.data() : { username: currentUser.email.split('@')[0] };
    
    let profileHTML = `
        <div class="admin-stat">
            <i class="fas fa-user-circle" style="font-size: 60px; margin-bottom: 10px;"></i>
            <h3>${userData.username}</h3>
            <p>${currentUser.email}</p>
        </div>
        <div class="admin-panel" style="margin-top: 20px;">
            <div style="padding: 20px;">
                <div style="margin-bottom: 15px;">
                    <strong>تاريخ الانضمام:</strong> ${new Date(userData.createdAt).toLocaleDateString('ar-EG')}
                </div>
                <button class="btn btn-danger" id="logoutBtn" style="margin-top: 20px;">تسجيل الخروج</button>
            </div>
        </div>
    `;
    
    // Admin panel
    if (isAdmin) {
        const usersQuery = collection(firestore, 'users');
        const snapshot = await getDocs(usersQuery);
        
        let usersAdminHTML = '<div class="admin-panel" style="margin-top: 20px;"><div style="padding: 20px; background: linear-gradient(135deg, #f56565 0%, #ed64a6 100%); color: white;"><h3>لوحة التحكم - مدير النظام</h3></div><div>';
        
        snapshot.forEach(doc => {
            const user = doc.data();
            if (user.uid !== currentUser.uid) {
                usersAdminHTML += `
                    <div class="user-list-item">
                        <div>
                            <strong>${user.username}</strong><br>
                            <small>${user.email}</small>
                        </div>
                        <div>
                            <button class="ban-user-btn" onclick="window.toggleBanUser('${user.uid}', ${!user.isBanned})">
                                ${user.isBanned ? 'إلغاء الحظر' : 'حظر'}
                            </button>
                            <button class="delete-user-btn" onclick="window.deleteUser('${user.uid}')">
                                حذف
                            </button>
                        </div>
                    </div>
                `;
            }
        });
        
        usersAdminHTML += '</div></div>';
        profileHTML += usersAdminHTML;
    }
    
    profileContent.innerHTML = profileHTML;
    
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        await signOut(auth);
        showAuthScreen();
    });
}

// Start chat with user
window.startChat = async (userId, username) => {
    currentChatUser = { uid: userId, username };
    chatUserName.textContent = username;
    chatArea.style.display = 'block';
    await loadMessages(currentChatUser);
};

// Load messages
async function loadMessages(user) {
    const chatId = getChatId(currentUser.uid, user.uid);
    const messagesRef = collection(firestore, 'chats', chatId, 'messages');
    const messagesQuery = fsQuery(messagesRef, orderByChild('timestamp'));
    
    messagesContainer.innerHTML = '<div style="text-align: center; padding: 20px;">جاري التحميل...</div>';
    
    onSnapshot(messagesQuery, (snapshot) => {
        let messagesHTML = '';
        snapshot.forEach(doc => {
            const msg = doc.data();
            const isOwn = msg.senderId === currentUser.uid;
            messagesHTML += `
                <div class="message ${isOwn ? 'own' : ''}">
                    <div class="message-bubble">
                        <div class="message-text">${escapeHtml(msg.text)}</div>
                        <div class="message-time">${new Date(msg.timestamp).toLocaleTimeString()}</div>
                    </div>
                </div>
            `;
        });
        
        messagesContainer.innerHTML = messagesHTML || '<div style="text-align: center; padding: 20px;">لا توجد رسائل</div>';
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
}

// Send message
sendMessageBtn.addEventListener('click', async () => {
    if (!currentChatUser || !messageInput.value.trim()) return;
    
    const text = messageInput.value.trim();
    const chatId = getChatId(currentUser.uid, currentChatUser.uid);
    
    // Create chat document if not exists
    const chatRef = doc(firestore, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);
    
    if (!chatSnap.exists()) {
        await setDoc(chatRef, {
            participants: [currentUser.uid, currentChatUser.uid],
            createdAt: new Date().toISOString(),
            lastMessage: text,
            lastMessageTime: new Date().toISOString()
        });
    } else {
        await updateDoc(chatRef, {
            lastMessage: text,
            lastMessageTime: new Date().toISOString()
        });
    }
    
    // Add message
    const messagesRef = collection(firestore, 'chats', chatId, 'messages');
    await addDoc(messagesRef, {
        senderId: currentUser.uid,
        text: text,
        timestamp: new Date().toISOString(),
        read: false
    });
    
    messageInput.value = '';
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Send typing stopped
    clearTyping();
});

// Typing indicator
let typingTimeout;
messageInput.addEventListener('input', () => {
    if (currentChatUser) {
        sendTypingStatus(true);
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => sendTypingStatus(false), 2000);
    }
});

function sendTypingStatus(isTyping) {
    if (currentChatUser) {
        const typingRef = ref(database, `typing/${getChatId(currentUser.uid, currentChatUser.uid)}/${currentUser.uid}`);
        if (isTyping) {
            set(typingRef, true);
            setTimeout(() => remove(typingRef), 3000);
        } else {
            remove(typingRef);
        }
    }
}

// Listen for typing status
function listenTyping() {
    if (currentChatUser) {
        const typingRef = ref(database, `typing/${getChatId(currentUser.uid, currentChatUser.uid)}/${currentChatUser.uid}`);
        onValue(typingRef, (snapshot) => {
            if (snapshot.exists()) {
                typingIndicator.style.display = 'block';
                typingIndicator.textContent = `${currentChatUser.username} يكتب...`;
                setTimeout(() => typingIndicator.style.display = 'none', 3000);
            } else {
                typingIndicator.style.display = 'none';
            }
        });
    }
}

function clearTyping() {
    if (currentChatUser) {
        const typingRef = ref(database, `typing/${getChatId(currentUser.uid, currentChatUser.uid)}/${currentUser.uid}`);
        remove(typingRef);
    }
}

// Close chat
closeChat.addEventListener('click', () => {
    chatArea.style.display = 'none';
    currentChatUser = null;
    clearTyping();
});

// Navigation
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        const page = item.dataset.page;
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`${page}Page`).classList.add('active');
        
        if (page === 'chats') loadChats();
        if (page === 'users') loadUsers();
        if (page === 'profile') loadProfile();
    });
});

// Admin functions
window.toggleBanUser = async (userId, isBanned) => {
    if (!isAdmin) return;
    const userRef = doc(firestore, 'users', userId);
    await updateDoc(userRef, { isBanned: !isBanned });
    alert(isBanned ? 'تم حظر المستخدم' : 'تم إلغاء حظر المستخدم');
    loadProfile();
    loadUsers();
    loadChats();
};

window.deleteUser = async (userId) => {
    if (!isAdmin) return;
    if (confirm('هل أنت متأكد من حذف هذا المستخدم نهائياً؟')) {
        const userRef = doc(firestore, 'users', userId);
        await deleteDoc(userRef);
        alert('تم حذف المستخدم');
        loadProfile();
        loadUsers();
        loadChats();
    }
};

// Helper functions
function getChatId(userId1, userId2) {
    return [userId1, userId2].sort().join('_');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Enter key to send
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessageBtn.click();
});

// Start with login mode
usernameInput.style.display = 'none';
