// ============================================
// TELGRAMI - MAIN APPLICATION
// ============================================

// ==================== CLASSES ====================

class ChatManager {
    constructor() {
        this.messageListeners = [];
        this.typingListeners = [];
    }

    async createPrivateChat(userId, targetUserId) {
        try {
            const existing = await this.findPrivateChat(userId, targetUserId);
            if (existing) return existing;

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
        } catch (error) {
            console.error("Error creating private chat:", error);
            throw error;
        }
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
    
    async createGroup(name, creatorId, participants = []) {
        const groupId = generateId();
        const groupData = {
            type: 'group',
            name: name,
            participants: [creatorId, ...participants],
            admins: [creatorId],
            createdBy: creatorId,
            createdAt: new Date().toISOString(),
            lastMessage: null
        };
        
        await db.ref(`chats/${groupId}`).set(groupData);
        for (const p of [creatorId, ...participants]) {
            await db.ref(`userChats/${p}/${groupId}`).set(true);
        }
        return { id: groupId, ...groupData };
    }
    
    async sendMessage(chatId, senderId, text, type = 'text', mediaUrl = null) {
        const messageId = generateId();
        const timestamp = new Date().toISOString();
        
        const messageData = {
            senderId, text, type, mediaUrl,
            edited: false, deleted: false,
            seen: [senderId],
            timestamp
        };
        
        await db.ref(`messages/${chatId}/${messageId}`).set(messageData);
        await db.ref(`chats/${chatId}/lastMessage`).set({
            text: text.length > 50 ? text.substring(0, 50) + '...' : text,
            senderId, timestamp
        });
        
        return messageId;
    }
    
    loadMessages(chatId, callback) {
        const ref = db.ref(`messages/${chatId}`).orderByChild('timestamp');
        const listener = ref.on('value', (snapshot) => {
            const messages = [];
            snapshot.forEach(child => messages.push({ id: child.key, ...child.val() }));
            callback(messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
        });
        this.messageListeners.push({ chatId, listener });
        return () => ref.off('value', listener);
    }
    
    setTyping(chatId, userId, isTyping) {
        const ref = db.ref(`typing/${chatId}/${userId}`);
        if (isTyping) {
            ref.set({ isTyping: true, timestamp: new Date().toISOString() });
            setTimeout(() => ref.remove(), 3000);
        } else ref.remove();
    }
    
    onTyping(chatId, callback) {
        const ref = db.ref(`typing/${chatId}`);
        const listener = ref.on('value', (snapshot) => {
            const users = [];
            snapshot.forEach(child => { if (child.val().isTyping) users.push(child.key); });
            callback(users);
        });
        this.typingListeners.push({ chatId, listener });
        return () => ref.off('value', listener);
    }
    
    cleanup() {
        this.messageListeners.forEach(({ chatId, listener }) => 
            db.ref(`messages/${chatId}`).off('value', listener));
        this.typingListeners.forEach(({ chatId, listener }) => 
            db.ref(`typing/${chatId}`).off('value', listener));
        this.messageListeners = [];
        this.typingListeners = [];
    }
}

class StoryManager {
    async createStory(userId, type, content, mediaUrl = null) {
        const storyId = generateId();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        
        await db.ref(`stories/${storyId}`).set({
            userId, type, content, mediaUrl,
            createdAt: new Date().toISOString(),
            expiresAt: expiresAt.toISOString(),
            viewers: []
        });
        return storyId;
    }
    
    loadStories(userId, callback) {
        const ref = db.ref('stories').orderByChild('expiresAt').startAt(new Date().toISOString());
        const listener = ref.on('value', (snapshot) => {
            const stories = [];
            snapshot.forEach(child => {
                const story = child.val();
                if (story.userId !== userId) {
                    stories.push({
                        id: child.key,
                        ...story,
                        viewed: story.viewers?.includes(userId) || false
                    });
                }
            });
            callback(this.groupByUser(stories));
        });
        return () => ref.off('value', listener);
    }
    
    groupByUser(stories) {
        const groups = {};
        stories.forEach(s => {
            if (!groups[s.userId]) groups[s.userId] = { userId: s.userId, stories: [] };
            groups[s.userId].stories.push(s);
        });
        return Object.values(groups);
    }
    
    async viewStory(storyId, userId) {
        await db.ref(`stories/${storyId}/viewers`).transaction(current => {
            return current?.includes(userId) ? current : [...(current || []), userId];
        });
    }
}

class CallManager {
    constructor() {
        this.localStream = null;
        this.currentCall = null;
        this.configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    }
    
    async startCall(callerId, receiverId, type = 'voice') {
        const callId = generateId();
        await db.ref(`calls/${callId}`).set({
            type, callerId, receiverId, status: 'initiating',
            startedAt: new Date().toISOString(), duration: 0
        });
        this.currentCall = { id: callId, type, callerId, receiverId };
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
        return callId;
    }
    
    async endCall(callId) {
        const call = await db.ref(`calls/${callId}`).once('value');
        if (call.exists()) {
            const data = call.val();
            const duration = Math.floor((new Date() - new Date(data.startedAt)) / 1000);
            await db.ref(`calls/${callId}`).update({ status: 'ended', duration });
        }
        this.localStream?.getTracks().forEach(t => t.stop());
        this.localStream = null;
        this.currentCall = null;
    }
    
    onIncomingCall(userId, callback) {
        const ref = db.ref('calls').orderByChild('receiverId').equalTo(userId);
        return ref.on('child_added', (snapshot) => {
            if (snapshot.val().status === 'initiating') callback({ id: snapshot.key, ...snapshot.val() });
        });
    }
}

// ==================== INITIALIZE ====================
const chatManager = new ChatManager();
const storyManager = new StoryManager();
const callManager = new CallManager();

// ==================== GLOBAL VARIABLES ====================
let currentUser = null;
let isAdmin = false;
let currentChatId = null;
let messageListener = null;
let typingListener = null;
let storiesListener = null;
let typingTimeout = null;

// ==================== AUTH FUNCTIONS ====================

async function login() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();
    const errorEl = document.getElementById('login-error');
    const btn = document.getElementById('login-button');
    
    if (!email || !password) {
        errorEl.textContent = 'يرجى إدخال البريد الإلكتروني وكلمة المرور';
        return;
    }
    errorEl.textContent = '';
    btn.disabled = true;
    btn.textContent = 'جاري...';
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
        showToast('تم تسجيل الدخول بنجاح', 'success');
    } catch (error) {
        errorEl.textContent = getAuthErrorMessage(error.code);
    } finally {
        btn.disabled = false;
        btn.textContent = 'دخول';
    }
}

