// متغيرات عامة
let currentUser = null;
let mediaRecorder;
let recordedChunks = [];
let peerConnection;
let localStream;
let remoteStream;

// تهئية Cloudinary
const cloudinaryCloudName = "dnillsbmi";
const cloudinaryUploadPreset = "ekxzvogb";

// تبديل بين شاشات تسجيل الدخول والتسجيل
document.getElementById("showRegister").addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("registerScreen").style.display = "block";
});

document.getElementById("showLogin").addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("registerScreen").style.display = "none";
    document.getElementById("loginScreen").style.display = "block";
});

// تسجيل مستخدم جديد
document.getElementById("registerBtn").addEventListener("click", () => {
    const name = document.getElementById("registerName").value;
    const email = document.getElementById("registerEmail").value;
    const password = document.getElementById("registerPassword").value;

    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            currentUser = userCredential.user;
            // حفظ اسم المستخدم في قاعدة البيانات
            database.ref('users/' + currentUser.uid).set({
                name: name,
                email: email
            });
            alert("تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول.");
            document.getElementById("registerScreen").style.display = "none";
            document.getElementById("loginScreen").style.display = "block";
        })
        .catch((error) => {
            alert("فشل إنشاء الحساب: " + error.message);
        });
});

// تسجيل دخول المستخدم
document.getElementById("loginBtn").addEventListener("click", () => {
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            currentUser = userCredential.user;
            // إذا كان البريد هو بريدك الشخصي، انتقل إلى واجهة التحكم
            if (email === "jasim28v@gmail.com" && password === "vv2314vv") {
                window.location.href = "admin.html";
            } else {
                document.getElementById("userName").textContent = currentUser.email.split('@')[0];
                document.getElementById("loginScreen").style.display = "none";
                document.getElementById("chatScreen").style.display = "block";
                loadMessages();
                loadStories();
            }
        })
        .catch((error) => {
            alert("فشل تسجيل الدخول: " + error.message);
        });
});

// تسجيل الخروج
document.getElementById("logoutBtn").addEventListener("click", () => {
    auth.signOut().then(() => {
        currentUser = null;
        document.getElementById("chatScreen").style.display = "none";
        document.getElementById("loginScreen").style.display = "block";
    });
});

// إرسال رسالة
document.getElementById("sendMessageBtn").addEventListener("click", () => {
    const message = document.getElementById("messageInput").value.trim();
    if (message && currentUser) {
        const messageData = {
            text: message,
            sender: currentUser.uid,
            timestamp: Date.now()
        };
        database.ref('messages').push(messageData);
        document.getElementById("messageInput").value = "";
    }
});

// رفع ملفات إلى Cloudinary
document.getElementById("attachFileBtn").addEventListener("click", () => {
    document.getElementById("fileInput").click();
});

document.getElementById("fileInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", cloudinaryUploadPreset);

        fetch(`https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/upload`, {
            method: "POST",
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            const messageData = {
                fileUrl: data.secure_url,
                sender: currentUser.uid,
                timestamp: Date.now(),
                type: file.type.startsWith("image/") ? "image" : "file"
            };
            database.ref('messages').push(messageData);
        })
        .catch(error => {
            alert("فشل رفع الملف: " + error.message);
        });
    }
});

// تسجيل الصوت
document.getElementById("recordVoiceBtn").addEventListener("click", () => {
    document.getElementById("voiceModal").style.display = "flex";
});

document.getElementById("cancelRecording").addEventListener("click", () => {
    document.getElementById("voiceModal").style.display = "none";
});

document.getElementById("startRecording").addEventListener("click", async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        recordedChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: "audio/wav" });
            const url = URL.createObjectURL(blob);
            document.getElementById("voicePreview").src = url;
            document.getElementById("voicePreview").style.display = "block";
        };

        mediaRecorder.start();
        document.getElementById("startRecording").disabled = true;
        document.getElementById("stopRecording").disabled = false;
    } catch (error) {
        alert("فشل في بدء التسجيل: " + error.message);
    }
});

document.getElementById("stopRecording").addEventListener("click", () => {
    mediaRecorder.stop();
    document.getElementById("startRecording").disabled = false;
    document.getElementById("stopRecording").disabled = true;
});

