<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>لوحة التحكم - عبد الله جاسم</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.rtl.min.css" rel="stylesheet">
    <style>
        body { background-color: #f8f9fa; font-family: 'Tahoma', sans-serif; }
        .admin-container { margin: 20px; }
        .user-card { margin: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 5px; background: white; }
    </style>
</head>
<body>
    <div class="container admin-container">
        <h2 class="text-center mb-4">لوحة التحكم</h2>
        <div class="d-flex justify-content-between mb-3">
            <h4>إدارة المستخدمين</h4>
            <button id="logoutAdminBtn" class="btn btn-danger">خروج</button>
        </div>
        <div id="usersList"></div>
    </div>

    <script src="https://www.gstatic.com/firebasejs/9.6.0/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.6.0/firebase-auth-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.6.0/firebase-database-compat.js"></script>
    <script src="firebase-config.js"></script>
    <script src="admin-script.js"></script>
</body>
</html>
