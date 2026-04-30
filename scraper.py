#!/usr/bin/env python3
"""
Vita ⴾ — منشئ ملفات المشروع الحيوي (مع GitHub Actions)
=========================================================
هذا السكريبت ينشئ هيكل مشروع فيتا بالكامل تلقائيًا،
بما في ذلك .github/workflows/main.yml.

طريقة التشغيل:
    python scraper.py
"""

import os

# ============================================================
# الإعدادات الأساسية
# ============================================================
PROJECT_NAME = "VitaProject"
AUTHOR = "Vita Foundation"
YEAR = "2026"
SYMBOL = "ⴾ"

# ============================================================
# محتوى الملفات
# ============================================================

def get_index_html():
    return '''<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vita ⴾ — أول نظام مالي بيولوجي</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', 'Cairo', sans-serif; background: radial-gradient(ellipse at center, #0a1a0a 0%, #020502 100%); color: #c8e6c9; min-height: 100vh; display: flex; flex-direction: column; align-items: center; overflow-x: hidden; position: relative; }
        .splash { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #020502; z-index: 100; display: flex; flex-direction: column; justify-content: center; align-items: center; transition: opacity 0.8s, visibility 0.8s; }
        .splash.hidden { opacity: 0; visibility: hidden; }
        .splash-logo { font-size: 5em; animation: pulse 1.5s infinite; color: #4caf50; }
        .splash-text { color: #81c784; margin: 20px; font-size: 1.2em; }
        .splash-bar { width: 200px; height: 4px; background: #1a3a1a; border-radius: 4px; overflow: hidden; }
        .splash-fill { width: 0%; height: 100%; background: #4caf50; animation: fillBar 2.5s forwards; }
        @keyframes fillBar { 0% { width: 0%; } 100% { width: 100%; } }
        .particles { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none; }
        .particle { position: absolute; background: radial-gradient(circle, #4caf50 0%, transparent 70%); border-radius: 50%; animation: float 6s infinite ease-in-out; opacity: 0.15; }
        @keyframes float { 0%, 100% { transform: translateY(0) translateX(0) scale(1); } 25% { transform: translateY(-30px) translateX(20px) scale(1.2); } 50% { transform: translateY(-60px) translateX(-20px) scale(1); } 75% { transform: translateY(-30px) translateX(-30px) scale(0.8); } }
        .container { position: relative; z-index: 1; width: 90%; max-width: 900px; padding: 20px; }
        .hero { text-align: center; margin: 30px 0 20px; }
        .logo-main { font-size: 6em; animation: pulse 2s infinite; color: #4caf50; text-shadow: 0 0 40px rgba(76,175,80,0.7); cursor: pointer; user-select: none; }
        @keyframes pulse { 0%, 100% { transform: scale(1); filter: drop-shadow(0 0 20px #4caf50); } 50% { transform: scale(1.05); filter: drop-shadow(0 0 50px #8bc34a); } }
        .title { font-size: 3em; font-weight: 700; color: #e8f5e9; margin: 5px 0; }
        .subtitle { font-size: 1.2em; color: #81c784; letter-spacing: 2px; margin-bottom: 15px; }
        .life-bar-wrap { background: #1a3a1a; border-radius: 20px; height: 12px; margin: 15px auto; max-width: 400px; overflow: hidden; }
        .life-bar-fill { height: 100%; width: 70%; background: linear-gradient(90deg, #4caf50, #ff9800); border-radius: 20px; transition: width 0.4s; }
        .life-label { font-size: 0.8em; color: #81c784; margin-top: 5px; }
        .card { background: rgba(10,20,10,0.8); backdrop-filter: blur(18px); border: 1px solid rgba(76,175,80,0.3); border-radius: 24px; padding: 25px; margin: 20px 0; text-align: center; box-shadow: 0 0 30px rgba(76,175,80,0.08); transition: transform 0.3s, box-shadow 0.3s; }
        .card:hover { box-shadow: 0 0 60px rgba(76,175,80,0.15); }
        .status-badge { display: inline-block; background: #1b5e20; color: #a5d6a7; padding: 6px 18px; border-radius: 30px; font-size: 0.9em; margin: 10px 0; }
        .balance { font-size: 4em; font-weight: bold; color: #4caf50; text-shadow: 0 0 25px #2e7d32; margin: 20px 0; direction: ltr; }
        .unit { font-size: 0.4em; color: #81c784; }
        .info-line { display: flex; justify-content: space-around; align-items: center; margin: 15px 0; flex-wrap: wrap; gap: 15px; }
        .info-item { text-align: center; }
        .info-item .label { font-size: 0.8em; color: #6a9b6a; }
        .info-item .value { font-weight: bold; color: #c8e6c9; }
        .globe-wrap { display: flex; justify-content: center; margin: 20px 0; }
        .globe { width: 80px; height: 80px; border-radius: 50%; background: radial-gradient(circle at 30% 30%, #2e7d32, #0a2a0a); border: 2px solid #4caf50; box-shadow: 0 0 20px rgba(76,175,80,0.5); animation: rotate 8s infinite linear; position: relative; }
        @keyframes rotate { 100% { transform: rotate(360deg); } }
        .globe-wave { position: absolute; top: -10px; left: -10px; width: 100px; height: 100px; border: 2px dashed #4caf50; border-radius: 50%; animation: wavePulse 2s infinite; }
        @keyframes wavePulse { 0%, 100% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.3); opacity: 0; } }
        .btn-group { display: flex; justify-content: center; gap: 15px; flex-wrap: wrap; margin: 20px 0; }
        .btn { background: rgba(30,50,30,0.7); backdrop-filter: blur(8px); border: 1px solid #4caf50; color: #c8e6c9; padding: 14px 28px; border-radius: 35px; font-size: 1em; cursor: pointer; transition: all 0.3s; font-weight: bold; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 8px; }
        .btn:hover { background: #2e7d32; border-color: #8bc34a; box-shadow: 0 0 35px rgba(76,175,80,0.4); transform: translateY(-2px); }
        .btn.life { border-color: #ff9800; color: #ffb74d; }
        .btn.life:hover { background: #e65100; border-color: #ff9800; box-shadow: 0 0 35px rgba(255,152,0,0.5); }
        .btn.biometric { border-color: #9c27b0; color: #ce93d8; }
        .btn.biometric:hover { background: #6a1b9a; border-color: #ab47bc; box-shadow: 0 0 35px rgba(156,39,176,0.5); }
        .fingerprint-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 10; display: flex; justify-content: center; align-items: center; flex-direction: column; gap: 20px; }
        .fingerprint-scanner { width: 120px; height: 120px; border-radius: 50%; background: rgba(76,175,80,0.1); border: 3px solid #4caf50; display: flex; justify-content: center; align-items: center; cursor: pointer; transition: all 0.3s; animation: scanPulse 1.5s infinite; }
        @keyframes scanPulse { 0%, 100% { box-shadow: 0 0 15px rgba(76,175,80,0.4); } 50% { box-shadow: 0 0 40px rgba(76,175,80,0.9); } }
        .fingerprint-scanner i { font-size: 3em; color: #4caf50; }
        .fingerprint-text { color: #c8e6c9; text-align: center; font-size: 1em; }
        .log-area { background: rgba(5,10,5,0.7); border-radius: 16px; padding: 15px; margin-top: 20px; max-height: 180px; overflow-y: auto; text-align: right; font-size: 0.9em; border: 1px solid rgba(76,175,80,0.2); }
        .log-area .entry { padding: 8px 0; border-bottom: 1px solid rgba(76,175,80,0.1); display: flex; align-items: center; gap: 8px; }
        .entry.send { color: #ef5350; }
        .entry.receive { color: #4caf50; }
        .entry.mine { color: #ff9800; }
        .footer { text-align: center; margin: 30px 0; color: #3a5a3a; font-size: 0.9em; }
        .footer i { color: #4caf50; margin: 0 4px; }
        @media (max-width: 600px) { .title { font-size: 2em; } .balance { font-size: 2.8em; } }
    </style>
</head>
<body>
    <div class="splash" id="splashScreen"><div class="splash-logo">ⴾ</div><p class="splash-text">⏳ جاري الاتصال بالشريحة البيولوجية...</p><div class="splash-bar"><div class="splash-fill"></div></div></div>
    <div class="particles" id="particles"></div>
    <div class="container">
        <div class="hero"><div class="logo-main" id="logoIcon">ⴾ</div><h1 class="title">فيتا</h1><p class="subtitle">Vita — المال الحي</p></div>
        <div style="max-width:400px; margin:0 auto;"><div class="life-label">🧬 طاقة الحياة (معدل التعدين الحيوي)</div><div class="life-bar-wrap"><div class="life-bar-fill" id="lifeBar"></div></div></div>
        <div class="globe-wrap"><div class="globe"><div class="globe-wave"></div></div></div>
        <div class="card" id="walletCard">
            <div class="status-badge"><i class="fas fa-dna"></i> الشريحة البيولوجية متصلة</div>
            <div class="balance" id="balanceDisplay">1,250.50</div><div class="unit">ⴾ Vita في المخزون الحيوي</div>
            <div class="info-line">
                <div class="info-item"><div class="label"><i class="fas fa-wave-square"></i> التردد البيولوجي</div><div class="value" id="freqDisplay"># 7.83 Hz / ID: 4401</div></div>
                <div class="info-item"><div class="label"><i class="fas fa-heartbeat"></i> إثبات الحياة</div><div class="value" id="lifeStatus">نشط</div></div>
                <div class="info-item"><div class="label"><i class="fas fa-globe-asia"></i> الموجة الأرضية</div><div class="value">متصل</div></div>
            </div>
            <div class="btn-group">
                <button class="btn biometric" onclick="openFingerprint()"><i class="fas fa-fingerprint"></i> بصمة فيتا</button>
                <button class="btn" onclick="sendVita()"><i class="fas fa-broadcast-tower"></i> إرسال عبر التردد</button>
                <button class="btn life" onclick="proofOfLife()"><i class="fas fa-seedling"></i> إثبات الحياة</button>
            </div>
        </div>
        <div class="log-area" id="logArea"><div class="entry mine"><i class="fas fa-circle"></i> ⚡ أثبت الحياة: +0.31 Vita</div><div class="entry receive"><i class="fas fa-circle"></i> 📡 استُقبل 5.00 Vita من التردد #7823</div><div class="entry send"><i class="fas fa-circle"></i> 📤 أُرسل 2.50 Vita إلى التردد #1190</div></div>
        <div class="footer"><i class="fas fa-leaf"></i> Vita ex Terra, Vita in Corpore <i class="fas fa-leaf"></i><br>الحياة من الأرض، الحياة في الجسد</div>
    </div>
    <div id="fingerprintOverlay" class="fingerprint-overlay" style="display: none;"><div class="fingerprint-scanner" id="fingerScanner" onclick="simulateFingerprint()"><i class="fas fa-fingerprint"></i></div><p class="fingerprint-text" id="fingerText">المس الدائرة لمحاكاة البصمة</p></div>
    <script>
        window.addEventListener('load',()=>{setTimeout(()=>{document.getElementById('splashScreen').classList.add('hidden')},2800)});
        const AudioContext=window.AudioContext||window.webkitAudioContext;let audioCtx;
        function initAudio(){if(!audioCtx)audioCtx=new AudioContext()}
        function playHeartbeat(){initAudio();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);o.type='sine';o.frequency.setValueAtTime(60,audioCtx.currentTime);g.gain.setValueAtTime(0.3,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.5);o.start();o.stop(audioCtx.currentTime+0.5)}
        function playSchumann(){initAudio();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);o.type='sawtooth';o.frequency.setValueAtTime(7.83,audioCtx.currentTime);g.gain.setValueAtTime(0.08,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+2);o.start();o.stop(audioCtx.currentTime+2)}
        function playScanSound(){initAudio();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);o.type='triangle';o.frequency.setValueAtTime(800,audioCtx.currentTime);o.frequency.linearRampToValueAtTime(1200,audioCtx.currentTime+0.2);g.gain.setValueAtTime(0.15,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.3);o.start();o.stop(audioCtx.currentTime+0.3)}
        let balance=1250.50,lifeEnergy=70;
        function updateDisplay(){document.getElementById('balanceDisplay').innerText=balance.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});document.getElementById('lifeBar').style.width=lifeEnergy+'%'}
        function addLog(msg,type){const la=document.getElementById('logArea');const e=document.createElement('div');e.className='entry '+type;e.innerHTML='<i class="fas fa-circle"></i> '+msg;la.prepend(e)}
        document.addEventListener('click',()=>{lifeEnergy=Math.min(100,lifeEnergy+0.5);updateDisplay()});
        function openFingerprint(){document.getElementById('fingerprintOverlay').style.display='flex';playScanSound()}
        function simulateFingerprint(){const s=document.getElementById('fingerScanner');s.style.background='rgba(76,175,80,0.4)';s.style.borderColor='#8bc34a';document.getElementById('fingerText').innerText='✅ تم تأكيد الهوية البيولوجية';playHeartbeat();addLog('🔐 تأكيد بصمة بيولوجية: الهوية مطابقة','receive');setTimeout(()=>{document.getElementById('fingerprintOverlay').style.display='none';s.style.background='rgba(76,175,80,0.1)';s.style.borderColor='#4caf50'},1500)}
        function proofOfLife(){const g=(Math.random()*0.5+0.1);balance+=g;lifeEnergy=Math.min(100,lifeEnergy+3);updateDisplay();document.getElementById('lifeStatus').innerText='نبض حيوي';playHeartbeat();addLog('⚡ أثبت الحياة: +'+g.toFixed(4)+' Vita','mine');setTimeout(()=>{document.getElementById('lifeStatus').innerText='نشط'},1200)}
        function sendVita(){const a=(Math.random()*10+1);if(balance>=a){balance-=a;updateDisplay();playSchumann();addLog('📤 أُرسل '+a.toFixed(2)+' Vita إلى التردد #'+Math.floor(Math.random()*9000+1000)+' عبر الموجة الأرضية','send')}else{addLog('⚠️ المخزون الحيوي غير كافٍ','send')}}
        (function createParticles(){const c=document.getElementById('particles');for(let i=0;i<35;i++){const p=document.createElement('div');p.className='particle';const s=Math.random()*90+20;p.style.width=s+'px';p.style.height=s+'px';p.style.left=Math.random()*100+'%';p.style.top=Math.random()*100+'%';p.style.animationDelay=Math.random()*8+'s';p.style.animationDuration=(Math.random()*10+6)+'s';c.appendChild(p)}})();
        setInterval(()=>{if(Math.random()<0.15){const a=(Math.random()*3+0.5);balance+=a;updateDisplay();addLog('📡 استُقبل '+a.toFixed(2)+' Vita من التردد #'+Math.floor(Math.random()*9000+1000),'receive')}},15000);
        document.getElementById('logoIcon').addEventListener('click',()=>{playSchumann();addLog('🌐 بث نبضة حيوية عبر الموجة الأرضية','mine')});
    </script>
</body>
</html>'''