async function register() {
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value.trim();
    const confirm = document.getElementById('register-confirm-password').value.trim();
    const errorEl = document.getElementById('register-error');
    const successEl = document.getElementById('register-success');
    const btn = document.getElementById('register-button');
    
    if (!name || !email || !password || !confirm) {
        errorEl.textContent = 'يرجى ملء جميع الحقول';
        return;
    }
    if (password !== confirm) {
        errorEl.textContent = 'كلمات المرور غير متطابقة';
        return;
    }
    if (password.length < 6) {
        errorEl.textContent = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
        return;
    }
    errorEl.textContent = '';
    btn.disabled = true;
    btn.textContent = 'جاري...';
    
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        await db.ref(`users/${userCredential.user.uid}`).set({
            name, email, avatar: null, bio: '',
            lastSeen: new Date().toISOString(), status: 'online',
            createdAt: new Date().toISOString(), contacts: [], blockedUsers: [], isAdmin: false
        });
        successEl.textContent = 'تم إنشاء الحساب بنجاح!';
        setTimeout(() => document.getElementById('login-tab').click(), 1500);
    } catch (error) {
        errorEl.textContent = getAuthErrorMessage(error.code);
    } finally {
        btn.disabled = false;
        btn.textContent = 'إنشاء حساب';
    }
}

