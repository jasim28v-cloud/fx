// ============================================
// TELGRAMI - MAIN APPLICATION
// جميع الكلاسات والدوال مدمجة في ملف واحد
// ============================================

// ==================== CHAT MANAGER ====================
class ChatManager {
    constructor() {
        this.currentChat = null;
        this.messageListeners = [];
        this.typingListeners = [];
    }

    async createPrivateChat(userId, targetUserId) {
        const existingChat = await this.findPrivateChat(userId, targetUserId);
        if (existingChat) return existingChat;

        const chatId = generateId();
        const chatData = {
            type: 'private',
            participants: [userId, targetUserId],
            createdAt: new Date().toISOString(),
            lastMessage: null
        };
        
        await db.ref(`chats/${chatId}`).set(chatData);
        await db.ref(`userChats/${userId}/${chatId}`).set(true);
        await db.ref(`userChats/${targetUserId}/${chatId}`).set(true);
        
        return { id: chatId, ...chatData };
    }
    
    async findPrivateChat(userId, targetUserId) {
        const userChats = await db.ref(`userChats/${userId}`).once('value');
        if (!userChats.exists()) return null;
        
        const chats = userChats.val();
        for (const chatId in chats) {
            const chat = await db.ref(`chats/${chatId}`).once('value');
            if (chat.exists() && chat.val().type === 'private') {
                const participants = chat.val().participants;
                if (participants.includes(userId) && participants.includes(targetUserId)) {
                    return { id: chatId, ...chat.val() };
                }
            }
        }
        return null;
    }
    
    async createGroup(name, creatorId, participants = [], avatar = null) {
        const groupId = generateId();
        const groupData = {
            type: 'group',
            name: name,
            avatar: avatar,
            participants: [creatorId, ...participants],
            admins: [creatorId],
            createdBy: creatorId,
            createdAt: new Date().toISOString(),
            lastMessage: null
        };
        
        await db.ref(`chats/${groupId}`).set(groupData);
        
        for (const participant of [creatorId, ...participants]) {
            await db.ref(`userChats/${participant}/${groupId}`).set(true);
        }
        
        return { id: groupId, ...groupData };
    }
    
    async sendMessage(chatId, senderId, text, type = 'text', mediaUrl = null, replyTo = null) {
        const messageId = generateId();
        const timestamp = new Date().toISOString();
        
        const messageData = {
            senderId: senderId,
            text: text,
            type: type,
            mediaUrl: mediaUrl,
            replyTo: replyTo,
            edited: false,
            deleted: false,
            seen: [senderId],
            timestamp: timestamp
        };
        
        await db.ref(`messages/${chatId}/${messageId}`).set(messageData);
        
        await db.ref(`chats/${chatId}/lastMessage`).set({
            text: text.length > 50 ? text.substring(0, 50) + '...' : text,
            senderId: senderId,
            timestamp: timestamp
        });
        
        await db.ref(`users/${senderId}/lastSeen`).set(timestamp);
        
        return messageId;
    }
    
    loadMessages(chatId, callback) {
        const messagesRef = db.ref(`messages/${chatId}`).orderByChild('timestamp');
        
        const listener = messagesRef.on('value', (snapshot) => {
            const messages = [];
            if (snapshot.exists()) {
                snapshot.forEach((child) => {
                    messages.push({ id: child.key, ...child.val() });
                });
            }
            callback(messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
        });
        
        this.messageListeners.push({ chatId, listener });
        return () => messagesRef.off('value', listener);
    }
    
    async editMessage(chatId, messageId, newText) {
        await db.ref(`messages/${chatId}/${messageId}`).update({
            text: newText,
            edited: true,
            editedAt: new Date().toISOString()
        });
    }
    
    async deleteMessage(chatId, messageId) {
        await db.ref(`messages/${chatId}/${messageId}`).update({
            deleted: true,
            text: 'تم حذف هذه الرسالة'
        });
    }
    
    setTyping(chatId, userId, isTyping) {
        const typingRef = db.ref(`typing/${chatId}/${userId}`);
        if (isTyping) {
            typingRef.set({
                isTyping: true,
                timestamp: new Date().toISOString()
            });
            setTimeout(() => typingRef.remove(), 3000);
        } else {
            typingRef.remove();
        }
    }
    
    onTyping(chatId, callback) {
        const typingRef = db.ref(`typing/${chatId}`);
        const listener = typingRef.on('value', (snapshot) => {
            const typingUsers = [];
            if (snapshot.exists()) {
                snapshot.forEach((child) => {
                    if (child.val().isTyping) typingUsers.push(child.key);
                });
            }
            callback(typingUsers);
        });
        
        this.typingListeners.push({ chatId, listener });
        return () => typingRef.off('value', listener);
    }
    
    cleanup() {
        for (const { chatId, listener } of this.messageListeners) {
            db.ref(`messages/${chatId}`).off('value', listener);
        }
        for (const { chatId, listener } of this.typingListeners) {
            db.ref(`typing/${chatId}`).off('value', listener);
        }
        this.messageListeners = [];
        this.typingListeners = [];
    }
}

// ==================== STORY MANAGER ====================
class StoryManager {
    constructor() {
        this.storyInterval = null;
    }
    
