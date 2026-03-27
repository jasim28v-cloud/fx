// متغيرات عامة
let currentUser = null;
let isAdmin = false;

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

    // تسجيل الخروج
    document.getElementById('logout-btn').addEventListener('click', logout);

    // إدارة المستخدمين
    document.getElementById('manage-users-btn').addEventListener('click', function() {
        loadAdminContent('users');
    });

    // إدارة الدردشات
    document.getElementById('manage-chats-btn').addEventListener('click', function() {
        loadAdminContent('chats');
    });

    // إدارة الملفات على Cloudinary
    document.getElementById('cloudinary-btn').addEventListener('click', function() {
        loadAdminContent('cloudinary');
    });

    // التحقق من حالة المصادقة
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            checkAdminStatus(user.email).then(adminStatus => {
                isAdmin = adminStatus;
                if (isAdmin) {
                    showAdminPanel();
                } else {
                    showRegularChat();
                }
            });
        } else {
            showAuthScreen();
        }
    });
});

// عرض شاشة المصادقة
function showAuthScreen() {
    document.getElementById('auth-container').style.display = 'flex';
    document.getElementById('chat-container').style.display = 'none';
}

// عرض لوحة تحكم المشرف
function showAdminPanel() {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('chat-container').style.display = 'block';
    document.getElementById('admin-panel').style.display = 'block';
    document.getElementById('regular-chat').style.display = 'none';
}

