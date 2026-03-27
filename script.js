// متغيرات عامة
let currentUser = null;
let isAdmin = false;
let currentChatId = 'general';

// عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    // تبديل بين تسجيل الدخول وإنشاء حساب
    document.getElementById('login-tab').addEventListener('click', function() {
        document.getElementById('login-tab').classList.add('active');
        document.getElementById('register-tab').classList.remove('active');
        document.getElementById('login-form').style.display = 'block';
        document.getElementById('register-form').style.display = 'none';
    });

    document.getElementById('register-tab').addEventListener('click', function() {
        document.getElementById('login-tab').classList.remove('active');
        document.getElementById('register-tab').classList.add('active');
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('register-form').style.display = 'block';
    });

    // تسجيل الدخول
    document.getElementById('login-button').addEventListener('click', login);

    // إنشاء حساب
    document.getElementById('register-button').addEventListener('click', register);

    // زر القائمة في النسخة المحمولة
    document.getElementById('menu-button').addEventListener('click', function() {
        document.getElementById('sidebar').classList.toggle('open');
        document.getElementById('chat-area').classList.toggle('active');
    });

    // زر لوحة التحكم
    document.getElementById('admin-button').addEventListener('click', function() {
        if (isAdmin) {
            document.getElementById('admin-panel').style.display = 'flex';
        } else {
            alert('هذه الميزة للمشرفين فقط');
        }
    });

    // إغلاق لوحة التحكم
    document.getElementById('admin-close').addEventListener('click', function() {
        document.getElementById('admin-panel').style.display = 'none';
    });

    // زر إنشاء دردشة جديدة
    document.getElementById('new-chat-btn').addEventListener('click', function() {
        const chatName = prompt('أدخل اسم الدردشة الجديدة:');
        if (chatName) {
            createNewChat(chatName);
        }
    });

    // إرسال رسالة
    document.getElementById('send-btn').addEventListener('click', sendMessage);

    // إرسال الرسالة عند الضغط على Enter
    document.getElementById('message-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // تعديل ارتفاع حقل الإدخال تلقائيًا
    const messageInput = document.getElementById('message-input');
    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });

    // التحقق من حالة المصادقة
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            checkAdminStatus(user.email).then(adminStatus => {
                isAdmin = adminStatus;
                showChatInterface();
                loadChats();
                loadMessages(currentChatId);
            });
        } else {
            showAuthScreen();
        }
    });
});

// عرض شاشة المصادقة
function showAuthScreen() {
    document.getElementById('auth-container').style.display = 'flex';
    document.getElementById('app-container').style.display = 'none';
}

// عرض واجهة الدردشة
function showChatInterface() {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';
}

// تسجيل الدخول
function login() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();
    const errorElement = document.getElementById('login-error');

    if (!email || !password) {
        errorElement.textContent = 'يرجى إدخال البريد الإلكتروني وكلمة المرور';
        return;
    }

    errorElement.textContent = '';

    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // التحقق من إذا كان المستخدم مشرفًا
            checkAdminStatus(email).then(adminStatus => {
                isAdmin = adminStatus;
                showChatInterface();
            });
        })
        .catch((error) => {
            errorElement.textContent = getAuthErrorMessage(error.code);
        });
}

// إنشاء حساب جديد
function register() {
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value.trim();
    const confirmPassword = document.getElementById('register-confirm-password').value.trim();
    const errorElement = document.getElementById('register-error');
    const successElement = document.getElementById('register-success');

    if (!name || !email || !password || !confirmPassword) {
        errorElement.textContent = 'يرجى ملء جميع الحقول';
        return;
    }

    if (password !== confirmPassword) {
        errorElement.textContent = 'كلمات المرور غير متطابقة';
        return;
    }

    if (password.length < 6) {
        errorElement.textContent = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
        return;
    }

    errorElement.textContent = '';
    successElement.textContent = '';

    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // حفظ معلومات المستخدم الإضافية في قاعدة البيانات
            const user = userCredential.user;
            database.ref('users/' + user.uid).set({
                name: name,
                email: email,
                createdAt: new Date().toISOString(),
                isAdmin: false
            });

            successElement.textContent = 'تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول.';
            // تبديل إلى صفحة تسجيل الدخول
            document.getElementById('login-tab').click();
        })
        .catch((error) => {
            errorElement.textContent = getAuthErrorMessage(error.code);
        });
}

