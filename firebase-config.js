
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set, onValue, push } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// تهيئة Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAQEHv1K69ZtA48l1TpqUfAIJlmM20gZyA",
  authDomain: "tlgr-1436a.firebaseapp.com",
  databaseURL: "https://tlgr-1436a-default-rtdb.firebaseio.com",
  projectId: "tlgr-1436a",
  storageBucket: "tlgr-1436a.appspot.com",
  messagingSenderId: "128259219683",
  appId: "1:128259219683:web:b59f803204f226a5bda5d6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// التحقق من هوية المشرف
export const isAdmin = (email, password) => {
  return email === "jasim28v@gmail.com" && password === "vv2314vv";
};

// تسجيل مستخدم جديد
export const registerUser = async (email, password, username) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await set(ref(db, 'users/' + user.uid), {
      username: username,
      email: email,
      createdAt: Date.now(),
      isAdmin: isAdmin(email, password)
    });

    return user;
  } catch (error) {
    console.error("خطأ في التسجيل:", error.message);
    throw error;
  }
};

// تسجيل دخول المستخدم
export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // التحقق من هوية المشرف
    const adminStatus = isAdmin(email, password);

    // حفظ حالة المشرف في قاعدة البيانات
    await set(ref(db, 'users/' + user.uid), {
      isAdmin: adminStatus
    });

    return { user, isAdmin: adminStatus };
  } catch (error) {
    console.error("خطأ في تسجيل الدخول:", error.message);
    throw error;
  }
};

// تسجيل الخروج
export const logoutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("خطأ في تسجيل الخروج:", error.message);
    throw error;
  }
};

// إرسال رسالة
export const sendMessage = (chatId, message, sender) => {
  const messagesRef = ref(db, `chats/${chatId}/messages`);
  const newMessageRef = push(messagesRef);

  set(newMessageRef, {
    text: message,
    sender: sender,
    timestamp: Date.now()
  });
};

// استلام الرسائل
export const getMessages = (chatId, callback) => {
  onValue(ref(db, `chats/${chatId}/messages`), (snapshot) => {
    const messages = [];
    snapshot.forEach((childSnapshot) => {
      messages.push(childSnapshot.val());
    });
    callback(messages);
  });
};