async function checkAdminStatus(email) {
    if (email === 'jasim28v@gmail.com') {
        const code = prompt('أدخل رمز المشرف:');
        isAdmin = code === 'vv2314vv';
    }
    return isAdmin;
}

// ==================== UI FUNCTIONS ====================

function showAuthScreen() {
    document.getElementById('auth-container').style.display = 'flex';
    document.getElementById('app-container').style.display = 'none';
}

function showChatInterface() {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';
}

function toggleMobileMenu() {
    document.getElementById('sidebar').classList.toggle('open');
}

function switchMainTab(tab) {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.nav-tab[data-tab="${tab}"]`).classList.add('active');
    document.getElementById('chats-view').classList.toggle('hidden', tab !== 'chats');
    document.getElementById('stories-view').classList.toggle('hidden', tab !== 'stories');
    document.getElementById('calls-view').classList.toggle('hidden', tab !== 'calls');
    if (tab === 'stories') loadStories();
}

function searchChats() {
    const query = document.getElementById('search-input').value.toLowerCase();
    document.querySelectorAll('.chat-item').forEach(item => {
        const name = item.querySelector('.chat-name')?.textContent.toLowerCase();
        item.style.display = name?.includes(query) ? 'flex' : 'none';
    });
}

// ==================== CHAT FUNCTIONS ====================

async function loadUserChats() {
    const chatsList = document.getElementById('chats-list');
    chatsList.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>جاري التحميل...</p></div>';
    
    const snapshot = await db.ref(`userChats/${currentUser.uid}`).once('value');
    if (!snapshot.exists()) {
        chatsList.innerHTML = '<div class="empty-state"><i class="fas fa-comment-slash"></i><p>لا توجد محادثات بعد</p></div>';
        return;
    }
    
    chatsList.innerHTML = '';
    for (const chatId of Object.keys(snapshot.val())) {
        const chatSnap = await db.ref(`chats/${chatId}`).once('value');
        if (chatSnap.exists()) addChatToUI(chatId, chatSnap.val());
    }
}

function addChatToUI(chatId, chat) {
    const chatsList = document.getElementById('chats-list');
    let name = chat.name, avatar = chat.name?.charAt(0) || 'G';
    
    if (chat.type === 'private') {
        const otherId = chat.participants.find(id => id !== currentUser.uid);
        db.ref(`users/${otherId}`).once('value').then(s => {
            if (s.exists()) {
                name = s.val().name;
                avatar = s.val().avatar || name.charAt(0);
                nameEl.textContent = escapeHtml(name);
                avatarEl.textContent = avatar;
            }
        });
    }
    
    const lastMsg = chat.lastMessage?.text || 'لا توجد رسائل';
    const time = chat.lastMessage?.timestamp ? formatTime(chat.lastMessage.timestamp) : '';
    
    const item = document.createElement('div');
    item.className = `chat-item ${currentChatId === chatId ? 'active' : ''}`;
    item.dataset.chatId = chatId;
    item.innerHTML = `
        <div class="chat-avatar">${avatar}</div>
        <div class="chat-info">
            <div class="chat-name">${escapeHtml(name)}</div>
            <div class="chat-preview">${escapeHtml(lastMsg)}</div>
        </div>
        <div class="chat-time">${time}</div>
    `;
    item.addEventListener('click', () => openChat(chatId, chat));
    chatsList.appendChild(item);
    
    const nameEl = item.querySelector('.chat-name');
    const avatarEl = item.querySelector('.chat-avatar');
}

function openChat(chatId, chat) {
    if (messageListener) messageListener();
    if (typingListener) typingListener();
    
    currentChatId = chatId;
    
    let name = chat.name, avatar = chat.name?.charAt(0) || 'G';
    if (chat.type === 'private') {
        const otherId = chat.participants.find(id => id !== currentUser.uid);
        db.ref(`users/${otherId}`).once('value').then(s => {
            if (s.exists()) {
                document.getElementById('chat-header-name').textContent = s.val().name;
                document.getElementById('chat-header-avatar').textContent = s.val().avatar || s.val().name.charAt(0);
            }
        });
    } else {
        document.getElementById('chat-header-name').textContent = name;
        document.getElementById('chat-header-avatar').textContent = avatar;
    }
    
    messageListener = chatManager.loadMessages(chatId, displayMessages);
    typingListener = chatManager.onTyping(chatId, (users) => {
        const indicator = document.getElementById('typing-indicator');
        if (users.length && users[0] !== currentUser.uid) {
            indicator.style.display = 'flex';
            indicator.textContent = 'يكتب...';
        } else indicator.style.display = 'none';
    });
    
    if (window.innerWidth <= 768) toggleMobileMenu();
    document.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
    document.querySelector(`.chat-item[data-chat-id="${chatId}"]`)?.classList.add('active');
}

function displayMessages(messages) {
    const container = document.getElementById('messages-container');
    const shouldScroll = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    container.innerHTML = '';
    
    let lastDate = null;
    for (const msg of messages) {
        if (msg.deleted) continue;
        
        const date = new Date(msg.timestamp).toLocaleDateString('ar-EG');
        if (date !== lastDate) {
            container.innerHTML += `<div class="message-date"><span>${date}</span></div>`;
            lastDate = date;
        }
        
        const isMe = msg.senderId === currentUser.uid;
        const div = document.createElement('div');
        div.className = `message ${isMe ? 'sent' : 'received'}`;
        
        if (msg.type === 'text') div.innerHTML = `<div class="message-text">${escapeHtml(msg.text)}</div>`;
        else if (msg.type === 'image') div.innerHTML = `<img src="${msg.mediaUrl}" class="message-image" onclick="openImage('${msg.mediaUrl}')">`;
        else if (msg.type === 'video') div.innerHTML = `<video src="${msg.mediaUrl}" controls class="message-video"></video>`;
        
        div.innerHTML += `<div class="message-time">${formatTime(msg.timestamp)}</div>`;
        if (isMe) div.innerHTML += `<div class="message-seen"><i class="fas fa-check-double"></i></div>`;
        if (msg.edited) div.innerHTML += `<span class="message-edited">(معدلة)</span>`;
        
        container.appendChild(div);
    }
    if (shouldScroll) container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    if (!text || !currentChatId) return;
    
    await chatManager.sendMessage(currentChatId, currentUser.uid, text);
    input.value = '';
    input.style.height = 'auto';
    chatManager.setTyping(currentChatId, currentUser.uid, false);
}

function handleTyping() {
    if (!currentChatId) return;
    if (typingTimeout) clearTimeout(typingTimeout);
    chatManager.setTyping(currentChatId, currentUser.uid, true);
    typingTimeout = setTimeout(() => chatManager.setTyping(currentChatId, currentUser.uid, false), 3000);
}

async function createNewChat() {
    const type = prompt('اختر:\n1 - محادثة خاصة\n2 - مجموعة');
    if (type === '1') {
        const email = prompt('أدخل البريد الإلكتروني للمستخدم:');
        if (email) {
            const users = await db.ref('users').orderByChild('email').equalTo(email).once('value');
            if (users.exists()) {
                const targetId = Object.keys(users.val())[0];
                if (targetId === currentUser.uid) return alert('لا يمكنك المحادثة مع نفسك');
                const chat = await chatManager.findPrivateChat(currentUser.uid, targetId);
                if (chat) openChat(chat.id, chat);
                else {
                    const newChat = await chatManager.createPrivateChat(currentUser.uid, targetId);
                    openChat(newChat.id, newChat);
                    loadUserChats();
                }
            } else alert('المستخدم غير موجود');
        }
    } else if (type === '2') {
        const name = prompt('أدخل اسم المجموعة:');
        if (name) {
            const newChat = await chatManager.createGroup(name, currentUser.uid);
            openChat(newChat.id, newChat);
            loadUserChats();
        }
    }
}

// ==================== STORIES FUNCTIONS ====================

function loadStories() {
    if (storiesListener) storiesListener();
    storiesListener = storyManager.loadStories(currentUser.uid, displayStories);
}

function displayStories(groups) {
    const container = document.getElementById('stories-container');
    container.innerHTML = `
        <div class="story-item my-story" onclick="showStoryCreator()">
            <div class="story-avatar"><i class="fas fa-plus"></i></div>
            <div class="story-name">قصتي</div>
        </div>
    `;
    groups.forEach(group => {
        const item = document.createElement('div');
        item.className = `story-item ${group.stories[0].viewed ? 'viewed' : ''}`;
        db.ref(`users/${group.userId}/name`).once('value').then(s => {
            const name = s.val() || 'مستخدم';
            item.innerHTML = `<div class="story-avatar">${name.charAt(0)}</div><div class="story-name">${escapeHtml(name)}</div>`;
        });
        item.addEventListener('click', () => openStoryViewer(group));
        container.appendChild(item);
    });
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
            <textarea id="story-text" class="story-text-input" placeholder="اكتب قصتك..."></textarea>
            <input type="file" id="story-media" accept="image/*,video/*" style="display:none">
            <div class="story-actions">
                <button class="story-cancel">إلغاء</button>
                <button class="story-submit">نشر</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    let type = 'text';
    modal.querySelectorAll('.story-type-btn').forEach(btn => {
        btn.onclick = () => {
            modal.querySelectorAll('.story-type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            type = btn.dataset.type;
            modal.querySelector('#story-text').style.display = type === 'text' ? 'block' : 'none';
            modal.querySelector('#story-media').style.display = type !== 'text' ? 'block' : 'none';
            if (type !== 'text') modal.querySelector('#story-media').click();
        };
    });
    
    modal.querySelector('#story-media').onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const fd = new FormData();
        fd.append('file', file);
        fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`, { method: 'POST', body: fd });
        const data = await res.json();
        modal.dataset.mediaUrl = data.secure_url;
    };
    
    modal.querySelector('.story-submit').onclick = async () => {
        let content = '', media = null;
        if (type === 'text') content = modal.querySelector('#story-text').value;
        else media = modal.dataset.mediaUrl;
        if ((type === 'text' && !content) || ((type === 'image' || type === 'video') && !media)) {
            return alert('الرجاء إدخال محتوى القصة');
        }
        await storyManager.createStory(currentUser.uid, type, content, media);
        modal.remove();
        loadStories();
        showToast('تم نشر القصة بنجاح', 'success');
    };
    modal.querySelector('.story-cancel').onclick = () => modal.remove();
}