    async createStory(userId, type, content, mediaUrl = null) {
        const storyId = generateId();
        const createdAt = new Date();
        const expiresAt = new Date(createdAt.getTime() + (24 * 60 * 60 * 1000));
        
        const storyData = {
            userId: userId,
            type: type,
            content: content,
            mediaUrl: mediaUrl,
            createdAt: createdAt.toISOString(),
            expiresAt: expiresAt.toISOString(),
            viewers: []
        };
        
        await db.ref(`stories/${storyId}`).set(storyData);
        await db.ref(`userStories/${userId}/${storyId}`).set(true);
        
        return storyId;
    }
    
    loadStories(userId, callback) {
        const now = new Date().toISOString();
        const storiesRef = db.ref('stories').orderByChild('expiresAt').startAt(now);
        
        const listener = storiesRef.on('value', (snapshot) => {
            const stories = [];
            if (snapshot.exists()) {
                snapshot.forEach((child) => {
                    const story = child.val();
                    if (story.userId !== userId) {
                        stories.push({
                            id: child.key,
                            ...story,
                            viewed: story.viewers?.includes(userId) || false
                        });
                    }
                });
            }
            callback(this.groupStoriesByUser(stories));
        });
        
        return () => storiesRef.off('value', listener);
    }
    
    groupStoriesByUser(stories) {
        const groups = {};
        for (const story of stories) {
            if (!groups[story.userId]) {
                groups[story.userId] = { userId: story.userId, stories: [] };
            }
            groups[story.userId].stories.push(story);
        }
        return Object.values(groups);
    }
    
    async viewStory(storyId, userId) {
        const storyRef = db.ref(`stories/${storyId}/viewers`);
        await storyRef.transaction((currentViewers) => {
            if (currentViewers && currentViewers.includes(userId)) return currentViewers;
            return currentViewers ? [...currentViewers, userId] : [userId];
        });
    }
    
    startCleanupJob() {
        if (this.storyInterval) clearInterval(this.storyInterval);
        this.storyInterval = setInterval(async () => {
            const now = new Date().toISOString();
            const expiredStories = await db.ref('stories').orderByChild('expiresAt').endAt(now).once('value');
            if (expiredStories.exists()) {
                const updates = {};
                expiredStories.forEach((story) => {
                    updates[`stories/${story.key}`] = null;
                    updates[`userStories/${story.val().userId}/${story.key}`] = null;
                });
                await db.ref().update(updates);
            }
        }, 60 * 60 * 1000);
    }
    
    cleanup() {
        if (this.storyInterval) clearInterval(this.storyInterval);
    }
}

// ==================== CALL MANAGER ====================
class CallManager {
    constructor() {
        this.localStream = null;
        this.peerConnection = null;
        this.currentCall = null;
        this.configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
    }
    
    async startCall(callerId, receiverId, type = 'voice') {
        const callId = generateId();
        const callData = {
            type: type,
            callerId: callerId,
            receiverId: receiverId,
            status: 'initiating',
            startedAt: new Date().toISOString(),
            duration: 0
        };
        
        await db.ref(`calls/${callId}`).set(callData);
        await db.ref(`userCalls/${callerId}/${callId}`).set(true);
        await db.ref(`userCalls/${receiverId}/${callId}`).set(true);
        
        this.currentCall = { id: callId, ...callData };
        
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: type === 'video'
            });
        } catch (error) {
            await this.endCall(callId);
            throw error;
        }
        
        return callId;
    }
    
    async answerCall(callId, userId) {
        const callRef = db.ref(`calls/${callId}`);
        const call = await callRef.once('value');
        if (!call.exists()) return false;
        
        const callData = call.val();
        if (callData.receiverId !== userId) return false;
        
        await callRef.update({ status: 'ongoing', answeredAt: new Date().toISOString() });
        this.currentCall = { id: callId, ...callData };
        
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: callData.type === 'video'
            });
        } catch (error) {
            await this.endCall(callId);
            throw error;
        }
        
        return true;
    }
    
    async endCall(callId) {
        const callRef = db.ref(`calls/${callId}`);
        const call = await callRef.once('value');
        
        if (call.exists()) {
            const callData = call.val();
            const endedAt = new Date();
            const startedAt = new Date(callData.startedAt);
            const duration = Math.floor((endedAt - startedAt) / 1000);
            await callRef.update({ status: 'ended', endedAt: endedAt.toISOString(), duration: duration });
        }
        
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        this.currentCall = null;
    }
    
    onIncomingCall(userId, callback) {
        const callsRef = db.ref('calls').orderByChild('receiverId').equalTo(userId);
        const listener = callsRef.on('child_added', (snapshot) => {
            const call = snapshot.val();
            if (call.status === 'initiating') callback({ id: snapshot.key, ...call });
        });
        return () => callsRef.off('child_added', listener);
    }
    
    onCallStatus(callId, callback) {
        const callRef = db.ref(`calls/${callId}`);
        const listener = callRef.on('value', (snapshot) => {
            if (snapshot.exists()) callback(snapshot.val());
        });
        return () => callRef.off('value', listener);
    }
}

