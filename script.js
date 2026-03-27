// ============================================
// TELEGRAMI - Complete Telegram Clone
// ============================================

// ==================== CLASSES ====================

class ChatManager {
    constructor() {
        this.listeners = [];
    }

    async createPrivateChat(userId, targetId) {
        const existing = await this.findPrivateChat(userId, targetId);
        if (existing) return existing;
        
        const chatId = generateId();
        await db.ref(`chats/${chatId}`).set({
            type: 'private',
            participants: [userId, targetId],
            createdAt: new Date().toISOString(),
            lastMessage: null
        });
        await db.ref(`userChats/${userId}/${chatId}`).set(true);
        await db.ref(`userChats/${targetId}/${chatId}`).set(true);
        return { id: chatId, type: 'private', participants: [userId, targetId] };
    }
    
    async findPrivateChat(userId, targetId) {
        const chats = await db.ref(`userChats/${userId}`).once('value');
        if (!chats.exists()) return null;
        
        for (const chatId in chats.val()) {
            const chat = await db.ref(`chats/${chatId}`).once('value');
            if (chat.exists() && chat.val().type === 'private') {
                if (chat.val().participants.includes(targetId)) {
                    return { id: chatId, ...chat.val() };
                }
            }
        }
        return null;
    }
    
    async createGroup(name, creatorId) {
        const groupId = generateId();
        await db.ref(`chats/${groupId}`).set({
            type: 'group',
            name: name,
            participants: [creatorId],
            admins: [creatorId],
            createdBy: creatorId,
            createdAt: new Date().toISOString()
        });
        await db.ref(`userChats/${creatorId}/${groupId}`).set(true);
        return { id: groupId, type: 'group', name: name };
    }
    
    async sendMessage(chatId, senderId, text, type = 'text', mediaUrl = null) {
        const msgId = generateId();
        const timestamp = new Date().toISOString();
        await db.ref(`messages/${chatId}/${msgId}`).set({
            senderId, text, type, mediaUrl,
            seen: [senderId], timestamp, edited: false, deleted: false
        });
        await db.ref(`chats/${chatId}/lastMessage`).set({
            text: text.substring(0, 50), senderId, timestamp
        });
        return msgId;
    }
    
    loadMessages(chatId, callback) {
        const ref = db.ref(`messages/${chatId}`).orderByChild('timestamp');
        const listener = ref.on('value', (snap) => {
            const msgs = [];
            snap.forEach(c => msgs.push({ id: c.key, ...c.val() }));
            callback(msgs.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp)));
        });
        this.listeners.push(listener);
        return () => ref.off('value', listener);
    }
    
    setTyping(chatId, userId, typing) {
        const ref = db.ref(`typing/${chatId}/${userId}`);
        if (typing) {
            ref.set({ typing: true, timestamp: new Date().toISOString() });
            setTimeout(() => ref.remove(), 3000);
        } else ref.remove();
    }
    
    onTyping(chatId, callback) {
        const ref = db.ref(`typing/${chatId}`);
        const listener = ref.on('value', (snap) => {
            const users = [];
            snap.forEach(c => { if (c.val().typing) users.push(c.key); });
            callback(users);
        });
        return () => ref.off('value', listener);
    }
}

class StoryManager {
    async createStory(userId, type, content, media = null) {
        const id = generateId();
        const expires = new Date(Date.now() + 24*60*60*1000);
        await db.ref(`stories/${id}`).set({
            userId, type, content, media,
            createdAt: new Date().toISOString(),
            expiresAt: expires.toISOString(),
            viewers: []
        });
        return id;
    }
    