function openStoryViewer(group) {
    let index = 0;
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
    
    let interval, timeout;
    
    function loadStory(i) {
        if (interval) clearInterval(interval);
        if (timeout) clearTimeout(timeout);
        const story = group.stories[i];
        const bars = viewer.querySelector('.story-progress-bars');
        bars.innerHTML = '';
        group.stories.forEach((_, idx) => {
            const bar = document.createElement('div');
            bar.className = 'story-progress-bar';
            if (idx < i) bar.style.cssText = 'background: white;';
            else if (idx === i) { startProgress(bar); }
            bars.appendChild(bar);
        });
        
        const content = viewer.querySelector('.story-content');
        if (story.type === 'text') content.innerHTML = `<div class="story-text">${escapeHtml(story.content)}</div>`;
        else if (story.type === 'image') content.innerHTML = `<img src="${story.mediaUrl}">`;
        else if (story.type === 'video') content.innerHTML = `<video src="${story.mediaUrl}" autoplay></video>`;
        
        storyManager.viewStory(story.id, currentUser.uid);
        timeout = setTimeout(() => {
            if (i + 1 < group.stories.length) loadStory(i + 1);
            else viewer.remove();
        }, 5000);
    }
    
    function startProgress(bar) {
        let width = 0;
        interval = setInterval(() => {
            width += 2;
            bar.style.background = 'white';
            bar.style.width = width + '%';
            if (width >= 100) clearInterval(interval);
        }, 100);
    }
    
    viewer.querySelector('.story-prev').onclick = () => { if (index > 0) { index--; loadStory(index); } };
    viewer.querySelector('.story-next').onclick = () => { if (index + 1 < group.stories.length) { index++; loadStory(index); } else viewer.remove(); };
    viewer.querySelector('.story-close').onclick = () => viewer.remove();
    loadStory(0);
}