// عرض واجهة الدردشة العادية
function showRegularChat() {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('chat-container').style.display = 'block';
    document.getElementById('admin-panel').style.display = 'none';
    document.getElementById('regular-chat').style.display = 'block';
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
                if (isAdmin) {
                    showAdminPanel();
                } else {
                    showRegularChat();
                }
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

// تسجيل الخروج
function logout() {
    auth.signOut()
        .then(() => {
            showAuthScreen();
        })
        .catch((error) => {
            console.error("Error during logout:", error);
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

// تحميل محتوى لوحة التحكم
function loadAdminContent(type) {
    const adminContent = document.getElementById('admin-content');
    adminContent.innerHTML = '<h3>جاري التحميل...</h3>';

    switch(type) {
        case 'users':
            loadUsersManagement();
            break;
        case 'chats':
            loadChatsManagement();
            break;
        case 'cloudinary':
            loadCloudinaryManagement();
            break;
        default:
            adminContent.innerHTML = '<h3>اختر قسمًا للإدارة</h3>';
    }
}

// إدارة المستخدمين
function loadUsersManagement() {
    const adminContent = document.getElementById('admin-content');
    adminContent.innerHTML = `
        <h3>إدارة المستخدمين</h3>
        <div style="margin-bottom: 15px;">
            <input type="text" id="search-users" placeholder="بحث عن مستخدم..." style="padding: 8px; width: 300px; border: 1px solid #ddd; border-radius: 4px;">
            <button id="add-user-btn" class="form-button" style="display: inline-block; width: auto; margin-left: 10px;">إضافة مستخدم جديد</button>
        </div>
        <div id="users-table-container">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background-color: #f8f9fa;">
                        <th style="padding: 10px; text-align: right;">الاسم</th>
                        <th style="padding: 10px; text-align: right;">البريد الإلكتروني</th>
                        <th style="padding: 10px; text-align: right;">تاريخ الإنشاء</th>
                        <th style="padding: 10px; text-align: right;">مشرف</th>
                        <th style="padding: 10px; text-align: center;">إجراءات</th>
                    </tr>
                </thead>
                <tbody id="users-table-body">
                    <!-- سيتم إضافة المستخدمين هنا -->
                </tbody>
            </table>
        </div>
    `;

    // تحميل المستخدمين من قاعدة البيانات
    database.ref('users').once('value')
        .then(snapshot => {
            const usersTable = document.getElementById('users-table-body');
            usersTable.innerHTML = '';

            if (snapshot.exists()) {
                const users = snapshot.val();
                for (const userId in users) {
                    const user = users[userId];
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td style="padding: 10px; text-align: right;">${user.name || 'غير محدد'}</td>
                        <td style="padding: 10px; text-align: right;">${user.email}</td>
                        <td style="padding: 10px; text-align: right;">${new Date(user.createdAt).toLocaleString('ar-EG')}</td>
                        <td style="padding: 10px; text-align: right;">${user.isAdmin ? 'نعم' : 'لا'}</td>
                        <td style="padding: 10px; text-align: center;">
                            <button onclick="editUser('${userId}')" style="background: none; border: none; color: var(--primary); cursor: pointer; margin-right: 10px;">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="deleteUser('${userId}')" style="background: none; border: none; color: var(--danger); cursor: pointer;">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    `;
                    usersTable.appendChild(row);
                }
            } else {
                usersTable.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">لا يوجد مستخدمين مسجلين</td></tr>';
            }
        })
        .catch(error => {
            console.error("Error loading users:", error);
            document.getElementById('users-table-body').innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">حدث خطأ أثناء تحميل المستخدمين</td></tr>';
        });

    // إضافة حدث للبحث
    document.getElementById('search-users').addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('#users-table-body tr');

        rows.forEach(row => {
            const name = row.cells[0].textContent.toLowerCase();
            const email = row.cells[1].textContent.toLowerCase();
            if (name.includes(searchTerm) || email.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    });

    // إضافة حدث لإضافة مستخدم جديد
    document.getElementById('add-user-btn').addEventListener('click', function() {
        const name = prompt('أدخل اسم المستخدم الجديد:');
        const email = prompt('أدخل البريد الإلكتروني للمستخدم الجديد:');
        const password = prompt('أدخل كلمة المرور للمستخدم الجديد:');
        const isAdmin = confirm('هل هذا المستخدم مشرف؟');

        if (name && email && password) {
            auth.createUserWithEmailAndPassword(email, password)
                .then(userCredential => {
                    const user = userCredential.user;
                    database.ref('users/' + user.uid).set({
                        name: name,
                        email: email,
                        createdAt: new Date().toISOString(),
                        isAdmin: isAdmin
                    }).then(() => {
                        alert('تم إضافة المستخدم بنجاح!');
                        loadUsersManagement();
                    });
                })
                .catch(error => {
                    alert('حدث خطأ أثناء إضافة المستخدم: ' + getAuthErrorMessage(error.code));
                });
        }
    });
}

// تعديل مستخدم
function editUser(userId) {
    database.ref('users/' + userId).once('value')
        .then(snapshot => {
            const user = snapshot.val();
            const newName = prompt('أدخل الاسم الجديد:', user.name);
            const newEmail = prompt('أدخل البريد الإلكتروني الجديد:', user.email);
            const newAdminStatus = confirm(`هل هذا المستخدم مشرف؟ (حاليًا: ${user.isAdmin ? 'نعم' : 'لا'})`);

            if (newName && newEmail) {
                const updates = {
                    name: newName,
                    email: newEmail,
                    isAdmin: newAdminStatus
                };

                database.ref('users/' + userId).update(updates)
                    .then(() => {
                        alert('تم تحديث المستخدم بنجاح!');
                        loadUsersManagement();
                    })
                    .catch(error => {
                        alert('حدث خطأ أثناء تحديث المستخدم: ' + error.message);
                    });
            }
        });
}

// حذف مستخدم
function deleteUser(userId) {
    if (confirm('هل أنت متأكد من أنك تريد حذف هذا المستخدم؟')) {
        database.ref('users/' + userId).remove()
            .then(() => {
                alert('تم حذف المستخدم بنجاح!');
                loadUsersManagement();
            })
            .catch(error => {
                alert('حدث خطأ أثناء حذف المستخدم: ' + error.message);
            });
    }
}

// إدارة الدردشات
function loadChatsManagement() {
    const adminContent = document.getElementById('admin-content');
    adminContent.innerHTML = `
        <h3>إدارة الدردشات</h3>
        <div style="margin-bottom: 15px;">
            <input type="text" id="search-chats" placeholder="بحث عن دردشة..." style="padding: 8px; width: 300px; border: 1px solid #ddd; border-radius: 4px;">
            <button id="add-chat-btn" class="form-button" style="display: inline-block; width: auto; margin-left: 10px;">إنشاء دردشة جديدة</button>
        </div>
        <div id="chats-table-container">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background-color: #f8f9fa;">
                        <th style="padding: 10px; text-align: right;">اسم الدردشة</th>
                        <th style="padding: 10px; text-align: right;">أنشئت بواسطة</th>
                        <th style="padding: 10px; text-align: right;">تاريخ الإنشاء</th>
                        <th style="padding: 10px; text-align: center;">إجراءات</th>
                    </tr>
                </thead>
                <tbody id="chats-table-body">
                    <!-- سيتم إضافة الدردشات هنا -->
                </tbody>
            </table>
        </div>
    `;

    // تحميل الدردشات من قاعدة البيانات
    database.ref('chats').once('value')
        .then(snapshot => {
            const chatsTable = document.getElementById('chats-table-body');
            chatsTable.innerHTML = '';

            if (snapshot.exists()) {
                const chats = snapshot.val();
                for (const chatId in chats) {
                    const chat = chats[chatId];
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td style="padding: 10px; text-align: right;">${chat.name}</td>
                        <td style="padding: 10px; text-align: right;">${chat.createdBy || 'غير محدد'}</td>
                        <td style="padding: 10px; text-align: right;">${new Date(chat.createdAt).toLocaleString('ar-EG')}</td>
                        <td style="padding: 10px; text-align: center;">
                            <button onclick="editChat('${chatId}')" style="background: none; border: none; color: var(--primary); cursor: pointer; margin-right: 10px;">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="deleteChat('${chatId}')" style="background: none; border: none; color: var(--danger); cursor: pointer;">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    `;
                    chatsTable.appendChild(row);
                }
            } else {
                chatsTable.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">لا يوجد دردشات مسجلة</td></tr>';
            }
        })
        .catch(error => {
            console.error("Error loading chats:", error);
            document.getElementById('chats-table-body').innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">حدث خطأ أثناء تحميل الدردشات</td></tr>';
        });

    // إضافة حدث للبحث
    document.getElementById('search-chats').addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('#chats-table-body tr');

        rows.forEach(row => {
            const name = row.cells[0].textContent.toLowerCase();
            if (name.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    });

    // إضافة حدث لإنشاء دردشة جديدة
    document.getElementById('add-chat-btn').addEventListener('click', function() {
        const name = prompt('أدخل اسم الدردشة الجديدة:');

        if (name) {
            const newChatRef = database.ref('chats').push();
            newChatRef.set({
                name: name,
                createdAt: new Date().toISOString(),
                createdBy: currentUser.email
            }).then(() => {
                alert('تم إنشاء الدردشة بنجاح!');
                loadChatsManagement();
            });
        }
    });
}

// تعديل دردشة
function editChat(chatId) {
    database.ref('chats/' + chatId).once('value')
        .then(snapshot => {
            const chat = snapshot.val();
            const newName = prompt('أدخل الاسم الجديد للدردشة:', chat.name);

            if (newName) {
                database.ref('chats/' + chatId).update({
                    name: newName
                }).then(() => {
                    alert('تم تحديث الدردشة بنجاح!');
                    loadChatsManagement();
                });
            }
        });
}

// حذف دردشة
function deleteChat(chatId) {
    if (confirm('هل أنت متأكد من أنك تريد حذف هذه الدردشة؟')) {
        database.ref('chats/' + chatId).remove()
            .then(() => {
                alert('تم حذف الدردشة بنجاح!');
                loadChatsManagement();
            })
            .catch(error => {
                alert('حدث خطأ أثناء حذف الدردشة: ' + error.message);
            });
    }
}

// إدارة ملفات Cloudinary
function loadCloudinaryManagement() {
    const adminContent = document.getElementById('admin-content');
    adminContent.innerHTML = `
        <h3>إدارة ملفات Cloudinary</h3>
        <div style="margin-bottom: 20px;">
            <p>يمكنك رفع الملفات إلى Cloudinary باستخدام الرابط التالي:</p>
            <p><a href="https://collection.cloudinary.com/dnillsbmi" target="_blank">https://collection.cloudinary.com/dnillsbmi</a></p>
            <p>معرف التحميل: ekxzvogb</p>
        </div>

        <div style="margin-bottom: 20px;">
            <h4>رفع ملف جديد</h4>
            <input type="file" id="file-upload" style="margin-bottom: 10px;">
            <button id="upload-btn" class="form-button" style="display: inline-block; width: auto;">رفع الملف</button>
            <div id="upload-status" style="margin-top: 10px;"></div>
        </div>

        <div>
            <h4>الملفات الأخيرة</h4>
            <div id="cloudinary-files" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; margin-top: 15px;"></div>
        </div>
    `;

    // إضافة حدث لرفع الملفات
    document.getElementById('upload-btn').addEventListener('click', uploadToCloudinary);

    // عرض بعض الملفات الوهمية (في النسخة الحقيقية، ستقوم بجلب الملفات من Cloudinary)
    const filesContainer = document.getElementById('cloudinary-files');
    for (let i = 1; i <= 6; i++) {
        const fileDiv = document.createElement('div');
        fileDiv.style.border = '1px solid #ddd';
        fileDiv.style.padding = '10px';
        fileDiv.style.borderRadius = '5px';
        fileDiv.style.textAlign = 'center';
        fileDiv.innerHTML = `
            <img src="https://res.cloudinary.com/dnillsbmi/image/upload/v1/sample.jpg" style="width: 100%; height: 120px; object-fit: cover; margin-bottom: 5px;">
            <p style="font-size: 12px;">file${i}.jpg</p>
            <button style="background: none; border: none; color: var(--danger); cursor: pointer; font-size: 12px;" onclick="deleteCloudinaryFile('file${i}')">
                <i class="fas fa-trash"></i> حذف
            </button>
        `;
        filesContainer.appendChild(fileDiv);
    }
}

// رفع ملف إلى Cloudinary
function uploadToCloudinary() {
    const fileInput = document.getElementById('file-upload');
    const statusElement = document.getElementById('upload-status');
    const file = fileInput.files[0];

    if (!file) {
        statusElement.textContent = 'يرجى اختيار ملف أولًا';
        statusElement.style.color = 'var(--danger)';
        return;
    }

    statusElement.textContent = 'جاري رفع الملف...';
    statusElement.style.color = 'var(--text-secondary)';

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'ekxzvogb');

    fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        statusElement.textContent = 'تم رفع الملف بنجاح!';
        statusElement.style.color = 'var(--success)';
        console.log('File uploaded:', data);
        // في النسخة الحقيقية، ستقوم بإضافة الملف إلى قائمة الملفات
    })
    .catch(error => {
        statusElement.textContent = 'فشل في رفع الملف: ' + error.message;
        statusElement.style.color = 'var(--danger)';
        console.error('Error uploading file:', error);
    });
}

// حذف ملف من Cloudinary
function deleteCloudinaryFile(fileId) {
    if (confirm('هل أنت متأكد من أنك تريد حذف هذا الملف؟')) {
        // في النسخة الحقيقية، ستقوم بحذف الملف من Cloudinary
        alert('تم حذف الملف بنجاح (هذه ميزة وهمية في النسخة التجريبية)');
    }
}

// الحصول على رسالة خطأ مناسبة
function getAuthErrorMessage(errorCode) {
    switch(errorCode) {
        case 'auth/invalid-email':
            return 'البريد الإلكتروني غير صالح';
        case 'auth/user-disabled':
            return 'هذا الحساب معطل';
        case 'auth/user-not-found':
            return 'لا يوجد حساب بهذا البريد الإلكتروني';
        case 'auth/wrong-password':
            return 'كلمة المرور غير صحيحة';
        case 'auth/email-already-in-use':
            return 'هذا البريد الإلكتروني مستخدم بالفعل';
        case 'auth/weak-password':
            return 'كلمة المرور ضعيفة جدًا';
        case 'auth/operation-not-allowed':
            return 'هذه العملية غير مسموحة';
        default:
            return 'حدث خطأ غير متوقع';
    }
}