def get_whitepaper_html():
    return '''<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vita ⴾ — الورقة البيضاء</title>
    <style>
        body { font-family: 'Segoe UI', 'Cairo', sans-serif; background: #0a1a0a; color: #c8e6c9; padding: 40px; max-width: 800px; margin: auto; line-height: 1.9; }
        h1 { color: #4caf50; text-align: center; font-size: 2.5em; }
        h2 { color: #81c784; border-bottom: 1px solid #2e7d32; padding-bottom: 10px; margin-top: 40px; }
        .highlight { background: #1a3a1a; padding: 4px 10px; border-radius: 8px; color: #4caf50; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #2e7d32; padding: 12px; text-align: center; }
        th { background: #1b5e20; color: #fff; }
        code { background: #1a2a1a; padding: 2px 8px; border-radius: 6px; }
    </style>
</head>
<body>
    <h1>ⴾ فيتا (Vita)</h1>
    <p style="text-align:center; color:#81c784;">الورقة البيضاء — الإصدار 1.0</p>
    <h2>1. المقدمة</h2>
    <p>فيتا هي أول نظام مالي بيولوجي في التاريخ. ليست عملة رقمية ولا مادية، بل <span class="highlight">حالة بيولوجية حية</span> داخل جسد الإنسان. تنتقل القيمة عبر الموجة الأرضية الطبيعية دون إنترنت أو كهرباء.</p>
    <h2>2. المشكلة</h2>
    <p>الأنظمة المالية الحالية تعتمد على البنية التحتية (إنترنت، كهرباء، بنوك) وهي عرضة للرقابة والإغلاق والاختراق. حتى البيتكوين يحتاج إلى إنترنت وكهرباء.</p>
    <h2>3. الحل: فيتا</h2>
    <table>
        <tr><th>العنصر</th><th>الوصف</th></tr>
        <tr><td>المحفظة</td><td>شريحة بيولوجية حية تُزرع تحت الجلد</td></tr>
        <tr><td>الطاقة</td><td>جلوكوز الدم + الأكسجين (لا بطاريات)</td></tr>
        <tr><td>الناقل</td><td>الموجة الأرضية (Schumann 7.83 Hz)</td></tr>
        <tr><td>العنوان</td><td>تردد بروتيني فريد لكل شريحة</td></tr>
        <tr><td>التعدين</td><td>إثبات الحياة (الحركة، النبض، التنفس)</td></tr>
        <tr><td>الأمان</td><td>بصمة جسدية كاملة + تشفير حي</td></tr>
    </table>
    <h2>4. الإرسال والاستقبال</h2>
    <p>يتم الإرسال عن طريق رؤية صورة المستقبل وإغلاق العينين، فيُصدر الدماغ أمرًا للشريحة التي تبث نبضة عبر الموجة الأرضية. المستقبل يتلقى إشعارًا داخليًا، ويؤكد بالبصمة.</p>
    <h2>5. إثبات الحياة (التعدين)</h2>
    <p>تكافئ فيتا النشاط الحيوي: كل خطوة، نبضة، ونفَس يُنتج وحدات من العملة. النوم يوقف التعدين مؤقتًا. السقف الطبيعي هو مجموع الأنشطة الحيوية البشرية.</p>
    <h2>6. الأمان</h2>
    <p>لا يمكن اختراق فيتا إلكترونيًا (لا إنترنت)، ولا يمكن تزويرها (التردد البروتيني فريد)، ولا يمكن مصادرتها (هي جزء من جسدك).</p>
    <h2>7. الشعار</h2>
    <p style="font-size:1.5em; text-align:center;">Vita ex Terra, Vita in Corpore<br><span style="font-size:0.7em;">الحياة من الأرض، الحياة في الجسد</span></p>
    <p style="text-align:center; margin-top:40px; color:#4caf50;">ⴾ</p>
</body>
</html>'''


