/* sugar-lane · 登录页脚本
   校验顺序：验证码 → 账号 → 口令哈希。验证通过后把钥匙写进 sessionStorage 再跳转。 */
(function () {
  'use strict';

  var form = document.getElementById('form');
  var userInput = document.getElementById('user');
  var passInput = document.getElementById('pass');
  var codeInput = document.getElementById('code');
  var cv = document.getElementById('captcha');
  var msg = document.getElementById('msg');
  var go = document.getElementById('go');
  var peek = document.getElementById('peek');
  var ticket = document.getElementById('ticket');
  var ctx = cv.getContext('2d');

  var ALPHA = '23456789ABCDEFGHJKMNPQRSTUVWXY';
  var answer = '';
  var fails = 0;
  var lockUntil = 0;
  var lockTimer = null;

  function rnd(a, b) { return a + Math.random() * (b - a); }

  /* 只认站内页面，防止 ?to= 被塞进外部地址 */
  function pickTarget() {
    var to = '';
    try { to = new URLSearchParams(location.search).get('to') || ''; } catch (e) { to = ''; }
    if (!/^(index\.html|page-gallery\.html|museum\/(index|page-[a-z-]+)\.html)$/.test(to)) {
      to = 'index.html';
    }
    return to;
  }
  var target = pickTarget();

  /* ===== 验证码 ===== */
  function drawCaptcha() {
    var dpr = window.devicePixelRatio || 1;
    var w = 120, h = 46;
    cv.width = w * dpr;
    cv.height = h * dpr;
    cv.style.width = w + 'px';
    cv.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#F6EEE4';
    ctx.fillRect(0, 0, w, h);

    // 噪点
    for (var i = 0; i < 44; i++) {
      ctx.fillStyle = 'rgba(' + Math.round(rnd(150, 210)) + ',' + Math.round(rnd(110, 165)) + ',' + Math.round(rnd(100, 150)) + ',' + rnd(0.08, 0.3).toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(rnd(0, w), rnd(0, h), rnd(0.6, 2.2), 0, Math.PI * 2);
      ctx.fill();
    }

    // 干扰曲线
    for (var j = 0; j < 3; j++) {
      ctx.strokeStyle = 'rgba(178,62,104,' + rnd(0.12, 0.26).toFixed(2) + ')';
      ctx.lineWidth = rnd(0.8, 1.6);
      ctx.beginPath();
      ctx.moveTo(rnd(0, w), rnd(0, h));
      ctx.bezierCurveTo(rnd(0, w), rnd(0, h), rnd(0, w), rnd(0, h), rnd(0, w), rnd(0, h));
      ctx.stroke();
    }

    // 四个字符，逐个旋转错位
    answer = '';
    for (var k = 0; k < 4; k++) {
      answer += ALPHA.charAt(Math.floor(Math.random() * ALPHA.length));
    }
    for (var n = 0; n < 4; n++) {
      ctx.save();
      ctx.translate(14 + n * 28, 24 + rnd(-4, 4));
      ctx.rotate(rnd(-0.3, 0.3));
      ctx.font = '600 26px "Ma Shan Zheng","Kaiti SC",KaiTi,serif';
      ctx.fillStyle = n % 2 ? '#8E5E4E' : '#B23E68';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText(answer.charAt(n), 0, 0);
      ctx.restore();
    }
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(drawCaptcha).catch(function () {});
  }

  /* ===== 提示与动效 ===== */
  function say(text, kind) {
    msg.textContent = text;
    msg.className = 'msg' + (kind ? ' is-' + kind : '');
  }

  function shake() {
    ticket.classList.remove('is-shake');
    void ticket.offsetWidth;
    ticket.classList.add('is-shake');
  }

  /* ===== 失败节流 ===== */
  function lock() {
    lockUntil = Date.now() + 20000;
    go.disabled = true;
    form.classList.add('is-locked');
    clearInterval(lockTimer);
    var tick = function () {
      var left = Math.ceil((lockUntil - Date.now()) / 1000);
      if (left > 0) {
        say('错得有点多了，' + left + ' 秒后再试', 'bad');
      } else {
        clearInterval(lockTimer);
        go.disabled = false;
        form.classList.remove('is-locked');
        say('可以再试了', '');
      }
    };
    tick();
    lockTimer = setInterval(tick, 1000);
  }

  /* ===== 提交 ===== */
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (Date.now() < lockUntil) return;

    var u = userInput.value.trim();
    var p = passInput.value;
    var c = codeInput.value.trim().toUpperCase();

    if (!u || !p) { say('账号和密码都还没填完', 'bad'); shake(); return; }
    if (!c) { say('验证码还没填', 'bad'); shake(); return; }
    if (c !== answer) {
      say('验证码对不上，换一张再试', 'bad');
      drawCaptcha();
      codeInput.value = '';
      codeInput.focus();
      shake();
      return;
    }

    var hash;
    try {
      hash = sugarHashPassword(p);
    } catch (e) {
      say('这个浏览器算不了口令，换一个浏览器试试', 'bad');
      return;
    }

    var row = sugarFindAccount(u);
    if (!row || hash !== row.passHash) {
      fails += 1;
      drawCaptcha();
      codeInput.value = '';
      if (fails >= 5) { lock(); } else { say('账号或密码不对，再想想', 'bad'); }
      shake();
      return;
    }

    try {
      sessionStorage.setItem(SUGAR_KEY, SUGAR_OPEN);
    } catch (e) {
      say('浏览器把本地存储关掉了，登录状态存不下来', 'bad');
      return;
    }

    go.disabled = true;
    go.textContent = '盖章中';
    say('口令无误 · 通过', 'ok');
    ticket.classList.add('is-passed');
    setTimeout(function () { location.replace(target); }, 700);
  });

  /* ===== 交互细节 ===== */
  cv.addEventListener('click', function () {
    drawCaptcha();
    codeInput.value = '';
    codeInput.focus();
  });

  cv.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      cv.click();
    }
  });

  peek.addEventListener('click', function () {
    var showing = passInput.type === 'text';
    passInput.type = showing ? 'password' : 'text';
    peek.setAttribute('aria-label', showing ? '显示密码' : '隐藏密码');
    peek.classList.toggle('is-on', !showing);
    passInput.focus();
  });

  form.addEventListener('animationend', function (ev) {
    if (ev.animationName === 'shake') ticket.classList.remove('is-shake');
  });

  drawCaptcha();
  userInput.focus();
})();
