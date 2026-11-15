/* 首页回忆相片条 —— 左右翻照片，像把那天再走一遍 */
(function () {
  'use strict';

  var stage = document.getElementById('reelStage');
  var track = document.getElementById('reelTrack');
  if (!stage || !track) return;

  var frames = Array.prototype.slice.call(track.querySelectorAll('.reel-frame'));
  if (!frames.length) return;

  var prevBtn = document.getElementById('reelPrev');
  var nextBtn = document.getElementById('reelNext');
  var capEl = document.getElementById('reelCap');
  var countEl = document.getElementById('reelCount');
  var dotsEl = document.getElementById('reelDots');

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DWELL = 5500;
  var index = 0;
  var timer = null;
  var held = false;

  /* 小圆点：跳到某一张 */
  var dots = [];
  frames.forEach(function (frame, i) {
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
    frames.forEach(function (frame, i) {
      frame.classList.toggle('is-now', i === index);
    });
    dots.forEach(function (dot, i) {
      dot.setAttribute('aria-selected', i === index ? 'true' : 'false');
    });
    capEl.textContent = frames[index].getAttribute('data-cap') || '';
    countEl.textContent = pad(index + 1) + ' / ' + pad(frames.length);
    shift(centerOf(index), animate);
  }

  function go(i, byUser) {
    var n = frames.length;
    index = ((i % n) + n) % n;
    render(true);
    if (byUser) restart();
  }

  /* 自动翻页：鼠标停在相片条上、键盘落在里面、页面切到后台，都先停 */
  function start() {
    stop();
    if (reduce || held || document.hidden) return;
    timer = window.setInterval(function () { go(index + 1, false); }, DWELL);
  }
  function stop() {
    if (timer) { window.clearInterval(timer); timer = null; }
  }
  function restart() { start(); }

  prevBtn.addEventListener('click', function () { go(index - 1, true); });
  nextBtn.addEventListener('click', function () { go(index + 1, true); });

  frames.forEach(function (frame, i) {
    frame.addEventListener('click', function () {
      if (i !== index) go(i, true);
    });
  });

  stage.tabIndex = 0;
  stage.setAttribute('aria-label', '相片轮播，左右方向键可以翻');
  stage.addEventListener('keydown', function (ev) {
    if (ev.key === 'ArrowLeft') { ev.preventDefault(); go(index - 1, true); }
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
    if (Math.abs(dx) > 46) go(index + (dx < 0 ? 1 : -1), true);
    else render(true);
  }, { passive: true });

  /* 图片一张张加载完，宽度会变，重新对中一次 */
  var relayout = null;
  function queueLayout() {
    if (relayout) window.clearTimeout(relayout);
    relayout = window.setTimeout(function () { render(false); }, 60);
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