// ==================== ADMIN FUNCTIONS ====================

async function showAdminPanel() {
    if (!isAdmin) return alert('هذه الميزة للمشرفين فقط');
    const panel = document.getElementById('admin-panel');
    const content = document.getElementById('admin-content-area');
    content.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>جاري التحميل...</p></div>';
    panel.style.display = 'flex';
    
    const users = await db.ref('users').once('value');
    const chats = await db.ref('chats').once('value');
    let msgCount = 0;
    const msgs = await db.ref('messages').once('value');
    msgs.forEach(chat => msgCount += Object.keys(chat.val() || {}).length);
    
    content.innerHTML = `
        <div class="admin-stats">
            <div class="stat-card"><i class="fas fa-users"></i><span>${users.numChildren()}</span><label>مستخدمين</label></div>
            <div class="stat-card"><i class="fas fa-comments"></i><span>${chats.numChildren()}</span><label>محادثات</label></div>
            <div class="stat-card"><i class="fas fa-envelope"></i><span>${msgCount}</span><label>رسائل</label></div>
        </div>
        <div class="admin-section"><h5>المستخدمين</h5><div id="admin-users-list"></div></div>
        <div class="admin-section"><h5>الإعدادات</h5><button id="clear-all" class="admin-btn danger">مسح جميع الرسائل</button></div>
    `;
    
    const list = document.getElementById('admin-users-list');
    users.forEach(snap => {
        const user = snap.val();
        list.innerHTML += `
            <div class="admin-user-item">
                <span>${escapeHtml(user.name)} (${user.email})</span>
                <button class="admin-btn danger" data-uid="${snap.key}">حذف</button>
            </div>
        `;
    });
    
    document.querySelectorAll('[data-uid]').forEach(btn => {
        btn.onclick = async () => {
            if (confirm('هل أنت متأكد؟')) {
                await db.ref(`users/${btn.dataset.uid}`).remove();
                showAdminPanel();
                showToast('تم حذف المستخدم', 'success');
            }
        };
    });
    
    document.getElementById('clear-all').onclick = async () => {
        if (confirm('تحذير: سيتم حذف جميع الرسائل!')) {
            await db.ref('messages').remove();
            showAdminPanel();
            showToast('تم حذف جميع الرسائل', 'success');
        }
    };
}