// ==================== تهيئة الكلاسات ====================
const chatManager = new ChatManager();
const storyManager = new StoryManager();
const callManager = new CallManager();

// ==================== متغيرات التطبيق الرئيسية ====================
let currentUser = null;
let isAdmin = false;
let currentChatId = null;
let currentChatType = null;
let activeTab = 'chats';
let messageListener = null;
let typingListener = null;
let storiesListener = null;
let typingTimeout = null;

// ==================== دوال التطبيق الرئيسية ====================

function showAuthScreen() {
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    if (authContainer) authContainer.style.display = 'flex';
    if (appContainer) appContainer.style.display = 'none';
}

function showChatInterface() {
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    if (authContainer) authContainer.style.display = 'none';
    if (appContainer) appContainer.style.display = 'flex';
}

function hideElement(id) {
    const element = document.getElementById(id);
    if (element) element.style.display = 'none';
}

function switchAuthTab(tab) {
    const loginTab = document.getElementById('login-tab');
    const registerTab = document.getElementById('register-tab');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    if (tab === 'login') {
        loginTab?.classList.add('active');
        registerTab?.classList.remove('active');
        if (loginForm) loginForm.style.display = 'block';
        if (registerForm) registerForm.style.display = 'none';
    } else {
        loginTab?.classList.remove('active');
        registerTab?.classList.add('active');
        if (loginForm) loginForm.style.display = 'none';
        if (registerForm) registerForm.style.display = 'block';
    }
}

function toggleMobileMenu() {
    document.getElementById('sidebar')?.classList.toggle('open');
    document.getElementById('chat-area')?.classList.toggle('active');
}

function switchMainTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.nav-tab').forEach(t => {
        t.classList.remove('active');
        if (t.dataset.tab === tab) t.classList.add('active');
    });
    document.getElementById('chats-view')?.classList.toggle('hidden', tab !== 'chats');
    document.getElementById('stories-view')?.classList.toggle('hidden', tab !== 'stories');
    document.getElementById('calls-view')?.classList.toggle('hidden', tab !== 'calls');
}

function searchChats() {
    const query = document.getElementById('search-input')?.value.toLowerCase();
    if (!query) {
        document.querySelectorAll('.chat-item').forEach(item => item.style.display = 'flex');
        return;
    }
    document.querySelectorAll('.chat-item').forEach(item => {
        const name = item.querySelector('.chat-name')?.textContent.toLowerCase();
        item.style.display = (name && name.includes(query)) ? 'flex' : 'none';
    });
}

async function login() {
    const email = document.getElementById('login-email')?.value.trim();
    const password = document.getElementById('login-password')?.value.trim();
    const errorElement = document.getElementById('login-error');
    
    if (!email || !password) {
        if (errorElement) errorElement.textContent = 'يرجى إدخال البريد الإلكتروني وكلمة المرور';
        return;
    }
    if (errorElement) errorElement.textContent = '';
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        if (errorElement) errorElement.textContent = getAuthErrorMessage(error.code);
    }
}

async function register() {
    const name = document.getElementById('register-name')?.value.trim();
    const email = document.getElementById('register-email')?.value.trim();
    const password = document.getElementById('register-password')?.value.trim();
    const confirmPassword = document.getElementById('register-confirm-password')?.value.trim();
    const errorElement = document.getElementById('register-error');
    const successElement = document.getElementById('register-success');
    
    if (!name || !email || !password || !confirmPassword) {
        if (errorElement) errorElement.textContent = 'يرجى ملء جميع الحقول';
        return;
    }
    if (password !== confirmPassword) {
        if (errorElement) errorElement.textContent = 'كلمات المرور غير متطابقة';
        return;
    }
    if (password.length < 6) {
        if (errorElement) errorElement.textContent = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
        return;
    }
    if (errorElement) errorElement.textContent = '';
    if (successElement) successElement.textContent = '';
    
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        await db.ref(`users/${user.uid}`).set({
            name: name,
            email: email,
            avatar: null,
            bio: '',
            lastSeen: new Date().toISOString(),
            status: 'online',
            createdAt: new Date().toISOString(),
            contacts: [],
            blockedUsers: []
        });
        if (successElement) successElement.textContent = 'تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول.';
        switchAuthTab('login');
    } catch (error) {
        if (errorElement) errorElement.textContent = getAuthErrorMessage(error.code);
    }
}