def get_about_html():
    return '''<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vita ⴾ — عن فيتا</title>
    <style>
        body { font-family: 'Segoe UI', 'Cairo', sans-serif; background: #0a1a0a; color: #c8e6c9; padding: 40px; max-width: 700px; margin: auto; text-align: center; line-height: 2; }
        h1 { color: #4caf50; font-size: 3em; }
        .symbol { font-size: 6em; color: #4caf50; text-shadow: 0 0 40px rgba(76,175,80,0.7); }
        .card { background: rgba(10,20,10,0.8); border: 1px solid #2e7d32; border-radius: 20px; padding: 30px; margin: 30px 0; }
    </style>
</head>
<body>
    <div class="symbol">ⴾ</div>
    <h1>فيتا</h1>
    <p style="color:#81c784; font-size:1.3em;">Vita — المال الحي</p>
    <div class="card">
        <p>فيتا ليست عملة رقمية، وليست ذهبًا ماديًا.</p>
        <p>إنها <strong>أول نظام مالي بيولوجي</strong> في التاريخ.</p>
        <p>تُزرع شريحة حية في جسدك، تستمد طاقتها من دمك وأعصابك، وتتواصل مع البشر عبر <strong>الموجة الأرضية</strong> نفسها.</p>
        <p>لا إنترنت. لا كهرباء. لا بنوك.</p>
        <p>فقط جسدك، والأرض، والحياة.</p>
    </div>
    <p style="color:#6a9b6a;">"Vita ex Terra, Vita in Corpore"</p>
    <p style="color:#3a5a3a;">الحياة من الأرض، الحياة في الجسد</p>
</body>
</html>'''