// ==================== CALL FUNCTIONS ====================

function showIncomingCall(call) {
    const modal = document.createElement('div');
    modal.className = 'call-modal';
    modal.innerHTML = `
        <div class="call-modal-content">
            <div class="caller-avatar"><i class="fas fa-phone-alt"></i></div>
            <div class="caller-name">مكالمة واردة</div>
            <div class="call-type">${call.type === 'voice' ? 'مكالمة صوتية' : 'مكالمة فيديو'}</div>
            <div class="call-actions">
                <button class="call-decline" id="decline-call"><i class="fas fa-phone-slash"></i></button>
                <button class="call-answer" id="answer-call"><i class="fas fa-phone-alt"></i></button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('decline-call').onclick = () => { callManager.endCall(call.id); modal.remove(); };
    document.getElementById('answer-call').onclick = async () => {
        await callManager.answerCall(call.id, currentUser.uid);
        modal.remove();
        openCallUI();
    };
}

function openCallUI() {
    const ui = document.createElement('div');
    ui.className = 'call-ui';
    ui.innerHTML = `
        <div class="call-ui-container">
            <video id="local-video" autoplay muted></video>
            <video id="remote-video" autoplay></video>
            <div class="call-controls">
                <button class="call-control" id="toggle-mic"><i class="fas fa-microphone"></i></button>
                <button class="call-control" id="toggle-cam"><i class="fas fa-video"></i></button>
                <button class="call-control call-end" id="end-call"><i class="fas fa-phone-slash"></i></button>
            </div>
        </div>
    `;
    document.body.appendChild(ui);
    document.getElementById('toggle-mic').onclick = () => {
        const track = callManager.localStream?.getAudioTracks()[0];
        if (track) track.enabled = !track.enabled;
    };
    document.getElementById('toggle-cam').onclick = () => {
        const track = callManager.localStream?.getVideoTracks()[0];
        if (track) track.enabled = !track.enabled;
    };
    document.getElementById('end-call').onclick = async () => {
        await callManager.endCall(callManager.currentCall?.id);
        ui.remove();
    };
}

// ==================== INITIALIZATION ====================

function initEventListeners() {
    document.getElementById('login-tab').onclick = () => {
        document.getElementById('login-tab').classList.add('active');
        document.getElementById('register-tab').classList.remove('active');
        document.getElementById('login-form').style.display = 'block';
        document.getElementById('register-form').style.display = 'none';
    };
    document.getElementById('register-tab').onclick = () => {
        document.getElementById('register-tab').classList.add('active');
        document.getElementById('login-tab').classList.remove('active');
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('register-form').style.display = 'block';
    };
    document.getElementById('login-button').onclick = login;
    document.getElementById('register-button').onclick = register;
    document.getElementById('menu-button').onclick = toggleMobileMenu;
    document.getElementById('admin-button').onclick = showAdminPanel;
    document.getElementById('admin-close').onclick = () => document.getElementById('admin-panel').style.display = 'none';
    document.getElementById('new-chat-btn').onclick = createNewChat;
    document.getElementById('send-btn').onclick = sendMessage;
    document.getElementById('message-input').onkeypress = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
    document.getElementById('message-input').oninput = handleTyping;
    document.getElementById('search-input').oninput = searchChats;
    document.querySelectorAll('.nav-tab').forEach(tab => tab.onclick = () => switchMainTab(tab.dataset.tab));
    document.getElementById('attach-btn').onclick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,video/*';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const fd = new FormData();
            fd.append('file', file);
            fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`, { method: 'POST', body: fd });
            const data = await res.json();
            await chatManager.sendMessage(currentChatId, currentUser.uid, '', file.type.startsWith('image') ? 'image' : 'video', data.secure_url);
            showToast('تم الرفع بنجاح', 'success');
        };
        input.click();
    };
}

// ==================== APP START ====================

document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    
    auth.onAuthStateChanged(async user => {
        if (user) {
            currentUser = user;
            const userRef = db.ref(`users/${user.uid}`);
            const snap = await userRef.once('value');
            if (!snap.exists()) {
                await userRef.set({
                    name: user.email.split('@')[0],
                    email: user.email,
                    createdAt: new Date().toISOString(),
                    status: 'online',
                    lastSeen: new Date().toISOString(),
                    contacts: []
                });
            }
            await checkAdminStatus(user.email);
            showChatInterface();
            loadUserChats();
            loadStories();
            callManager.onIncomingCall(user.uid, showIncomingCall);
            setInterval(() => {
                if (currentUser) db.ref(`users/${currentUser.uid}/lastSeen`).set(new Date().toISOString());
            }, 30000);
        } else {
            showAuthScreen();
        }
    });
});

window.openImage = (url) => {
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `<div class="image-modal-content"><img src="${url}" class="image-modal-img"></div>`;
    modal.onclick = () => modal.remove();
    document.body.appendChild(modal);
};
