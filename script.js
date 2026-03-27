
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set, onValue, push, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// عناصر DOM
const authSection = document.getElementById('auth-section');
const chatSection = document.getElementById('chat-section');
const adminPanelSection = document.getElementById('admin-panel-section');
const loginForm = document.getElementById('login-form');
const logoutButton = document.getElementById('logout-button');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const messagesContainer = document.getElementById('messages-container');
const chatListItems = document.getElementById('chat-list-items');
const chatUsername = document.getElementById('chat-username');
const chatStatus = document.getElementById('chat-status');
const showUsersButton = document.getElementById('show-users-button');
const showChatsButton = document.getElementById('show-chats-button');
const usersList = document.getElementById('users-list');
const chatsList = document.getElementById('chats-list');

// التحقق من هوية المشرف
const isAdmin = (email, password) => {
  return email === "jasim28v@gmail.com" && password === "vv2314vv";
};

// تسجيل دخول المستخدم
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = loginForm.loginEmail.value;
  const password = loginForm.loginPassword.value;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // التحقق من هوية المشرف
    const adminStatus = isAdmin(email, password);

    // حفظ حالة المشرف في قاعدة البيانات
    await set(ref(db, 'users/' + user.uid), {
      isAdmin: adminStatus
    });

    if (adminStatus) {
      showAdminPanel(user);
    } else {
      showChatSection(user);
    }
  } catch (error) {
    alert('فشل تسجيل الدخول: ' + error.message);
  }
});

// تسجيل الخروج
logoutButton.addEventListener('click', async () => {
  try {
    await signOut(auth);
    showAuthSection();
  } catch (error) {
    alert('فشل تسجيل الخروج: ' + error.message);
  }
});

// إرسال رسالة
sendButton.addEventListener('click', () => {
  const message = messageInput.value.trim();
  if (message) {
    sendMessage("chat1", message, "user1");
    messageInput.value = '';
  }
});

messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const message = messageInput.value.trim();
    if (message) {
      sendMessage("chat1", message, "user1");
      messageInput.value = '';
    }
  }
});

// إرسال رسالة إلى Firebase
const sendMessage = (chatId, message, sender) => {
  const messagesRef = ref(db, `chats/${chatId}/messages`);
  const newMessageRef = push(messagesRef);

  set(newMessageRef, {
    text: message,
    sender: sender,
    timestamp: Date.now()
  });
};

// استلام الرسائل من Firebase
const getMessages = (chatId) => {
  onValue(ref(db, `chats/${chatId}/messages`), (snapshot) => {
    messagesContainer.innerHTML = '';
    snapshot.forEach((childSnapshot) => {
      const message = childSnapshot.val();
      const messageElement = document.createElement('div');
      messageElement.classList.add('message-bubble');
      messageElement.classList.add(message.sender === "user1" ? 'message-out' : 'message-in');
      messageElement.textContent = message.text;
      messagesContainer.appendChild(messageElement);
    });
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });
};

// عرض قائمة المحادثات
const displayChatList = () => {
  onValue(ref(db, 'chats'), (snapshot) => {
    chatListItems.innerHTML = '';
    snapshot.forEach((childSnapshot) => {
      const chat = childSnapshot.val();
      const chatElement = document.createElement('div');
      chatElement.classList.add('chat-list-item', 'p-3', 'flex', 'items-center');
      chatElement.innerHTML = `
        <div class="relative">
          <img src="https://via.placeholder.com/50" class="w-12 h-12 rounded-full">
          <span class="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-chat-bg"></span>
        </div>
        <div class="flex-1 mx-3">
          <div class="flex justify-between items-center">
            <span class="font-medium">${chat.name || 'محادثة جديدة'}</span>
            <span class="text-xs text-text-secondary">م 6:31</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm text-text-secondary">${chat.lastMessage || 'بدء محادثة'}</span>
            <span class="text-xs bg-accent text-white px-2 rounded-full">${chat.unread || 0}</span>
          </div>
        </div>
      `;
      chatElement.addEventListener('click', () => {
        chatUsername.textContent = chat.name || 'محادثة جديدة';
        chatStatus.textContent = 'أونلاين';
        getMessages(childSnapshot.key);
      });
      chatListItems.appendChild(chatElement);
    });
  });
};

// عرض قائمة المستخدمين
showUsersButton.addEventListener('click', () => {
  usersList.classList.toggle('hidden');
  onValue(ref(db, 'users'), (snapshot) => {
    usersList.innerHTML = '<h3 class="font-bold mb-2">قائمة المستخدمين:</h3>';
    snapshot.forEach((childSnapshot) => {
      const user = childSnapshot.val();
      const userElement = document.createElement('div');
      userElement.classList.add('p-2', 'border-b', 'border-gray-700');
      userElement.innerHTML = `
        <p>${user.username || 'مستخدم جديد'} (${user.email})</p>
        <p class="text-sm text-text-secondary">${user.isAdmin ? 'مشرف' : 'مستخدم عادي'}</p>
      `;
      usersList.appendChild(userElement);
    });
  });
});

// عرض قائمة المحادثات في لوحة التحكم
showChatsButton.addEventListener('click', () => {
  chatsList.classList.toggle('hidden');
  onValue(ref(db, 'chats'), (snapshot) => {
    chatsList.innerHTML = '<h3 class="font-bold mb-2">قائمة المحادثات:</h3>';
    snapshot.forEach((childSnapshot) => {
      const chat = childSnapshot.val();
      const chatElement = document.createElement('div');
      chatElement.classList.add('p-2', 'border-b', 'border-gray-700');
      chatElement.innerHTML = `
        <p>${chat.name || 'محادثة جديدة'}</p>
        <p class="text-sm text-text-secondary">آخر رسالة: ${chat.lastMessage || 'بدون رسائل'}</p>
      `;
      chatsList.appendChild(chatElement);
    });
  });
});

// عرض شاشة تسجيل الدخول
function showAuthSection() {
  authSection.style.display = 'flex';
  chatSection.style.display = 'none';
  adminPanelSection.style.display = 'none';
}

// عرض شاشة المحادثات
function showChatSection(user) {
  authSection.style.display = 'none';
  chatSection.style.display = 'flex';
  adminPanelSection.style.display = 'none';
  displayChatList();
}

// عرض لوحة التحكم
function showAdminPanel(user) {
  authSection.style.display = 'none';
  chatSection.style.display = 'none';
  adminPanelSection.style.display = 'block';
}

// التحقق من حالة المستخدم عند تحميل الصفحة
onAuthStateChanged(auth, (user) => {
  if (user) {
    onValue(ref(db, 'users/' + user.uid), (snapshot) => {
      const userData = snapshot.val();
      if (userData && userData.isAdmin) {
        showAdminPanel(user);
      } else {
        showChatSection(user);
      }
    });
  } else {
    showAuthSection();
  }
});