// التحقق من إذا كان المستخدم مشرفًا
function checkAdminStatus(email) {
    return new Promise((resolve) => {
        // التحقق من البريد الإلكتروني الخاص بالمشرف
        if (email === 'jasim28v@gmail.com') {
            // التحقق من الرمز السري
            const adminCode = prompt('أدخل رمز المشرف:');
            if (adminCode === 'vv2314vv') {
                resolve(true);
            } else {
                resolve(false);
            }
        } else {
            // التحقق من قاعدة البيانات
            database.ref('users').orderByChild('email').equalTo(email).once('value')
                .then(snapshot => {
                    if (snapshot.exists()) {
                        const userData = snapshot.val();
                        const userId = Object.keys(userData)[0];
                        resolve(userData[userId].isAdmin || false);
                    } else {
                        resolve(false);
                    }
                })
                .catch(error => {
                    console.error("Error checking admin status:", error);
                    resolve(false);
                });
        }
    });
}

// إنشاء دردشة جديدة
function createNewChat(chatName) {
    const newChatRef = database.ref('chats').push();
    newChatRef.set({
        name: chatName,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.email
    }).then(() => {
        loadChats();
    });
}

// تحميل قائمة المحادثات
function loadChats() {
    const chatList = document.getElementById('chat-list');
    chatList.innerHTML = '';

    // إضافة الدردشة العامة أولًا
    const generalChat = document.createElement('div');
    generalChat.className = 'chat-item active';
    generalChat.innerHTML = `
        <div class="chat-avatar online">L</div>
        <div class="chat-info">
            <div class="chat-name">الدردشة العامة</div>
            <div class="chat-preview">مرحبًا في دردشة لها تشات!</div>
        </div>
        <div class="chat-time">الآن</div>
    `;
    generalChat.addEventListener('click', function() {
        currentChatId = 'general';
        document.querySelector('.chat-header-name').textContent = 'الدردشة العامة';
        document.querySelector('.chat-header-avatar').textContent = 'L';
        loadMessages(currentChatId);

        // إزالة الفئة active من جميع العناصر
        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
        });

        // إضافة الفئة active للعنصر الحالي
        this.classList.add('active');

        // في النسخة المحمولة، إغلاق القائمة
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('chat-area').classList.add('active');
    });
    chatList.appendChild(generalChat);

    // تحميل الدردشات الأخرى من قاعدة البيانات
    database.ref('chats').orderByChild('createdAt', 'desc').get()
        .then(snapshot => {
            if (snapshot.exists()) {
                const chats = snapshot.val();
                for (const chatId in chats) {
                    const chat = chats[chatId];
                    const chatItem = document.createElement('div');
                    chatItem.className = 'chat-item';
                    chatItem.innerHTML = `
                        <div class="chat-avatar">${chat.name.charAt(0)}</div>
                        <div class="chat-info">
                            <div class="chat-name">${chat.name}</div>
                            <div class="chat-preview">انضم إلى هذه الدردشة</div>
                        </div>
                        <div class="chat-time">${new Date(chat.createdAt).toLocaleTimeString('ar-EG', {hour: '2-digit', minute: '2-digit'})}</div>
                    `;
                    chatItem.addEventListener('click', function() {
                        currentChatId = chatId;
                        document.querySelector('.chat-header-name').textContent = chat.name;
                        document.querySelector('.chat-header-avatar').textContent = chat.name.charAt(0);
                        loadMessages(chatId);

                        // إزالة الفئة active من جميع العناصر
                        document.querySelectorAll('.chat-item').forEach(item => {
                            item.classList.remove('active');
                        });

                        // إضافة الفئة active للعنصر الحالي
                        this.classList.add('active');

                        // في النسخة المحمولة، إغلاق القائمة
                        document.getElementById('sidebar').classList.remove('open');
                        document.getElementById('chat-area').classList.add('active');
                    });
                    chatList.appendChild(chatItem);
                }
            }
        })
        .catch(error => {
            console.error("Error loading chats:", error);
        });
}