    loadStories(userId, callback) {
        const ref = db.ref('stories').orderByChild('expiresAt').startAt(new Date().toISOString());
        const listener = ref.on('value', (snap) => {
            const stories = [];
            snap.forEach(c => {
                const s = c.val();
                if (s.userId !== userId) {
                    stories.push({ id: c.key, ...s, viewed: s.viewers?.includes(userId) });
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
        await db.ref(`stories/${storyId}/viewers`).transaction(v => {
            return v?.includes(userId) ? v : [...(v || []), userId];
        });
    }
}

class CallManager {
    async startCall(callerId, receiverId, type = 'voice') {
        const id = generateId();
        await db.ref(`calls/${id}`).set({
            type, callerId, receiverId, status: 'ringing',
            startedAt: new Date().toISOString()
        });
        return id;
    }
    
    async endCall(callId) {
        await db.ref(`calls/${callId}`).update({ status: 'ended', endedAt: new Date().toISOString() });
    }
    
    onIncoming(userId, callback) {
        const ref = db.ref('calls').orderByChild('receiverId').equalTo(userId);
        return ref.on('child_added', snap => {
            if (snap.val().status === 'ringing') callback({ id: snap.key, ...snap.val() });
        });
    }
}

// ==================== INIT ====================
const chatManager = new ChatManager();
const storyManager = new StoryManager();
const callManager = new CallManager();

let currentUser = null;
let isAdmin = false;
let currentChatId = null;
let msgListener = null;
let typingListener = null;
let storiesListener = null;
let typingTimeout = null;

// ==================== AUTH ====================
async function login() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();
    const errorEl = document.getElementById('login-error');
    if (!email || !password) return errorEl.textContent = 'املأ جميع الحقول';
    errorEl.textContent = '';
    try {
        await auth.signInWithEmailAndPassword(email, password);
        showToast('مرحباً بك', 'success');
    } catch(e) {
        errorEl.textContent = getAuthErrorMessage(e.code);
    }
}

async function register() {
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const pass = document.getElementById('register-password').value.trim();
    const confirm = document.getElementById('register-confirm-password').value.trim();
    const errorEl = document.getElementById('register-error');
    if (!name || !email || !pass) return errorEl.textContent = 'املأ جميع الحقول';
    if (pass !== confirm) return errorEl.textContent = 'كلمات المرور غير متطابقة';
    if (pass.length < 6) return errorEl.textContent = 'كلمة المرور 6 أحرف على الأقل';
    errorEl.textContent = '';
    try {
        const { user } = await auth.createUserWithEmailAndPassword(email, pass);
        await db.ref(`users/${user.uid}`).set({
            name, email, avatar: null,
            createdAt: new Date().toISOString(),
            status: 'online'
        });
        showToast('تم إنشاء الحساب', 'success');
        document.getElementById('login-tab').click();
    } catch(e) {
        errorEl.textContent = getAuthErrorMessage(e.code);
    }
}

async function checkAdmin(email) {
    if (email === 'jasim28v@gmail.com') {
        const code = prompt('رمز المشرف:');
        isAdmin = code === 'vv2314vv';
    }
    return isAdmin;
}

// ==================== UI ====================
function showAuth() {
    document.getElementById('auth-container').style.display = 'flex';
    document.getElementById('app-container').style.display = 'none';
}

function showApp() {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';
}

function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.tab[data-tab="${tab}"]`).classList.add('active');
    document.getElementById('chats-view').classList.toggle('hidden', tab !== 'chats');
    document.getElementById('stories-view').classList.toggle('hidden', tab !== 'stories');
    document.getElementById('calls-view').classList.toggle('hidden', tab !== 'calls');
    if (tab === 'stories') loadStories();
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

function closeSidebar() {
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
    }
}

// ==================== CHATS ====================
async function loadChats() {
    const list = document.getElementById('chats-list');
    list.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>جاري التحميل...</p></div>';
    
    const userChats = await db.ref(`userChats/${currentUser.uid}`).once('value');
    if (!userChats.exists()) {
        list.innerHTML = '<div class="empty-state"><i class="fas fa-comment-slash"></i><p>ابدأ محادثة جديدة</p></div>';
        return;
    }
    
    list.innerHTML = '';
    for (const chatId of Object.keys(userChats.val())) {
        const chat = await db.ref(`chats/${chatId}`).once('value');
        if (chat.exists()) addChatToUI(chatId, chat.val());
    }
}

function addChatToUI(chatId, chat) {
    const list = document.getElementById('chats-list');
    let name = chat.name || 'محادثة';
    let avatar = name.charAt(0);
    
    if (chat.type === 'private') {
        const otherId = chat.participants.find(id => id !== currentUser.uid);
        db.ref(`users/${otherId}`).once('value').then(s => {
            if (s.exists()) {
                name = s.val().name;
                avatar = name.charAt(0);
                nameEl.textContent = escapeHtml(name);
                avatarEl.textContent = avatar;
            }
        });
    }
    
    const lastMsg = chat.lastMessage?.text || 'رسالة جديدة';
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
        <div class="chat-meta">
            <div class="chat-time">${time}</div>
        </div>
    `;
    item.onclick = () => openChat(chatId, chat);
    list.appendChild(item);
    
    const nameEl = item.querySelector('.chat-name');
    const avatarEl = item.querySelector('.chat-avatar');
}

function openChat(chatId, chat) {
    if (msgListener) msgListener();
    if (typingListener) typingListener();
    
    currentChatId = chatId;
    
    let name = chat.name || 'محادثة';
    let avatar = name.charAt(0);
    
    if (chat.type === 'private') {
        const otherId = chat.participants.find(id => id !== currentUser.uid);
        db.ref(`users/${otherId}`).once('value').then(s => {
            if (s.exists()) {
                document.getElementById('chat-header-name').textContent = s.val().name;
                document.getElementById('chat-header-avatar').textContent = s.val().avatar || s.val().name.charAt(0);
                document.getElementById('chat-header-status').textContent = s.val().status === 'online' ? 'متصل' : 'غير متصل';
            }
        });
    } else {
        document.getElementById('chat-header-name').textContent = name;
        document.getElementById('chat-header-avatar').textContent = avatar;
    }
    
    msgListener = chatManager.loadMessages(chatId, displayMessages);
    typingListener = chatManager.onTyping(chatId, (users) => {
        const ind = document.getElementById('typing-indicator');
        if (users.length && users[0] !== currentUser.uid) {
            ind.style.display = 'flex';
            ind.textContent = 'يكتب...';
        } else ind.style.display = 'none';
    });
    
    closeSidebar();
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
        
        if (msg.type === 'text') {
            div.innerHTML = `<div class="message-text">${escapeHtml(msg.text)}</div>`;
        } else if (msg.type === 'image') {
            div.innerHTML = `<img src="${msg.mediaUrl}" style="max-width: 200px; border-radius: 12px; cursor: pointer;" onclick="openImage('${msg.mediaUrl}')">`;
        } else if (msg.type === 'video') {
            div.innerHTML = `<video src="${msg.mediaUrl}" controls style="max-width: 200px; border-radius: 12px;"></video>`;
        }
        
        div.innerHTML += `
            <div class="message-meta">
                <span class="message-time">${formatTime(msg.timestamp)}</span>
                ${isMe ? `<span class="message-seen"><i class="fas fa-check-double"></i></span>` : ''}
            </div>
        `;
        
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
        const email = prompt('البريد الإلكتروني للمستخدم:');
        if (email) {
            const users = await db.ref('users').orderByChild('email').equalTo(email).once('value');
            if (users.exists()) {
                const targetId = Object.keys(users.val())[0];
                if (targetId === currentUser.uid) return showToast('لا يمكن المحادثة مع نفسك');
                const existing = await chatManager.findPrivateChat(currentUser.uid, targetId);
                if (existing) openChat(existing.id, existing);
                else {
                    const newChat = await chatManager.createPrivateChat(currentUser.uid, targetId);
                    openChat(newChat.id, newChat);
                    loadChats();
                }
            } else showToast('المستخدم غير موجود');
        }
    } else if (type === '2') {
        const name = prompt('اسم المجموعة:');
        if (name) {
            const newChat = await chatManager.createGroup(name, currentUser.uid);
            openChat(newChat.id, newChat);
            loadChats();
        }
    }
}

// ==================== STORIES ====================
function loadStories() {
    if (storiesListener) storiesListener();
    storiesListener = storyManager.loadStories(currentUser.uid, displayStories);
}

function displayStories(groups) {
    const container = document.getElementById('stories-container');
    container.innerHTML = `
        <div class="story-item my-story" onclick="showStoryCreator()">
            <div class="story-ring"><div class="story-avatar"><i class="fas fa-plus"></i></div></div>
            <div class="story-name">قصتي</div>
        </div>
    `;
    groups.forEach(group => {
        const item = document.createElement('div');
        item.className = `story-item ${group.stories[0].viewed ? 'viewed' : ''}`;
        db.ref(`users/${group.userId}/name`).once('value').then(s => {
            const name = s.val() || 'مستخدم';
            item.innerHTML = `
                <div class="story-ring"><div class="story-avatar">${name.charAt(0)}</div></div>
                <div class="story-name">${escapeHtml(name)}</div>
            `;
        });
        item.onclick = () => openStoryViewer(group);
        container.appendChild(item);
    });
}

function showStoryCreator() {
    const modal = document.createElement('div');
    modal.className = 'admin-panel';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="admin-card" style="max-width: 350px;">
            <div class="admin-header">
                <h3>قصة جديدة</h3>
                <button id="close-modal" style="background:none;border:none;color:white;font-size:24px;">&times;</button>
            </div>
            <div style="padding: 20px;">
                <div class="tabs" style="margin-bottom: 16px;">
                    <button class="tab active" data-type="text">نص</button>
                    <button class="tab" data-type="image">صورة</button>
                    <button class="tab" data-type="video">فيديو</button>
                </div>
                <textarea id="story-text" placeholder="اكتب قصتك..." style="width:100%;background:var(--tg-surface-light);border:none;border-radius:16px;padding:12px;color:white;font-family:inherit;resize:none;" rows="4"></textarea>
                <input type="file" id="story-file" accept="image/*,video/*" style="display:none">
                <button id="publish-story" class="auth-btn" style="margin-top:16px;">نشر</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    let type = 'text';
    modal.querySelectorAll('[data-type]').forEach(btn => {
        btn.onclick = () => {
            modal.querySelectorAll('[data-type]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            type = btn.dataset.type;
            document.getElementById('story-text').style.display = type === 'text' ? 'block' : 'none';
            document.getElementById('story-file').style.display = type !== 'text' ? 'block' : 'none';
            if (type !== 'text') document.getElementById('story-file').click();
        };
    });
    
    document.getElementById('story-file').onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const fd = new FormData();
        fd.append('file', file);
        fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`, { method: 'POST', body: fd });
        const data = await res.json();
        modal.dataset.media = data.secure_url;
    };
    
    document.getElementById('publish-story').onclick = async () => {
        let content = '', media = null;
        if (type === 'text') content = document.getElementById('story-text').value;
        else media = modal.dataset.media;
        if ((type === 'text' && !content) || ((type === 'image' || type === 'video') && !media)) {
            return showToast('أدخل محتوى القصة');
        }
        await storyManager.createStory(currentUser.uid, type, content, media);
        modal.remove();
        loadStories();
        showToast('تم نشر القصة');
    };
    
    document.getElementById('close-modal').onclick = () => modal.remove();
}

function openStoryViewer(group) {
    let index = 0;
    const stories = group.stories;
    const viewer = document.createElement('div');
    viewer.className = 'story-viewer';
    viewer.innerHTML = `
        <div class="story-viewer-header">
            <div class="story-viewer-avatar">${group.userId.charAt(0)}</div>
            <div>
                <div class="story-viewer-name" id="story-user-name">...</div>
                <div class="story-viewer-time" id="story-time"></div>
            </div>
            <button class="story-close" id="close-viewer"><i class="fas fa-times"></i></button>
        </div>
        <div class="story-progress" id="story-progress"></div>
        <div class="story-content" id="story-content"></div>
        <div style="position:absolute;top:50%;left:0;right:0;display:flex;justify-content:space-between;padding:0 16px;">
            <button id="prev-story" style="background:rgba(0,0,0,0.5);border:none;color:white;width:40px;height:40px;border-radius:50%;cursor:pointer;"><i class="fas fa-chevron-right"></i></button>
            <button id="next-story" style="background:rgba(0,0,0,0.5);border:none;color:white;width:40px;height:40px;border-radius:50%;cursor:pointer;"><i class="fas fa-chevron-left"></i></button>
        </div>
    `;
    document.body.appendChild(viewer);
    
    db.ref(`users/${group.userId}/name`).once('value').then(s => {
        viewer.querySelector('#story-user-name').textContent = s.val() || 'مستخدم';
    });
    
    let interval, timeout;
    
    function loadStory(i) {
        if (interval) clearInterval(interval);
        if (timeout) clearTimeout(timeout);
        const story = stories[i];
        
        const progress = viewer.querySelector('#story-progress');
        progress.innerHTML = '';
        stories.forEach((_, idx) => {
            const bar = document.createElement('div');
            bar.className = 'story-progress-bar';
            bar.innerHTML = '<div class="fill"></div>';
            if (idx < i) bar.querySelector('.fill').style.width = '100%';
            else if (idx === i) {
                let width = 0;
                interval = setInterval(() => {
                    width += 2;
                    bar.querySelector('.fill').style.width = width + '%';
                    if (width >= 100) clearInterval(interval);
                }, 100);
            }
            progress.appendChild(bar);
        });
        
        const content = viewer.querySelector('#story-content');
        if (story.type === 'text') content.innerHTML = `<div class="story-text">${escapeHtml(story.content)}</div>`;
        else if (story.type === 'image') content.innerHTML = `<img src="${story.media}">`;
        else if (story.type === 'video') content.innerHTML = `<video src="${story.media}" autoplay></video>`;
        
        viewer.querySelector('#story-time').textContent = formatTime(story.createdAt);
        storyManager.viewStory(story.id, currentUser.uid);
        
        timeout = setTimeout(() => {
            if (i + 1 < stories.length) loadStory(i + 1);
            else viewer.remove();
        }, 5000);
    }
    
    viewer.querySelector('#prev-story').onclick = () => { if (index > 0) { index--; loadStory(index); } };
    viewer.querySelector('#next-story').onclick = () => { if (index + 1 < stories.length) { index++; loadStory(index); } else viewer.remove(); };
    viewer.querySelector('#close-viewer').onclick = () => viewer.remove();
    loadStory(0);
}

// ==================== ADMIN ====================
async function showAdmin() {
    if (!isAdmin) return showToast('هذه الميزة للمشرفين فقط');
    const panel = document.getElementById('admin-panel');
    const content = document.getElementById('admin-content-area');
    content.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>';
    panel.style.display = 'flex';
    
    const users = await db.ref('users').once('value');
    const chats = await db.ref('chats').once('value');
    let msgs = 0;
    const allMsgs = await db.ref('messages').once('value');
    allMsgs.forEach(c => msgs += Object.keys(c.val() || {}).length);
    
    content.innerHTML = `
        <div class="admin-stats">
            <div class="stat"><i class="fas fa-users"></i><span>${users.numChildren()}</span><label>مستخدم</label></div>
            <div class="stat"><i class="fas fa-comments"></i><span>${chats.numChildren()}</span><label>محادثة</label></div>
            <div class="stat"><i class="fas fa-envelope"></i><span>${msgs}</span><label>رسالة</label></div>
        </div>
        <div class="admin-users">
            <h4>المستخدمين</h4>
            <div id="admin-users-list"></div>
        </div>
        <div style="padding:16px;border-top:1px solid var(--tg-border);">
            <button id="clear-msgs" class="admin-btn" style="background:var(--tg-red);">مسح كل الرسائل</button>
        </div>
    `;
    
    const list = document.getElementById('admin-users-list');
    users.forEach(snap => {
        const u = snap.val();
        list.innerHTML += `
            <div class="admin-user">
                <span><strong>${escapeHtml(u.name)}</strong><br><small>${u.email}</small></span>
                <button class="admin-btn" data-uid="${snap.key}" style="background:var(--tg-red);">حذف</button>
            </div>
        `;
    });
    
    document.querySelectorAll('[data-uid]').forEach(btn => {
        btn.onclick = async () => {
            if (confirm('حذف المستخدم؟')) {
                await db.ref(`users/${btn.dataset.uid}`).remove();
                showAdmin();
            }
        };
    });
    
    document.getElementById('clear-msgs').onclick = async () => {
        if (confirm('مسح كل الرسائل؟')) {
            await db.ref('messages').remove();
            showAdmin();
            showToast('تم مسح الرسائل');
        }
    };
}

// ==================== UPLOAD ====================
async function uploadFile(file) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`, { method: 'POST', body: fd });
    return await res.json();
}

// ==================== INIT ====================
function initEvents() {
    document.getElementById('login-tab').onclick = () => {
        document.getElementById('login-tab').classList.add('active');
        document.getElementById('register-tab').classList.remove('active');
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('register-form').classList.add('hidden');
    };
    document.getElementById('register-tab').onclick = () => {
        document.getElementById('register-tab').classList.add('active');
        document.getElementById('login-tab').classList.remove('active');
        document.getElementById('register-form').classList.remove('hidden');
        document.getElementById('login-form').classList.add('hidden');
    };
    document.getElementById('login-button').onclick = login;
    document.getElementById('register-button').onclick = register;
    document.getElementById('menu-button').onclick = toggleSidebar;
    document.getElementById('admin-button').onclick = showAdmin;
    document.getElementById('admin-close').onclick = () => document.getElementById('admin-panel').style.display = 'none';
    document.getElementById('new-chat-btn').onclick = createNewChat;
    document.getElementById('send-btn').onclick = sendMessage;
    document.getElementById('back-btn').onclick = () => document.getElementById('sidebar').classList.add('open');
    document.getElementById('message-input').onkeypress = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
    document.getElementById('message-input').oninput = handleTyping;
    document.getElementById('search-input').oninput = (e) => {
        const q = e.target.value.toLowerCase();
        document.querySelectorAll('.chat-item').forEach(item => {
            const name = item.querySelector('.chat-name')?.textContent.toLowerCase();
            item.style.display = name?.includes(q) ? 'flex' : 'none';
        });
    };
    document.querySelectorAll('.tab').forEach(tab => {
        tab.onclick = () => switchTab(tab.dataset.tab);
    });
    document.getElementById('attach-btn').onclick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,video/*';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const data = await uploadFile(file);
            await chatManager.sendMessage(currentChatId, currentUser.uid, '', file.type.startsWith('image') ? 'image' : 'video', data.secure_url);
            showToast('تم الرفع');
        };
        input.click();
    };
    document.getElementById('call-btn').onclick = () => showToast('قريباً');
    document.getElementById('video-call-btn').onclick = () => showToast('قريباً');
}

document.addEventListener('DOMContentLoaded', () => {
    initEvents();
    
    auth.onAuthStateChanged(async user => {
        if (user) {
            currentUser = user;
            const snap = await db.ref(`users/${user.uid}`).once('value');
            if (!snap.exists()) {
                await db.ref(`users/${user.uid}`).set({
                    name: user.email.split('@')[0],
                    email: user.email,
                    createdAt: new Date().toISOString(),
                    status: 'online'
                });
            }
            isAdmin = await checkAdmin(user.email);
            showApp();
            loadChats();
            loadStories();
            callManager.onIncoming(user.uid, (call) => {
                if (confirm(`مكالمة ${call.type === 'voice' ? 'صوتية' : 'فيديو'} واردة`)) {
                    showToast('جاري الرد...');
                }
            });
            setInterval(() => {
                db.ref(`users/${user.uid}/status`).set('online');
                db.ref(`users/${user.uid}/lastSeen`).set(new Date().toISOString());
            }, 30000);
        } else {
            showAuth();
        }
    });
});

window.openImage = (url) => {
    const modal = document.createElement('div');
    modal.className = 'admin-panel';
    modal.style.display = 'flex';
    modal.innerHTML = `<div style="max-width:90%;max-height:90%;"><img src="${url}" style="max-width:100%;max-height:90vh;border-radius:16px;"></div>`;
    modal.onclick = () => modal.remove();
    document.body.appendChild(modal);
};
