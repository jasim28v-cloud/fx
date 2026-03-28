import { 
  auth, db, provider, 
  signInWithPopup, onAuthStateChanged, signOut,
  ref, push, onChildAdded, remove, set, onValue 
} from './firebase-config.js';

const CLOUDINARY_ENDPOINT = "https://api.cloudinary.com/v1_1/dnillsbmi/upload";
const CLOUDINARY_PRESET = "ekxzvogb";

let currentUser = null;
const messagesContainer = document.getElementById('messages-container');
const msgInput = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');
const mediaInput = document.getElementById('media-input');
const loginBtn = document.getElementById('login-btn');
const adminControls = document.getElementById('admin-controls');
const nukeBtn = document.getElementById('nuke-btn');
const broadcastBtn = document.getElementById('broadcast-btn');
const typingStatus = document.getElementById('typing-status');

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    loginBtn.innerHTML = `<img src="${user.photoURL}" class="w-10 h-10 rounded-full border-2 border-accent">`;
    if (user.email === 'jasim28v@gmail.com') adminControls.classList.remove('hidden');
  } else {
    currentUser = null;
    loginBtn.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path></svg>`;
    adminControls.classList.add('hidden');
  }
});

loginBtn.onclick = () => currentUser ? signOut(auth) : signInWithPopup(auth, provider);

onChildAdded(ref(db, 'messages'), (snapshot) => {
  renderBubble(snapshot.val());
  messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
});

async function uploadMedia(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_PRESET);
  const res = await fetch(CLOUDINARY_ENDPOINT, { method: 'POST', body: formData });
  const data = await res.json();
  return data.secure_url;
}

mediaInput.onchange = async (e) => {
  const file = e.target.files[0];
  if (!file || !currentUser) return;
  const url = await uploadMedia(file);
  if (url) push(ref(db, 'messages'), {
    senderId: currentUser.uid,
    senderName: currentUser.displayName,
    type: 'media',
    mediaUrl: url,
    mimeType: file.type,
    timestamp: Date.now()
  });
};

function renderBubble(msg) {
  const isMe = currentUser && msg.senderId === currentUser.uid;
  const bubble = document.createElement('div');
  bubble.className = `max-w-[80%] relative p-3 rounded-2xl ${isMe ? 'bg-bubble-me self-start rounded-bl-none' : 'bg-bubble-them self-end rounded-br-none'}`;
  
  const tail = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  tail.setAttribute("viewBox", "0 0 10 10");
  tail.className = `bubble-tail ${isMe ? 'bubble-tail-me' : 'bubble-tail-them'}`;
  tail.innerHTML = `<path d="M0 0 L10 10 L0 10 Z"></path>`;
  bubble.appendChild(tail);

  let content = msg.type === 'media' 
    ? (msg.mimeType.startsWith('image/') ? `<img src="${msg.mediaUrl}" class="rounded-lg max-h-64">` : `<video src="${msg.mediaUrl}" controls class="rounded-lg max-h-64">`)
    : `<p class="text-sm">${msg.text}</p>`;

  bubble.innerHTML += `${!isMe ? `<span class="text-xs font-bold text-accent block mb-1">${msg.senderName}</span>` : ''}${content}`;
  messagesContainer.appendChild(bubble);
}

sendBtn.onclick = () => {
  const text = msgInput.value.trim();
  if (!text || !currentUser) return;
  push(ref(db, 'messages'), { senderId: currentUser.uid, senderName: currentUser.displayName, type: 'text', text, timestamp: Date.now() });
  msgInput.value = '';
};

nukeBtn.onclick = () => confirm('حذف جميع الرسائل؟') && remove(ref(db, 'messages')) && (messagesContainer.innerHTML = '');

broadcastBtn.onclick = () => {
  const text = prompt('رسالة البث:');
  if (text) push(ref(db, 'messages'), { senderId: 'system', senderName: 'نظام البث', type: 'text', text: `📢 ${text}`, timestamp: Date.now() });
};