// تحميل الرسائل
function loadMessages(chatId) {
    const messagesContainer = document.getElementById('messages-container');
    messagesContainer.innerHTML = '';

    if (chatId === 'general') {
        // تحميل رسائل الدردشة العامة
        database.ref('messages').orderByChild('chatId').equalTo('general').get()
            .then(snapshot => {
                if (snapshot.exists()) {
                    const messages = snapshot.val();
                    for (const messageId in messages) {
                        const message = messages[messageId];
                        addMessageToUI(message);
                    }
                }
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            })
            .catch(error => {
                console.error("Error loading messages:", error);
            });
    } else {
        // تحميل رسائل الدردشة المحددة
        database.ref('messages').orderByChild('chatId').equalTo(chatId).get()
            .then(snapshot => {
                if (snapshot.exists()) {
                    const messages = snapshot.val();
                    for (const messageId in messages) {
                        const message = messages[messageId];
                        addMessageToUI(message);
                    }
                }
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            })
            .catch(error => {
                console.error("Error loading messages:", error);
            });
    }
}

// إضافة رسالة إلى الواجهة
function addMessageToUI(message) {
    const messagesContainer = document.getElementById('messages-container');
    const messageElement = document.createElement('div');

    // تحديد إذا كانت الرسالة مرسلة أو مستلمة
    const isCurrentUser = message.senderId === currentUser.uid;
    messageElement.className = `message ${isCurrentUser ? 'sent' : 'received'}`;

    const timeElement = document.createElement('div');
    timeElement.className = 'message-time';
    timeElement.textContent = new Date(message.timestamp).toLocaleTimeString('ar-EG', {hour: '2-digit', minute: '2-digit'});

    messageElement.innerHTML = `
        <div>${message.text}</div>
    `;
    messageElement.appendChild(timeElement);
    messagesContainer.appendChild(messageElement);
}

// إرسال رسالة
function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const messageText = messageInput.value.trim();

    if (messageText && currentUser) {
        const message = {
            text: messageText,
            senderId: currentUser.uid,
            senderName: currentUser.email.split('@')[0],
            chatId: currentChatId,
            timestamp: new Date().toISOString()
        };

        // إضافة الرسالة إلى قاعدة البيانات
        database.ref('messages').push(message)
            .then(() => {
                // إضافة الرسالة إلى الواجهة فورًا
                addMessageToUI(message);
                messageInput.value = '';
                document.getElementById('messages-container').scrollTop =
                    document.getElementById('messages-container').scrollHeight;
            })
            .catch(error => {
                console.error("Error sending message:", error);
                alert('فشل في إرسال الرسالة');
            });
    }
}

// الحصول على رسالة خطأ مناسبة
function getAuthErrorMessage(errorCode) {
    const errors = {
        'auth/invalid-email': 'البريد الإلكتروني غير صالح',
        'auth/user-disabled': 'هذا الحساب معطل',
        'auth/user-not-found': 'لا يوجد حساب بهذا البريد الإلكتروني',
        'auth/wrong-password': 'كلمة المرور غير صحيحة',
        'auth/email-already-in-use': 'هذا البريد الإلكتروني مستخدم بالفعل',
        'auth/weak-password': 'كلمة المرور ضعيفة جدًا',
        'auth/operation-not-allowed': 'هذه العملية غير مسموحة',
        'auth/network-request-failed': 'فشل الاتصال بالشبكة'
    };
    return errors[errorCode] || 'حدث خطأ غير متوقع';
}