def get_community_html():
    return '''<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vita ⴾ — مجتمع فيتا</title>
    <style>
        body { font-family: 'Segoe UI', 'Cairo', sans-serif; background: #0a1a0a; color: #c8e6c9; padding: 40px; max-width: 700px; margin: auto; text-align: center; line-height: 2; }
        h1 { color: #4caf50; font-size: 2.5em; }
        .counter { font-size: 3em; color: #ff9800; font-weight: bold; }
        .btn { background: #2e7d32; color: #fff; border: none; padding: 15px 35px; border-radius: 35px; font-size: 1.2em; cursor: pointer; margin: 20px; }
        .btn:hover { background: #1b5e20; }
        input { padding: 15px; border-radius: 30px; border: 1px solid #4caf50; background: #1a2a1a; color: #fff; width: 80%; font-size: 1em; text-align: center; }
    </style>
</head>
<body>
    <h1>ⴾ مجتمع فيتا</h1>
    <p style="color:#81c784;">الكروب الحيوي — أوائل حاملي الشريحة</p>
    <div class="counter" id="memberCount">47</div>
    <p>عدد المؤمنين الأوائل</p>
    <p style="margin-top:30px;">هل تريد أن تكون من أوائل حاملي Vita؟</p>
    <input type="text" placeholder="التردد البيولوجي أو البريد الحيوي"><br>
    <button class="btn" onclick="alert('تم تسجيل اهتمامك. مرحبًا بك في كروب فيتا.')">انضم إلى الكروب</button>
    <p style="margin-top:40px; color:#3a5a3a;">"أنت تحيا، إذًا أنت تملك."</p>
    <script>
        setInterval(() => { if (Math.random() < 0.3) { const el = document.getElementById('memberCount'); el.innerText = parseInt(el.innerText) + 1; } }, 8000);
    </script>
</body>
</html>'''