async function checkAdminStatus(email) {
    if (email === 'jasim28v@gmail.com') {
        const adminCode = prompt('أدخل رمز المشرف:');
        isAdmin = adminCode === 'vv2314vv';
    } else {
        const snapshot = await db.ref('users').orderByChild('email').equalTo(email).once('value');
        if (snapshot.exists()) {
            const userData = Object.values(snapshot.val())[0];
            isAdmin = userData.isAdmin || false;
        }
    }
    return isAdmin;
}

async function updateUserStatus(status) {
    if (!currentUser) return;
    await db.ref(`users/${currentUser.uid}/status`).set(status);
    await db.ref(`users/${currentUser.uid}/lastSeen`).set(new Date().toISOString());
}

async function initializeUserData(user) {
    const userRef = db.ref(`users/${user.uid}`);
    const snapshot = await userRef.once('value');
    if (!snapshot.exists()) {
        await userRef.set({
            name: user.email.split('@')[0],
            email: user.email,
            avatar: null,
            bio: '',
            lastSeen: new Date().toISOString(),
            status: 'online',
            createdAt: new Date().toISOString(),
            contacts: [],
            blockedUsers: []
        });
    }
}

function updateUsersStatusUI(users) {
    if (!users) return;
    for (const userId in users) {
        const user = users[userId];
        const statusElement = document.querySelector(`.user-status-${userId}`);
        if (statusElement) {
            statusElement.className = `user-status user-status-${user.status || 'offline'}`;
        }
    }
}

