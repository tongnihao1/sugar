/* 首页回忆相片条 —— 一直往左转的照片带，转到尽头无缝接回开头 */
(function () {
  'use strict';

  var stage = document.getElementById('reelStage');
  var track = document.getElementById('reelTrack');
  if (!stage || !track) return;

  var frames = Array.prototype.slice.call(track.querySelectorAll('.reel-frame'));
  if (!frames.length) return;

  var real = frames.length;

  /* 把这些帧再复制一份接在后面：转到复制区时位置刚好对得上，接缝看不出来 */
  frames.forEach(function (frame) {
    var copy = frame.cloneNode(true);
    copy.classList.remove('is-now');
    copy.setAttribute('aria-hidden', 'true');
    track.appendChild(copy);
  });
  frames = Array.prototype.slice.call(track.querySelectorAll('.reel-frame'));

  var prevBtn = document.getElementById('reelPrev');
  var nextBtn = document.getElementById('reelNext');
  var capEl = document.getElementById('reelCap');
  var countEl = document.getElementById('reelCount');
  var dotsEl = document.getElementById('reelDots');

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DWELL = 2800;          /* 每张只停一会儿，看着像一直在转 */
  var SLIDE = 680;           /* 比过渡时长多留一点，等它滑稳再归位 */
  var index = 0;
  var timer = null;
  var held = false;

  /* 小圆点：跳到某一张 */
  var dots = [];
  frames.slice(0, real).forEach(function (frame, i) {
    var dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'reel-dot';
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    dot.setAttribute('aria-label', '第 ' + (i + 1) + ' 张');
    dot.addEventListener('click', function () { go(i, true); });
    dotsEl.appendChild(dot);
    dots.push(dot);
  });

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* 把第 i 张推到舞台正中：offsetLeft 已相对 stage，不用再减 padding */
  function centerOf(i) {
    var w = frames[i].offsetWidth;
    return -(frames[i].offsetLeft - (stage.clientWidth - w) / 2);
  }

  function shift(x, animate) {
    if (animate === false) track.style.transition = 'none';
    track.style.transform = 'translate3d(' + Math.round(x) + 'px,0,0)';
    if (animate === false) {
      void track.offsetWidth;
      track.style.transition = '';
    }
  }

  function render(animate) {
    var at = index % real;
    if (at < 0) at += real;
    frames.forEach(function (frame, i) {
      frame.classList.toggle('is-now', i === index);
    });
    dots.forEach(function (dot, i) {
      dot.setAttribute('aria-selected', i === at ? 'true' : 'false');
    });
    capEl.textContent = frames[at].getAttribute('data-cap') || '';
    countEl.textContent = pad(at + 1) + ' / ' + pad(real);
    shift(centerOf(index), animate);
  }

  /* 转进复制区之后无声归位：那一张在两边位置完全一样，看不出切换 */
  function settle() {
    if (index >= real) { index -= real; render(false); }
    else if (index < 0) { index += real; render(false); }
  }

  function go(i, byUser) {
    /* 连着猛点可能叠出去两圈，先落回一圈内 */
    if (i >= real * 2 || i <= -real) {
      index = i % real;
      render(false);
      i = index;
    }
    index = i;
    render(true);
    if (byUser) restart();
    window.setTimeout(function () {
      if (index === i) settle();
    }, SLIDE);
  }

  /* 自动转：鼠标停在相片条上、键盘落在里面、页面切到后台，都先停 */
  function start() {
    stop();
    if (reduce || held || document.hidden) return;
    timer = window.setInterval(function () { go(index + 1, false); }, DWELL);
  }
  function stop() {
    if (timer) { window.clearInterval(timer); timer = null; }
  }
  function restart() { start(); }

  prevBtn.addEventListener('click', function () {
    /* 从第一张往回翻时，先无声落到复制区，再往左滑一张 */
    if (index <= 0) { index = real; render(false); }
    go(index - 1, true);
  });
  nextBtn.addEventListener('click', function () { go(index + 1, true); });

  frames.forEach(function (frame, i) {
    frame.addEventListener('click', function () {
      if (i !== index) go(i, true);
    });
  });

  stage.tabIndex = 0;
  stage.setAttribute('aria-label', '相片轮播，一直在自动转，也可以按左右方向键自己翻');
  stage.addEventListener('keydown', function (ev) {
    if (ev.key === 'ArrowLeft') { ev.preventDefault(); if (index <= 0) { index = real; render(false); } go(index - 1, true); }
    else if (ev.key === 'ArrowRight') { ev.preventDefault(); go(index + 1, true); }
  });

  stage.addEventListener('mouseenter', function () { held = true; stop(); });
  stage.addEventListener('mouseleave', function () { held = false; restart(); });
  stage.addEventListener('focusin', function () { held = true; stop(); });
  stage.addEventListener('focusout', function () { held = false; restart(); });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop();
    else restart();
  });

  /* 手机上左右划 */
  var sx = 0;
  var sy = 0;
  var dragging = false;
  var locked = false;

  stage.addEventListener('touchstart', function (ev) {
    sx = ev.touches[0].clientX;
    sy = ev.touches[0].clientY;
    dragging = true;
    locked = false;
  }, { passive: true });

  stage.addEventListener('touchmove', function (ev) {
    if (!dragging) return;
    var dx = ev.touches[0].clientX - sx;
    var dy = ev.touches[0].clientY - sy;
    if (!locked) {
      if (Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy) * 1.4) locked = true;
      else if (Math.abs(dy) > 22) { dragging = false; return; }
    }
    if (!locked) return;
    ev.preventDefault();
    track.style.transition = 'none';
    track.style.transform = 'translate3d(' + Math.round(centerOf(index) + dx * 0.55) + 'px,0,0)';
  }, { passive: false });

  stage.addEventListener('touchend', function (ev) {
    if (!dragging) return;
    dragging = false;
    if (!locked) return;
    var dx = ev.changedTouches[0].clientX - sx;
    track.style.transition = '';
    if (Math.abs(dx) > 46) {
      if (dx > 0 && index <= 0) { index = real; render(false); }
      go(index + (dx < 0 ? 1 : -1), true);
    } else render(true);
  }, { passive: true });

  /* 图片一张张加载完，宽度会变，重新对中一次 */
  var relayout = null;
  function queueLayout() {
    if (relayout) window.clearTimeout(relayout);
    relayout = window.setTimeout(function () {
      if (index >= real) index -= real;
      render(false);
    }, 60);
  }

  frames.forEach(function (frame) {
    var img = frame.querySelector('img');
    if (!img) return;
    if (!img.complete) img.addEventListener('load', queueLayout);
  });

  window.addEventListener('resize', queueLayout);
  window.addEventListener('load', queueLayout);

  render(false);
  start();
})();