def get_manifest_json():
    return '''{
    "name": "Vita",
    "symbol": "ⴾ",
    "version": "1.0.0",
    "description": "أول نظام مالي بيولوجي في التاريخ. المال الحي.",
    "type": "biological-currency",
    "transport": "Schumann Resonance (7.83 Hz)",
    "wallet": "Biochip (living neural tissue)",
    "mining": "Proof of Life",
    "author": "Vita Foundation",
    "year": 2026,
    "tagline": "Vita ex Terra, Vita in Corpore",
    "tagline_ar": "الحياة من الأرض، الحياة في الجسد"
}'''


def get_readme_md():
    return '''# Vita ⴾ — أول نظام مالي بيولوجي

> "Vita ex Terra, Vita in Corpore" — الحياة من الأرض، الحياة في الجسد

## ما هي فيتا؟
فيتا ليست عملة رقمية ولا مادية. إنها **أول نظام مالي بيولوجي** في التاريخ.

- **المحفظة:** شريحة بيولوجية حية تُزرع تحت الجلد
- **الطاقة:** من جلوكوز الدم والأكسجين فقط
- **الناقل:** الموجة الأرضية (Schumann Resonance 7.83 Hz)
- **التعدين:** إثبات الحياة (الحركة، النبض، التنفس)
- **الأمان:** بصمة جسدية كاملة + تشفير بروتيني حي

## الملفات
| الملف | الوصف |
|-------|-------|
| `index.html` | المحفظة البيولوجية (الواجهة الرئيسية) |
| `whitepaper.html` | الورقة البيضاء الكاملة |
| `about.html` | عن فيتا |
| `community.html` | مجتمع فيتا (الكروب) |
| `assets/manifest.json` | بيان المشروع |

## التشغيل
افتح أي ملف HTML في متصفحك.

## الترخيص
جميع الحقوق محفوظة — Vita Foundation 2026
'''