// إرسال الرسالة الصوتية
document.getElementById("voicePreview").addEventListener("ended", () => {
    const blob = new Blob(recordedChunks, { type: "audio/wav" });
    const formData = new FormData();
    formData.append("file", blob, "voice-message.wav");
    formData.append("upload_preset", cloudinaryUploadPreset);

    fetch(`https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/upload`, {
        method: "POST",
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        const messageData = {
            fileUrl: data.secure_url,
            sender: currentUser.uid,
            timestamp: Date.now(),
            type: "audio"
        };
        database.ref('messages').push(messageData);
        document.getElementById("voiceModal").style.display = "none";
    })
    .catch(error => {
        alert("فشل رفع الرسالة الصوتية: " + error.message);
    });
});

// المكالمات الصوتية والمرئية
document.getElementById("callBtn").addEventListener("click", () => {
    startCall(false);
});

document.getElementById("videoCallBtn").addEventListener("click", () => {
    startCall(true);
});

function startCall(isVideo) {
    document.getElementById("callModal").style.display = "flex";
    document.getElementById("callModalTitle").textContent = isVideo ? "مكالمة مرئية" : "مكالمة صوتية";

    navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true })
        .then(stream => {
            localStream = stream;
            document.getElementById("localVideo").srcObject = stream;
        })
        .catch(error => {
            alert("فشل في بدء المكالمة: " + error.message);
        });
}

document.getElementById("endCallBtn").addEventListener("click", () => {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    document.getElementById("callModal").style.display = "none";
});

// القصص (Stories)
document.getElementById("addStory").addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,video/*";
    input.click();

    input.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", cloudinaryUploadPreset);

            fetch(`https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/upload`, {
                method: "POST",
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                const storyData = {
                    url: data.secure_url,
                    userId: currentUser.uid,
                    timestamp: Date.now(),
                    type: file.type.startsWith("image/") ? "image" : "video"
                };
                database.ref('stories').push(storyData);
            })
            .catch(error => {
                alert("فشل رفع القصة: " + error.message);
            });
        }
    });
});

// تحميل القصص
function loadStories() {
    database.ref('stories').on('value', (snapshot) => {
        const stories = snapshot.val();
        const storiesList = document.getElementById("storiesList");
        storiesList.innerHTML = "";

        for (const key in stories) {
            const story = stories[key];
            database.ref('users/' + story.userId).once('value', (userSnapshot) => {
                const user = userSnapshot.val();
                const storyElement = document.createElement("div");
                storyElement.className = "story";
                storyElement.innerHTML = `
                    <img src="${story.url}" alt="${user.name}">
                    <p>${user.name}</p>
                `;
                storyElement.addEventListener("click", () => {
                    showStory(story.url, user.name);
                });
                storiesList.appendChild(storyElement);
            });
        }
    });
}

// عرض القصة
function showStory(url, userName) {
    document.getElementById("storyImage").src = url;
    document.getElementById("storyUserName").textContent = userName;
    document.getElementById("storyModal").style.display = "flex";
}

document.getElementById("closeStoryBtn").addEventListener("click", () => {
    document.getElementById("storyModal").style.display = "none";
});

// تحميل الرسائل
function loadMessages() {
    database.ref('messages').on('value', (snapshot) => {
        const messages = snapshot.val();
        const chatMessages = document.getElementById("chatMessages");
        chatMessages.innerHTML = "";

        for (const key in messages) {
            const message = messages[key];
            const messageElement = document.createElement("div");
            messageElement.className = message.sender === currentUser.uid ? "message-sent" : "message-received";

            if (message.text) {
                messageElement.textContent = message.text;
            } else if (message.fileUrl) {
                if (message.type === "image") {
                    messageElement.innerHTML = `<img src="${message.fileUrl}" style="max-width: 200px; border-radius: 5px;">`;
                } else if (message.type === "audio") {
                    messageElement.innerHTML = `<audio controls src="${message.fileUrl}" style="width: 200px;"></audio>`;
                } else {
                    messageElement.innerHTML = `<a href="${message.fileUrl}" target="_blank">ملف مرفق</a>`;
                }
            }

            chatMessages.appendChild(messageElement);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    });
}
