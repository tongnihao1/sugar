/* sugar-lane · 相纸台脚本
   随机散落 / 指针倾斜 / 抽出一张。纯原生 JS，无依赖。 */

(function () {
  'use strict';

  var stage = document.getElementById('stage');
  var deck = document.getElementById('deck');
  var prints = Array.prototype.slice.call(deck.querySelectorAll('.print'));
  var counter = document.getElementById('counter');
  var starTitle = document.getElementById('starTitle');
  var tip = document.getElementById('tip');
  var reshuffleBtn = document.getElementById('reshuffle');

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;

  // 八个落点：桌面与窄屏各一套，先定槽位再抖动，避免照片叠成一堆
  var DESKTOP_SLOTS = [[18, 23], [50, 24], [82, 22], [26, 50], [58, 51], [90, 49], [27, 76], [63, 75]];
  var MOBILE_SLOTS = [[27, 15], [71, 16], [27, 36], [71, 37], [27, 58], [71, 59], [27, 76], [71, 75]];

  var order = [];
  var star = null;

  function rand(a, b) { return a + Math.random() * (b - a); }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function isMobile() { return window.innerWidth < 760; }

  function scatter() {
    var slots = (isMobile() ? MOBILE_SLOTS : DESKTOP_SLOTS).slice();
    var jx = isMobile() ? 2.5 : 3;
    var jy = isMobile() ? 3.5 : 3.5;
    var cards = shuffle(prints);
    order = cards.slice();

    cards.forEach(function (el, i) {
      var s = slots[i % slots.length];
      var w = isMobile() ? rand(28, 31) : rand(12.5, 15.5);
      el.style.setProperty('--x', (s[0] + rand(-jx, jx)).toFixed(1) + '%');
      el.style.setProperty('--y', (s[1] + rand(-jy, jy)).toFixed(1) + '%');
      el.style.setProperty('--w', w.toFixed(1) + 'vw');
      el.style.setProperty('--r', rand(-6.5, 6.5).toFixed(1) + 'deg');
      el.style.setProperty('--z', Math.round(rand(-90, 90)) + 'px');
      el.style.setProperty('--d', (i * 46) + 'ms');
      // 上排压在下排之上：caption 不被遮住
      el.style.zIndex = String(100 - i);
      el.dataset.z = String(100 - i);
    });

    updateCounter();
  }

  function updateCounter() {
    if (star) {
      counter.textContent = pad(order.indexOf(star) + 1) + ' / ' + pad(prints.length);
    } else {
      counter.textContent = pad(1) + ' / ' + pad(prints.length);
    }
  }

  function dropIn() {
    if (reduce) {
      prints.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    prints.forEach(function (el) { el.classList.remove('in'); });
    void deck.offsetWidth;
    requestAnimationFrame(function () {
      prints.forEach(function (el) { el.classList.add('in'); });
    });
  }

  function focusCard(el) {
    if (!el) return;
    prints.forEach(function (p) {
      if (p.classList.contains('is-star') && p.dataset.z) p.style.zIndex = p.dataset.z;
      p.classList.remove('is-star');
    });
    el.classList.add('is-star');
    el.style.zIndex = '300';
    stage.classList.add('is-focus');
    document.body.classList.add('is-focus');
    star = el;

    var title = el.getAttribute('data-title') || '';
    var note = el.getAttribute('data-note') || '';
    starTitle.hidden = false;
    starTitle.textContent = title + (note ? ' · ' + note : '');
    tip.hidden = true;

    deck.style.setProperty('--tx', '0deg');
    deck.style.setProperty('--ty', '0deg');
    updateCounter();
  }

  function unfocus() {
    if (!star) return;
    if (star.dataset.z) star.style.zIndex = star.dataset.z;
    star.classList.remove('is-star');
    star = null;
    stage.classList.remove('is-focus');
    document.body.classList.remove('is-focus');
    starTitle.hidden = true;
    starTitle.textContent = '';
    tip.hidden = false;
    updateCounter();
  }

  // 悬停时浮到最上层，被压住的那张也能看清
  prints.forEach(function (el) {
    el.addEventListener('pointerenter', function () {
      if (!star) el.style.zIndex = '160';
    });
    el.addEventListener('pointerleave', function () {
      if (!star) el.style.zIndex = el.dataset.z;
    });
  });

  // 点击某张照片 → 抽到眼前
  prints.forEach(function (el) {
    el.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (el.classList.contains('is-star')) { unfocus(); return; }
      focusCard(el);
    });
  });

  // 点空白处收起
  stage.addEventListener('click', function (ev) {
    if (ev.target === stage || ev.target === deck) unfocus();
  });

  reshuffleBtn.addEventListener('click', function () {
    unfocus();
    scatter();
    if (reduce) return;
    requestAnimationFrame(function () {
      prints.forEach(function (el) { el.classList.add('in'); });
    });
  });

  // 指针倾斜：整盘跟着轻微歪，diverging 的 translateZ 自带视差
  if (finePointer && !reduce) {
    stage.addEventListener('pointermove', function (ev) {
      if (star) return;
      var r = stage.getBoundingClientRect();
      var nx = (ev.clientX - r.left) / r.width - 0.5;
      var ny = (ev.clientY - r.top) / r.height - 0.5;
      deck.style.setProperty('--tx', (-ny * 8).toFixed(2) + 'deg');
      deck.style.setProperty('--ty', (nx * 10).toFixed(2) + 'deg');
    });
    stage.addEventListener('pointerleave', function () {
      deck.style.setProperty('--tx', '0deg');
      deck.style.setProperty('--ty', '0deg');
    });
  }

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') { unfocus(); return; }
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
      if (!star) return;
      ev.preventDefault();
      var i = order.indexOf(star);
      var step = ev.key === 'ArrowRight' ? 1 : -1;
      focusCard(order[(i + step + order.length) % order.length]);
      return;
    }
    if (ev.key === 'r' || ev.key === 'R') {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      unfocus();
      scatter();
    }
  });

  // 断点切换时换一套落点
  var lastMobile = isMobile();
  window.addEventListener('resize', function () {
    var m = isMobile();
    if (m !== lastMobile) {
      lastMobile = m;
      scatter();
    }
  });

  scatter();
  dropIn();
})();