function displayMessages(messages) {
    const container = document.getElementById('messages-container');
    if (!container) return;
    
    const shouldScroll = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    container.innerHTML = '';
    
    let lastDate = null;
    for (const message of messages) {
        if (message.deleted && message.type !== 'deleted') continue;
        
        const messageDate = new Date(message.timestamp).toLocaleDateString('ar-EG');
        if (messageDate !== lastDate) {
            const dateDiv = document.createElement('div');
            dateDiv.className = 'message-date';
            dateDiv.textContent = messageDate;
            container.appendChild(dateDiv);
            lastDate = messageDate;
        }
        
        const isCurrentUser = message.senderId === currentUser.uid;
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isCurrentUser ? 'sent' : 'received'}`;
        
        let messageContent = '';
        if (message.type === 'text') {
            messageContent = `<div class="message-text">${escapeHtml(message.text)}</div>`;
        } else if (message.type === 'image') {
            messageContent = `<img src="${message.mediaUrl}" class="message-image" onclick="openImage('${message.mediaUrl}')">`;
        } else if (message.type === 'video') {
            messageContent = `<video src="${message.mediaUrl}" controls class="message-video"></video>`;
        } else if (message.type === 'file') {
            messageContent = `<a href="${message.mediaUrl}" download class="message-file">📎 تحميل الملف</a>`;
        }
        
        if (message.replyTo) {
            messageDiv.innerHTML = `<div class="message-reply">${escapeHtml(message.replyTo.text)}</div>${messageContent}`;
        } else {
            messageDiv.innerHTML = messageContent;
        }
        
        if (message.edited) messageDiv.innerHTML += `<span class="message-edited">(معدلة)</span>`;
        
        const timeSpan = document.createElement('div');
        timeSpan.className = 'message-time';
        timeSpan.textContent = formatTime(message.timestamp);
        messageDiv.appendChild(timeSpan);
        
        if (isCurrentUser) {
            const seenCount = message.seen?.length || 1;
            const seenIcon = document.createElement('div');
            seenIcon.className = 'message-seen';
            seenIcon.innerHTML = seenCount > 1 ? '<i class="fas fa-check-double"></i>' : '<i class="fas fa-check"></i>';
            messageDiv.appendChild(seenIcon);
        }
        
        container.appendChild(messageDiv);
    }
    
    if (shouldScroll) container.scrollTop = container.scrollHeight;
}

function updateTypingIndicator(typingUsers) {
    const indicator = document.getElementById('typing-indicator');
    if (!indicator) return;
    if (typingUsers.length > 0 && typingUsers[0] !== currentUser.uid) {
        indicator.style.display = 'block';
        indicator.textContent = 'يكتب...';
    } else {
        indicator.style.display = 'none';
    }
}

function handleTyping() {
    if (!currentChatId || !currentUser) return;
    if (typingTimeout) clearTimeout(typingTimeout);
    chatManager.setTyping(currentChatId, currentUser.uid, true);
    typingTimeout = setTimeout(() => chatManager.setTyping(currentChatId, currentUser.uid, false), 3000);
}

async function sendMessage() {
    const input = document.getElementById('message-input');
    const text = input?.value.trim();
    if (!text || !currentChatId || !currentUser) return;
    await chatManager.sendMessage(currentChatId, currentUser.uid, text);
    if (input) {
        input.value = '';
        input.style.height = 'auto';
    }
    chatManager.setTyping(currentChatId, currentUser.uid, false);
}

function addChatToUI(chatId, chat) {
    const chatsList = document.getElementById('chats-list');
    if (!chatsList) return;
    
    let chatName = chat.name;
    let chatAvatar = chat.avatar || chat.name?.charAt(0) || 'G';
    
    if (chat.type === 'private') {
        const otherUserId = chat.participants.find(id => id !== currentUser.uid);
        db.ref(`users/${otherUserId}`).once('value').then(snapshot => {
            if (snapshot.exists()) {
                const user = snapshot.val();
                chatName = user.name;
                chatAvatar = user.avatar || user.name.charAt(0);
                updateChatItemUI();
            }
        });
    }
    
    const lastMessage = chat.lastMessage?.text || 'لا توجد رسائل';
    const lastMessageTime = chat.lastMessage?.timestamp ? formatTime(chat.lastMessage.timestamp) : '';
    
    const chatItem = document.createElement('div');
    chatItem.className = `chat-item ${currentChatId === chatId ? 'active' : ''}`;
    chatItem.dataset.chatId = chatId;
    chatItem.innerHTML = `
        <div class="chat-avatar">${chatAvatar}</div>
        <div class="chat-info">
            <div class="chat-name">${escapeHtml(chatName)}</div>
            <div class="chat-preview">${escapeHtml(lastMessage)}</div>
        </div>
        <div class="chat-time">${lastMessageTime}</div>
    `;
    chatItem.addEventListener('click', () => openChat(chatId, chat));
    chatsList.appendChild(chatItem);
    
    function updateChatItemUI() {
        chatItem.querySelector('.chat-avatar').textContent = chatAvatar;
        chatItem.querySelector('.chat-name').textContent = escapeHtml(chatName);
    }
}

async function loadUserChats() {
    const userChatsRef = db.ref(`userChats/${currentUser.uid}`);
    const snapshot = await userChatsRef.once('value');
    const chatsList = document.getElementById('chats-list');
    if (!chatsList) return;
    
    chatsList.innerHTML = '';
    if (!snapshot.exists()) {
        chatsList.innerHTML = '<div class="empty-state">لا توجد محادثات بعد</div>';
        return;
    }
    
    const chatIds = Object.keys(snapshot.val());
    for (const chatId of chatIds) {
        const chatSnapshot = await db.ref(`chats/${chatId}`).once('value');
        if (chatSnapshot.exists()) addChatToUI(chatId, chatSnapshot.val());
    }
}

function openChat(chatId, chat) {
    if (messageListener) messageListener();
    if (typingListener) typingListener();
    
    currentChatId = chatId;
    currentChatType = chat.type;
    
    let chatName = chat.name;
    let chatAvatar = chat.avatar || chat.name?.charAt(0) || 'G';
    
    if (chat.type === 'private') {
        const otherUserId = chat.participants.find(id => id !== currentUser.uid);
        db.ref(`users/${otherUserId}`).once('value').then(snapshot => {
            if (snapshot.exists()) {
                const user = snapshot.val();
                document.querySelector('.chat-header-name').textContent = user.name;
                document.querySelector('.chat-header-avatar').textContent = user.avatar || user.name.charAt(0);
            }
        });
    } else {
        document.querySelector('.chat-header-name').textContent = chatName;
        document.querySelector('.chat-header-avatar').textContent = chatAvatar;
    }
    
    messageListener = chatManager.loadMessages(chatId, (messages) => displayMessages(messages));
    typingListener = chatManager.onTyping(chatId, (typingUsers) => updateTypingIndicator(typingUsers));
    
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar')?.classList.remove('open');
        document.getElementById('chat-area')?.classList.add('active');
    }
    
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.chatId === chatId) item.classList.add('active');
    });
}

async function createNewChat() {
    const type = prompt('اختر نوع الدردشة:\n1 - محادثة خاصة\n2 - مجموعة');
    if (type === '1') {
        const userEmail = prompt('أدخل البريد الإلكتروني للمستخدم:');
        if (userEmail) {
            const usersSnapshot = await db.ref('users').orderByChild('email').equalTo(userEmail).once('value');
            if (usersSnapshot.exists()) {
                const targetUserId = Object.keys(usersSnapshot.val())[0];
                const chat = await chatManager.findPrivateChat(currentUser.uid, targetUserId);
                if (chat) {
                    openChat(chat.id, chat);
                } else {
                    const newChat = await chatManager.createPrivateChat(currentUser.uid, targetUserId);
                    openChat(newChat.id, newChat);
                }
            } else {
                alert('المستخدم غير موجود');
            }
        }
    } else if (type === '2') {
        const groupName = prompt('أدخل اسم المجموعة:');
        if (groupName) {
            const newChat = await chatManager.createGroup(groupName, currentUser.uid, []);
            openChat(newChat.id, newChat);
        }
    }
}

function displayStories(storiesGroups) {
    const storiesContainer = document.getElementById('stories-container');
    if (!storiesContainer) return;
    storiesContainer.innerHTML = '';
    
    const userStoryItem = document.createElement('div');
    userStoryItem.className = 'story-item my-story';
    userStoryItem.innerHTML = `<div class="story-avatar"><i class="fas fa-plus"></i></div><div class="story-name">قصتي</div>`;
    userStoryItem.addEventListener('click', showStoryCreator);
    storiesContainer.appendChild(userStoryItem);
    
    for (const group of storiesGroups) {
        const storyItem = document.createElement('div');
        storyItem.className = `story-item ${group.stories[0].viewed ? 'viewed' : ''}`;
        storyItem.dataset.userId = group.userId;
        db.ref(`users/${group.userId}/name`).once('value').then(snapshot => {
            const userName = snapshot.val() || 'مستخدم';
            storyItem.innerHTML = `<div class="story-avatar">${userName.charAt(0)}</div><div class="story-name">${escapeHtml(userName)}</div>`;
        });
        storyItem.addEventListener('click', () => openStoryViewer(group));
        storiesContainer.appendChild(storyItem);
    }
}

function loadStories() {
    if (!currentUser) return;
    if (storiesListener) storiesListener();
    storiesListener = storyManager.loadStories(currentUser.uid, (storiesGroups) => displayStories(storiesGroups));
}

function showStoryCreator() {
    const modal = document.createElement('div');
    modal.className = 'story-modal';
    modal.innerHTML = `
        <div class="story-modal-content">
            <h3>إضافة قصة جديدة</h3>
            <div class="story-type-selector">
                <button class="story-type-btn active" data-type="text">نص</button>
                <button class="story-type-btn" data-type="image">صورة</button>
                <button class="story-type-btn" data-type="video">فيديو</button>
            </div>
            <textarea id="story-text" class="story-text-input" placeholder="اكتب قصتك..." style="display: block"></textarea>
            <input type="file" id="story-media" class="story-media-input" accept="image/*,video/*" style="display: none">
            <div class="story-actions">
                <button class="story-cancel">إلغاء</button>
                <button class="story-submit">نشر</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    let selectedType = 'text';
    modal.querySelectorAll('.story-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            modal.querySelectorAll('.story-type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedType = btn.dataset.type;
            const textInput = modal.querySelector('#story-text');
            const mediaInput = modal.querySelector('#story-media');
            if (selectedType === 'text') {
                textInput.style.display = 'block';
                mediaInput.style.display = 'none';
            } else {
                textInput.style.display = 'none';
                mediaInput.style.display = 'block';
                mediaInput.click();
            }
        });
    });
    
    modal.querySelector('#story-media')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`, { method: 'POST', body: formData });
        const data = await response.json();
        modal.dataset.mediaUrl = data.secure_url;
    });
    
    modal.querySelector('.story-submit')?.addEventListener('click', async () => {
        let content = '', mediaUrl = null;
        if (selectedType === 'text') content = modal.querySelector('#story-text').value;
        else mediaUrl = modal.dataset.mediaUrl;
        if (selectedType === 'text' && !content) { alert('الرجاء إدخال نص القصة'); return; }
        if ((selectedType === 'image' || selectedType === 'video') && !mediaUrl) { alert('الرجاء اختيار ملف'); return; }
        await storyManager.createStory(currentUser.uid, selectedType, content, mediaUrl);
        modal.remove();
    });
    
    modal.querySelector('.story-cancel')?.addEventListener('click', () => modal.remove());
}

function openStoryViewer(group) {
    let currentIndex = 0;
    const stories = group.stories;
    const viewer = document.createElement('div');
    viewer.className = 'story-viewer';
    viewer.innerHTML = `
        <div class="story-viewer-content">
            <div class="story-progress-bars"></div>
            <div class="story-content"></div>
            <div class="story-nav"><button class="story-prev"><i class="fas fa-chevron-right"></i></button><button class="story-next"><i class="fas fa-chevron-left"></i></button></div>
            <button class="story-close"><i class="fas fa-times"></i></button>
        </div>
    `;
    document.body.appendChild(viewer);
    
    let progressInterval = null, currentTimeout = null;
    
    function loadStory(index) {
        if (progressInterval) clearInterval(progressInterval);
        if (currentTimeout) clearTimeout(currentTimeout);
        const story = stories[index];
        const contentDiv = viewer.querySelector('.story-content');
        const progressBars = viewer.querySelector('.story-progress-bars');
        progressBars.innerHTML = '';
        stories.forEach((s, i) => {
            const bar = document.createElement('div');
            bar.className = 'story-progress-bar';
            if (i < index) bar.style.width = '100%';
            else if (i === index) { bar.style.width = '0%'; startProgress(bar); }
            progressBars.appendChild(bar);
        });
        
        if (story.type === 'text') contentDiv.innerHTML = `<div class="story-text">${escapeHtml(story.content)}</div>`;
        else if (story.type === 'image') contentDiv.innerHTML = `<img src="${story.mediaUrl}" class="story-image">`;
        else if (story.type === 'video') contentDiv.innerHTML = `<video src="${story.mediaUrl}" class="story-video" autoplay></video>`;
        
        storyManager.viewStory(story.id, currentUser.uid);
        currentTimeout = setTimeout(() => {
            if (index + 1 < stories.length) loadStory(index + 1);
            else viewer.remove();
        }, 5000);
    }
    
    function startProgress(barElement) {
        let width = 0;
        progressInterval = setInterval(() => { width += 2; barElement.style.width = width + '%'; if (width >= 100) clearInterval(progressInterval); }, 100);
    }
    
    viewer.querySelector('.story-prev')?.addEventListener('click', () => { if (currentIndex > 0) { currentIndex--; loadStory(currentIndex); } });
    viewer.querySelector('.story-next')?.addEventListener('click', () => { if (currentIndex + 1 < stories.length) { currentIndex++; loadStory(currentIndex); } else viewer.remove(); });
    viewer.querySelector('.story-close')?.addEventListener('click', () => viewer.remove());
    loadStory(0);
}

function showIncomingCallUI(call) {
    const callModal = document.createElement('div');
    callModal.className = 'call-modal';
    callModal.innerHTML = `
        <div class="call-modal-content">
            <div class="caller-info"><div class="caller-avatar">${call.callerId.substring(0, 2)}</div><div class="caller-name">جاري الاتصال...</div><div class="call-type">${call.type === 'voice' ? 'مكالمة صوتية' : 'مكالمة فيديو'}</div></div>
            <div class="call-actions"><button class="call-decline" onclick="window.callManager.endCall('${call.id}')"><i class="fas fa-phone-slash"></i></button><button class="call-answer" onclick="answerCall('${call.id}')"><i class="fas fa-phone-alt"></i></button></div>
        </div>
    `;
    document.body.appendChild(callModal);
}

async function answerCall(callId) {
    await callManager.answerCall(callId, currentUser.uid);
    document.querySelector('.call-modal')?.remove();
    openCallUI();
}

function openCallUI() {
    const callUI = document.createElement('div');
    callUI.className = 'call-ui';
    callUI.innerHTML = `
        <div class="call-ui-container"><video id="local-video" autoplay muted></video><video id="remote-video" autoplay></video><div class="call-controls"><button class="call-control" id="toggle-mic"><i class="fas fa-microphone"></i></button><button class="call-control" id="toggle-cam"><i class="fas fa-video"></i></button><button class="call-control call-end" id="end-call"><i class="fas fa-phone-slash"></i></button></div></div>
    `;
    document.body.appendChild(callUI);
    document.getElementById('toggle-mic')?.addEventListener('click', toggleMicrophone);
    document.getElementById('toggle-cam')?.addEventListener('click', toggleCamera);
    document.getElementById('end-call')?.addEventListener('click', endCurrentCall);
}

function toggleMicrophone() {
    if (callManager.localStream) {
        const audioTrack = callManager.localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            const icon = document.querySelector('#toggle-mic i');
            if (icon) icon.className = audioTrack.enabled ? 'fas fa-microphone' : 'fas fa-microphone-slash';
        }
    }
}

function toggleCamera() {
    if (callManager.localStream) {
        const videoTrack = callManager.localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            const icon = document.querySelector('#toggle-cam i');
            if (icon) icon.className = videoTrack.enabled ? 'fas fa-video' : 'fas fa-video-slash';
        }
    }
}

async function endCurrentCall() {
    if (callManager.currentCall) await callManager.endCall(callManager.currentCall.id);
    document.querySelector('.call-ui')?.remove();
}

function setupRealtimeListeners() {
    db.ref('users').on('value', (snapshot) => updateUsersStatusUI(snapshot.val()));
    callManager.onIncomingCall(currentUser.uid, (call) => showIncomingCallUI(call));
}

async function showAdminPanel() {
    if (!isAdmin) { alert('هذه الميزة للمشرفين فقط'); return; }
    const panel = document.getElementById('admin-panel');
    const content = document.getElementById('admin-content-area');
    if (!panel || !content) return;
    content.innerHTML = `<h4>لوحة تحكم المشرف</h4><div class="admin-stats"><div class="stat-card"><i class="fas fa-users"></i><span id="total-users">0</span><label>مستخدمين</label></div><div class="stat-card"><i class="fas fa-comments"></i><span id="total-chats">0</span><label>محادثات</label></div><div class="stat-card"><i class="fas fa-envelope"></i><span id="total-messages">0</span><label>رسائل</label></div></div><div class="admin-section"><h5>المستخدمين</h5><div id="admin-users-list"></div></div><div class="admin-section"><h5>الإعدادات</h5><button id="clear-all-messages" class="admin-btn danger">مسح جميع الرسائل</button><button id="backup-data" class="admin-btn">نسخ احتياطي</button></div>`;
    await loadAdminStats();
    panel.style.display = 'flex';
}

async function loadAdminStats() {
    const usersSnapshot = await db.ref('users').once('value');
    const chatsSnapshot = await db.ref('chats').once('value');
    const messagesSnapshot = await db.ref('messages').once('value');
    let messageCount = 0;
    messagesSnapshot.forEach(chat => { messageCount += Object.keys(chat.val() || {}).length; });
    document.getElementById('total-users').textContent = usersSnapshot.numChildren();
    document.getElementById('total-chats').textContent = chatsSnapshot.numChildren();
    document.getElementById('total-messages').textContent = messageCount;
    
    const usersList = document.getElementById('admin-users-list');
    if (usersList) {
        usersList.innerHTML = '';
        usersSnapshot.forEach(snapshot => {
            const user = snapshot.val();
            const userDiv = document.createElement('div');
            userDiv.className = 'admin-user-item';
            userDiv.innerHTML = `<span>${escapeHtml(user.name)} (${user.email})</span><button class="admin-delete-user" data-uid="${snapshot.key}">حذف</button>`;
            usersList.appendChild(userDiv);
        });
        document.querySelectorAll('.admin-delete-user').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (confirm('هل أنت متأكد من حذف هذا المستخدم؟')) {
                    await db.ref(`users/${btn.dataset.uid}`).remove();
                    loadAdminStats();
                }
            });
        });
    }
    document.getElementById('clear-all-messages')?.addEventListener('click', async () => {
        if (confirm('تحذير: سيتم حذف جميع الرسائل! هل أنت متأكد؟')) { await db.ref('messages').remove(); alert('تم حذف جميع الرسائل'); loadAdminStats(); }
    });
    document.getElementById('backup-data')?.addEventListener('click', () => alert('سيتم تطوير ميزة النسخ الاحتياطي قريباً'));
}

function requestNotificationPermission() {
    if (Notification.permission === 'default') Notification.requestPermission();
}

// ==================== تهيئة المستمعات ====================
function initEventListeners() {
    document.getElementById('login-tab')?.addEventListener('click', () => switchAuthTab('login'));
    document.getElementById('register-tab')?.addEventListener('click', () => switchAuthTab('register'));
    document.getElementById('login-button')?.addEventListener('click', login);
    document.getElementById('register-button')?.addEventListener('click', register);
    document.getElementById('menu-button')?.addEventListener('click', toggleMobileMenu);
    document.getElementById('admin-button')?.addEventListener('click', showAdminPanel);
    document.getElementById('admin-close')?.addEventListener('click', () => hideElement('admin-panel'));
    document.getElementById('new-chat-btn')?.addEventListener('click', createNewChat);
    document.getElementById('send-btn')?.addEventListener('click', sendMessage);
    const messageInput = document.getElementById('message-input');
    messageInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
    messageInput?.addEventListener('input', handleTyping);
    document.getElementById('search-input')?.addEventListener('input', searchChats);
    document.querySelectorAll('.nav-tab').forEach(tab => { tab.addEventListener('click', () => switchMainTab(tab.dataset.tab)); });
    document.getElementById('add-story-btn')?.addEventListener('click', showStoryCreator);
}

// ==================== التشغيل الرئيسي ====================
document.addEventListener('DOMContentLoaded', function() {
    initEventListeners();
    requestNotificationPermission();
    
    auth.onAuthStateChanged(async user => {
        if (user) {
            currentUser = user;
            await initializeUserData(user);
            await checkAdminStatus(user.email);
            showChatInterface();
            setupRealtimeListeners();
            loadUserChats();
            loadStories();
            updateUserStatus('online');
            setInterval(() => { if (currentUser) updateUserStatus('online'); }, 30000);
        } else {
            showAuthScreen();
        }
    });
    
    storyManager.startCleanupJob();
});

// دوال عامة للاستخدام العالمي
window.openImage = function(url) {
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `<div class="image-modal-content"><img src="${url}" class="image-modal-img"><button class="image-modal-close"><i class="fas fa-times"></i></button></div>`;
    modal.addEventListener('click', () => modal.remove());
    document.body.appendChild(modal);
};

window.answerCall = answerCall;