def get_github_workflow_yml():
    return '''name: نشر فيتا على GitHub Pages

on:
  push:
    branches: [ "main" ]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: 📥 تحميل الكود
        uses: actions/checkout@v4

      - name: 📄 إعداد الصفحات
        uses: actions/configure-pages@v4

      - name: 📦 رفع الموقع
        uses: actions/upload-pages-artifact@v3
        with:
          path: '.'

      - name: 🚀 النشر على GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
'''


# ============================================================
# دوال إنشاء الملفات والمجلدات
# ============================================================

def create_file(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"  ✅ {path}")


def main():
    print("=" * 60)
    print(f" {SYMBOL}  Vita Project Scraper — منشئ ملفات المشروع الحيوي")
    print("=" * 60)
    print()

    base_path = os.path.join(os.getcwd(), PROJECT_NAME)
    print(f"📁 مجلد المشروع: {base_path}")
    print()

    print("⚙️  جاري إنشاء الملفات...")
    print()

    files = {
        os.path.join(base_path, "index.html"): get_index_html(),
        os.path.join(base_path, "whitepaper.html"): get_whitepaper_html(),
        os.path.join(base_path, "about.html"): get_about_html(),
        os.path.join(base_path, "community.html"): get_community_html(),
        os.path.join(base_path, "assets", "manifest.json"): get_manifest_json(),
        os.path.join(base_path, "README.md"): get_readme_md(),
        os.path.join(base_path, ".github", "workflows", "main.yml"): get_github_workflow_yml(),
    }

    for filepath, content in files.items():
        create_file(filepath, content)

    print()
    print("=" * 60)
    print(f" {SYMBOL}  تم إنشاء مشروع فيتا بنجاح!")
    print(f" 📂 الموقع: {base_path}")
    print()
    print("   لبدء التجربة، افتح:")
    print(f"   → {os.path.join(base_path, 'index.html')}")
    print()
    print("   لتفعيل GitHub Pages بعد الرفع:")
    print("   1. اذهب إلى Settings > Pages")
    print("   2. اختر Source: GitHub Actions")
    print("=" * 60)


if __name__ == "__main__":
    main()
