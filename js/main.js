/* sugar-lane · 糖霜小站主脚本（照片墙 + 心事浏览）
   由单文件版本拆出，纯原生 JS，无构建步骤。 */

(function () {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ===== 今天的日期（印章） ===== */
  const today = new Date();
  $('#stampDate').textContent = (today.getMonth() + 1) + '·' + today.getDate();

  /* ===== 轻提示 ===== */
  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-show'), 2600);
  }

  /* ===== 跟随指针的柔光 ===== */
  const glow = $('#cursorGlow');
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reduceMotion) {
    let queued = false, gx = 0, gy = 0;
    window.addEventListener('pointermove', (e) => {
      gx = e.clientX; gy = e.clientY;
      if (!queued) {
        queued = true;
        requestAnimationFrame(() => {
          glow.style.transform = 'translate(' + gx + 'px,' + gy + 'px)';
          queued = false;
        });
      }
    }, { passive: true });
  } else {
    glow.style.display = 'none';
  }

  /* ===== 飘落的糖粒 ===== */
  (function sugarFall() {
    const cvs = $('#sugarFall');
    if (!cvs || reduceMotion) return;
    const ctx = cvs.getContext('2d');
    const COLORS = ['#F4A98B', '#DF6189', '#79C3AC', '#F7DE9E', '#EFA0B0'];
    let W = 0, H = 0, bits = [], raf = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      cvs.width = Math.floor(W * dpr);
      cvs.height = Math.floor(H * dpr);
      cvs.style.width = W + 'px';
      cvs.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.min(72, Math.round(W / 18));
      bits = new Array(target).fill(0).map(makeBit);
    }

    function makeBit() {
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        r: 1.1 + Math.random() * 2.2,
        vy: 0.18 + Math.random() * 0.42,
        vx: (Math.random() - 0.5) * 0.22,
        a: 0.14 + Math.random() * 0.26,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.012,
        star: Math.random() < 0.34,
        c: COLORS[Math.floor(Math.random() * COLORS.length)]
      };
    }

    function drawStar(b) {
      const k = b.r * 1.5;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const ang = b.rot + i * Math.PI / 2;
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x + Math.cos(ang) * k, b.y + Math.sin(ang) * k);
      }
      ctx.stroke();
    }

    function tick() {
      ctx.clearRect(0, 0, W, H);
      for (const b of bits) {
        b.y += b.vy;
        b.x += b.vx;
        b.rot += b.vr;
        if (b.y - 12 > H) { b.y = -12; b.x = Math.random() * W; }
        if (b.x < -14) b.x = W + 12;
        if (b.x > W + 14) b.x = -12;
        ctx.globalAlpha = b.a;
        ctx.fillStyle = b.c;
        ctx.strokeStyle = b.c;
        if (b.star) {
          ctx.lineWidth = 1;
          drawStar(b);
        } else {
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    }

    function start() {
      if (raf) return;
      if (document.hidden) return;
      raf = requestAnimationFrame(tick);
    }
    function stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    }

    resize();
    start();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => { document.hidden ? stop() : start(); });
  })();

  /* ===== 本地数据库 ===== */
  const DB_NAME = 'sugar-lane-photos';
  const STORE = 'photos';
  let memoFallback = [];
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) { reject(new Error('no indexedDB')); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('open failed'));
    });
    return dbPromise;
  }

  function dbAll() {
    return openDB().then((db) => new Promise((resolve, reject) => {
      const t = db.transaction(STORE, 'readonly');
      const r = t.objectStore(STORE).getAll();
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = () => reject(r.error);
    }));
  }

  function dbPut(item) {
    return openDB().then((db) => new Promise((resolve, reject) => {
      const t = db.transaction(STORE, 'readwrite');
      t.objectStore(STORE).put(item);
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    }));
  }

  function dbDel(id) {
    return openDB().then((db) => new Promise((resolve, reject) => {
      const t = db.transaction(STORE, 'readwrite');
      t.objectStore(STORE).delete(id);
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    }));
  }

  /* ===== 压缩 ===== */
  function shrink(file, maxSide, quality) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) { reject(new Error('empty image')); return; }
        const scale = Math.min(1, maxSide / Math.max(w, h));
        const cw = Math.max(1, Math.round(w * scale));
        const ch = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const cx = canvas.getContext('2d');
        cx.fillStyle = '#FFFAF6';
        cx.fillRect(0, 0, cw, ch);
        cx.imageSmoothingQuality = 'high';
        cx.drawImage(img, 0, 0, cw, ch);
        canvas.toBlob((blob) => {
          if (blob) resolve({ blob: blob, w: cw, h: ch });
          else reject(new Error('encode failed'));
        }, 'image/jpeg', quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
      img.src = url;
    });
  }

  /* ===== 照片墙 ===== */
  const wall = $('#wall');
  const wallEmpty = $('#wallEmpty');
  const photoCount = $('#photoCount');
  const dropZone = $('#dropZone');
  const fileInput = $('#fileInput');
  let photos = [];
  let liveUrls = [];

  function fmtDate(ts) {
    const d = new Date(ts);
    return (d.getMonth() + 1) + '·' + d.getDate();
  }

  function releaseUrls() {
    liveUrls.forEach((u) => URL.revokeObjectURL(u));
    liveUrls = [];
  }

  function orderedPhotos() {
    return photos.slice().sort((a, b) => b.createdAt - a.createdAt);
  }

  function renderWall() {
    releaseUrls();
    wall.innerHTML = '';
    const has = photos.length > 0;
    wallEmpty.hidden = has;
    photoCount.textContent = has ? ('共 ' + photos.length + ' 张糖纸') : '还没有照片';
    if (!has) return;

    const rots = [-2.4, -1.1, 1.2, 2.2, -0.5, 1.7, -1.8, 0.6];
    orderedPhotos().forEach((p, i) => {
      const url = URL.createObjectURL(p.blob);
      liveUrls.push(url);
      const fig = document.createElement('figure');
      fig.className = 'snap';
      fig.style.setProperty('--rot', rots[i % rots.length] + 'deg');
      fig.style.animationDelay = Math.min(i, 10) * 42 + 'ms';
      fig.innerHTML =
        '<span class="tape"></span>' +
        '<img alt="" loading="lazy" decoding="async">' +
        '<div class="snap-meta"><span class="snap-date">' + fmtDate(p.createdAt) + '</span>' +
        '<button class="snap-del" type="button" aria-label="把这张照片取出来">×</button></div>';
      const img = fig.querySelector('img');
      img.src = url;
      img.alt = p.name ? p.name : '一张照片';
      fig.addEventListener('click', (ev) => {
        if (ev.target.closest('.snap-del')) return;
        openLightbox(p.id);
      });
      fig.querySelector('.snap-del').addEventListener('click', (ev) => {
        ev.stopPropagation();
        removePhoto(p.id);
      });
      wall.appendChild(fig);
    });
  }

  function removePhoto(id) {
    photos = photos.filter((p) => p.id !== id);
    memoFallback = memoFallback.filter((p) => p.id !== id);
    renderWall();
    dbDel(id).catch(() => {});
    toast('这张取出来了');
  }

  async function handleFiles(list) {
    const files = Array.from(list || []).filter((f) => f.type && f.type.indexOf('image/') === 0);
    if (!files.length) {
      toast('这些文件里没有能认出来的图片');
      return;
    }
    const titleEl = $('.dz-title', dropZone);
    const oldTitle = titleEl.textContent;
    dropZone.classList.add('is-busy');
    titleEl.textContent = '正在包糖纸…';

    let ok = 0, bad = 0;
    for (const f of files) {
      try {
        const out = await shrink(f, 1400, 0.82);
        const item = {
          id: 'p-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
          name: (f.name || '').replace(/^.*[\\\/]/, '').replace(/\.[^.]+$/, ''),
          blob: out.blob,
          w: out.w,
          h: out.h,
          createdAt: Date.now()
        };
        try {
          await dbPut(item);
        } catch (e) {
          memoFallback.push(item);
        }
        photos.push(item);
        renderWall();
        ok++;
      } catch (err) {
        bad++;
        console.warn('读不出这张图', f && f.name, err);
      }
    }

    dropZone.classList.remove('is-busy');
    titleEl.textContent = oldTitle;

    if (ok && bad) toast('放进来了 ' + ok + ' 张，还有 ' + bad + ' 张读不出来');
    else if (ok) toast(ok === 1 ? '放进来了，去看看吧' : ('放进来了 ' + ok + ' 张'));
    else toast('这几张读不出来，换 JPG 或 PNG 再试试');
  }

  /* 拖拽 */
  let dragDepth = 0;
  dropZone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragDepth++;
    dropZone.classList.add('is-drag');
  });
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); });
  dropZone.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) dropZone.classList.remove('is-drag');
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDepth = 0;
    dropZone.classList.remove('is-drag');
    handleFiles(e.dataTransfer && e.dataTransfer.files);
  });

  /* 点击与键盘 */
  function pickFiles() { fileInput.click(); }
  dropZone.addEventListener('click', pickFiles);
  dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickFiles(); }
  });
  $('#emptyPick').addEventListener('click', pickFiles);
  /* 文件框就在拖拽区里面，拦一下冒泡，免得点一次就循环触发 */
  fileInput.addEventListener('click', (e) => e.stopPropagation());
  fileInput.addEventListener('change', () => {
    handleFiles(fileInput.files);
    fileInput.value = '';
  });

  /* ===== 灯箱 ===== */
  const lightbox = $('#lightbox');
  const lbImg = $('#lbImg');
  const lbCaption = $('#lbCaption');
  let lbIndex = -1;
  let lastFocus = null;

  function showLb(index) {
    const list = orderedPhotos();
    if (!list.length) return;
    lbIndex = ((index % list.length) + list.length) % list.length;
    const p = list[lbIndex];
    if (lbImg.dataset.url) URL.revokeObjectURL(lbImg.dataset.url);
    const url = URL.createObjectURL(p.blob);
    lbImg.dataset.url = url;
    lbImg.src = url;
    lbImg.alt = p.name || '一张照片';
    lbCaption.textContent = (p.name || '照片') + ' · ' +
      new Date(p.createdAt).toLocaleDateString('zh-CN') + ' · ' + p.w + '×' + p.h;
  }

  function openLightbox(id) {
    const list = orderedPhotos();
    const index = list.findIndex((p) => p.id === id);
    if (index < 0) return;
    lastFocus = document.activeElement;
    showLb(index);
    lightbox.classList.add('is-open');
    $('#lbClose').focus();
  }

  function closeLightbox() {
    lightbox.classList.remove('is-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  $('#lbClose').addEventListener('click', closeLightbox);
  $('#lbPrev').addEventListener('click', () => showLb(lbIndex - 1));
  $('#lbNext').addEventListener('click', () => showLb(lbIndex + 1));
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  /* ===== 心事样例（全部虚构，不指向任何人）：数据在 js/moments.js ===== */
  const MOMENTS = window.SUGAR_MOMENTS || [];

  const TONES = { rose: '#DF6189', berry: '#8F4E6C', mint: '#5FAF98', peach: '#E9906E', butter: '#D9B45C' };
  const HEART_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:15px;height:15px;fill:currentColor">' +
    '<path d="M12 20.4s-8.2-5-8.2-11.2A4.7 4.7 0 0112 6.4a4.7 4.7 0 018.2 2.8c0 6.2-8.2 11.2-8.2 11.2z"/></svg>';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  function whenText(days) {
    if (days <= 0) return '此刻';
    if (days === 1) return '昨天';
    return '第 ' + days + ' 天';
  }

  function sweetText(j) { return '甜度 ' + j.sweetMin + '–' + j.sweetMax; }

  /* ===== 收藏 ===== */
  const SAVE_KEY = 'sugar-lane-saved';
  let savedIds = new Set();
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || '[]');
    if (Array.isArray(raw)) savedIds = new Set(raw.filter((x) => typeof x === 'string'));
  } catch (e) { }
  function persistSaved() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(Array.from(savedIds))); } catch (e) { }
  }

  /* ===== 心事列表 ===== */
  const jobList = $('#jobList');
  const jobEmpty = $('#jobEmpty');
  const state = { q: '', stage: 'all', sort: 'new', onlySaved: false };

  function filterJobs() {
    let list = MOMENTS.slice();
    const q = state.q.trim().toLowerCase();
    if (q) {
      list = list.filter((j) => {
        const hay = (j.title + ' ' + j.scene + ' ' + j.place + ' ' + j.stage + ' ' + j.tags.join(' ')).toLowerCase();
        return hay.indexOf(q) !== -1;
      });
    }
    if (state.stage !== 'all') list = list.filter((j) => j.stage === state.stage);
    if (state.onlySaved) list = list.filter((j) => savedIds.has(j.id));
    if (state.sort === 'sweet') list.sort((a, b) => b.sweetMax - a.sweetMax);
    else if (state.sort === 'easy') list.sort((a, b) => a.need - b.need || a.days - b.days);
    else list.sort((a, b) => a.days - b.days);
    return list;
  }

  function buildCard(j) {
    const el = document.createElement('article');
    el.className = 'job';
    el.tabIndex = 0;
    el.dataset.id = j.id;
    el.setAttribute('aria-label', '查看这段心事：' + j.title + '，' + j.scene);
    el.innerHTML =
      '<div class="job-seal" data-tone="' + j.tone + '">' + esc(j.scene.slice(0, 1)) + '</div>' +
      '<div class="job-main">' +
        '<h3 class="job-title">' + esc(j.title) +
          (j.days <= 3 ? '<span class="new-dot" title="最近新发"></span>' : '') +
        '</h3>' +
        '<p class="job-company">' + esc(j.scene) + ' · ' + esc(j.place) + '</p>' +
        '<div class="job-tags">' +
          '<span class="tag" data-kind="mode">' + esc(j.stage) + '</span>' +
          j.tags.slice(0, 3).map((t) => '<span class="tag">' + esc(t) + '</span>').join('') +
        '</div>' +
      '</div>' +
      '<div class="job-side">' +
        '<p class="job-pay">' + sweetText(j) + '</p>' +
        '<p class="job-when">' + whenText(j.days) + '</p>' +
      '</div>' +
      '<button class="heart" type="button" aria-pressed="' + (savedIds.has(j.id) ? 'true' : 'false') +
        '" aria-label="收藏 ' + esc(j.title) + '">' + HEART_SVG + '</button>';

    el.addEventListener('click', (ev) => {
      if (ev.target.closest('.heart')) return;
      openDrawer(j.id);
    });
    el.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        openDrawer(j.id);
      }
    });
    el.querySelector('.heart').addEventListener('click', (ev) => {
      ev.stopPropagation();
      toggleSaved(j.id);
    });
    return el;
  }

  const PAGE = 20;
  let shown = PAGE;

  const jobMore = document.createElement('button');
  jobMore.type = 'button';
  jobMore.className = 'btn btn-ghost more-btn';
  jobMore.id = 'jobMore';
  jobMore.hidden = true;
  jobList.parentNode.insertBefore(jobMore, jobList.nextSibling);
  jobMore.addEventListener('click', () => { shown += PAGE; renderJobs(); });

  function renderJobs() {
    const list = filterJobs();
    jobList.innerHTML = '';
    jobEmpty.hidden = list.length > 0;
    const visible = list.slice(0, shown);
    const frag = document.createDocumentFragment();
    visible.forEach((j) => frag.appendChild(buildCard(j)));
    jobList.appendChild(frag);
    const rest = list.length - visible.length;
    jobMore.hidden = rest <= 0;
    if (rest > 0) jobMore.textContent = '再翻二十段（还剩 ' + rest + ' 段）';
  }

  function syncHearts() {
    $$('.heart', jobList).forEach((btn) => {
      const card = btn.closest('.job');
      btn.setAttribute('aria-pressed', savedIds.has(card.dataset.id) ? 'true' : 'false');
    });
    syncDrawerSave();
  }

  function toggleSaved(id) {
    const j = MOMENTS.find((x) => x.id === id);
    if (!j) return;
    if (savedIds.has(id)) {
      savedIds.delete(id);
      toast('从罐子里拿出来了');
    } else {
      savedIds.add(id);
      toast('收进罐子了：' + j.title);
    }
    persistSaved();
    syncHearts();
    if (state.onlySaved) renderJobs();
  }

  /* ===== 详情抽屉 ===== */
  const drawer = $('#drawer');
  const scrim = $('#scrim');
  let currentJobId = null;
  let drawerReturnFocus = null;

  function fillList(sel, items) {
    const box = $(sel);
    box.innerHTML = '';
    items.forEach((t) => {
      const li = document.createElement('li');
      li.textContent = t;
      box.appendChild(li);
    });
  }

  function syncDrawerSave() {
    const btn = $('#drawerSave');
    if (!currentJobId) return;
    const on = savedIds.has(currentJobId);
    btn.textContent = on ? '已经收在罐子里' : '收进罐子';
    btn.classList.toggle('btn-primary', on);
    btn.classList.toggle('btn-ghost', !on);
  }

  function openDrawer(id) {
    const j = MOMENTS.find((x) => x.id === id);
    if (!j) return;
    currentJobId = id;
    drawerReturnFocus = document.activeElement;

    const seal = $('#drawerSeal');
    seal.textContent = j.scene.slice(0, 1);
    seal.setAttribute('data-tone', j.tone);
    $('#drawerTitle').textContent = j.title;
    $('#drawerCompany').textContent = j.scene + ' · ' + j.place + ' · ' + j.stage;
    $('#drawerPay').textContent = sweetText(j) + ' · 示例分数';
    fillList('#drawerDuties', j.beats);
    fillList('#drawerNeeds', j.signs);
    $('#drawerTags').innerHTML = j.sweets.map((p) => '<span class="tag">' + esc(p) + '</span>').join('');
    syncDrawerSave();

    scrim.hidden = false;
    requestAnimationFrame(() => scrim.classList.add('is-open'));
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    $('#drawerClose').focus();
  }

  function closeDrawer() {
    if (!drawer.classList.contains('is-open')) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    scrim.classList.remove('is-open');
    document.body.style.overflow = '';
    setTimeout(() => { if (!scrim.classList.contains('is-open')) scrim.hidden = true; }, 340);
    currentJobId = null;
    if (drawerReturnFocus && drawerReturnFocus.focus) drawerReturnFocus.focus();
  }

  $('#drawerClose').addEventListener('click', closeDrawer);
  scrim.addEventListener('click', closeDrawer);
  $('#drawerSave').addEventListener('click', () => {
    if (currentJobId) toggleSaved(currentJobId);
  });
  $('#drawerApply').addEventListener('click', () => {
    toast('这些心事只是写着玩的，不一定会发生。想的话，自己去把它变成真的');
  });

  /* ===== 筛选与排序 ===== */
  const searchInput = $('#jobSearch');
  searchInput.addEventListener('input', () => {
    state.q = searchInput.value || '';
    shown = PAGE;
    renderJobs();
  });

  $('#typeChips').addEventListener('click', (ev) => {
    const chip = ev.target.closest('.chip');
    if (!chip) return;
    $$('.chip', $('#typeChips')).forEach((c) => c.classList.toggle('is-on', c === chip));
    state.stage = chip.dataset.stage;
    shown = PAGE;
    renderJobs();
  });

  $('#jobSort').addEventListener('change', (ev) => {
    state.sort = ev.target.value;
    shown = PAGE;
    renderJobs();
  });

  const savedToggle = $('#savedToggle');
  savedToggle.addEventListener('click', () => {
    state.onlySaved = !state.onlySaved;
    savedToggle.setAttribute('aria-pressed', state.onlySaved ? 'true' : 'false');
    shown = PAGE;
    renderJobs();
  });

  /* ===== 甜度分布小图表 ===== */
  const BUCKETS = [
    { label: '9 分以下', min: -1, max: 9, color: '#F6C9BD' },
    { label: '9–9.2', min: 9, max: 9.2, color: '#EFA3A6' },
    { label: '9.2–9.4', min: 9.2, max: 9.4, color: '#DF6189' },
    { label: '9.4 分以上', min: 9.4, max: 999, color: '#8F4E6C' }
  ];

  function sweetStats() {
    return BUCKETS.map((b) => {
      const n = MOMENTS.filter((j) => {
        const mid = (j.sweetMin + j.sweetMax) / 2;
        return mid >= b.min && mid < b.max;
      }).length;
      return { label: b.label, color: b.color, n: n };
    });
  }

  function medianSweet() {
    const mids = MOMENTS.map((j) => (j.sweetMin + j.sweetMax) / 2).sort((a, b) => a - b);
    const n = mids.length;
    return n % 2 ? mids[(n - 1) / 2] : (mids[n / 2 - 1] + mids[n / 2]) / 2;
  }

  function drawPayChart() {
    const stats = sweetStats();
    const max = Math.max(1, Math.max.apply(null, stats.map((s) => s.n)));
    const box = $('#payChart');
    box.innerHTML =
      '<div class="paybars">' +
        stats.map((s) =>
          '<div class="paybar-row"><span>' + s.label + '</span>' +
          '<div class="track"><i data-w="' + Math.round((s.n / max) * 100) + '" style="width:0;background:' + s.color + '"></i></div>' +
          '<b>' + s.n + '</b></div>'
        ).join('') +
        '<div class="pay-total"><span>一共 ' + MOMENTS.length + ' 段</span>' +
        '<b>中位甜度 ' + medianSweet().toFixed(1) + '</b></div>' +
      '</div>';

    const paint = () => {
      $$('.track i', box).forEach((bar) => { bar.style.width = bar.dataset.w + '%'; });
    };
    if (reduceMotion) paint();
    else requestAnimationFrame(paint);
  }

  /* ===== 回到顶部 ===== */
  $('#toTop').addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  /* ===== 键盘 ===== */
  document.addEventListener('keydown', (ev) => {
    if (lightbox.classList.contains('is-open')) {
      if (ev.key === 'Escape') { ev.preventDefault(); closeLightbox(); }
      else if (ev.key === 'ArrowLeft') { ev.preventDefault(); showLb(lbIndex - 1); }
      else if (ev.key === 'ArrowRight') { ev.preventDefault(); showLb(lbIndex + 1); }
      return;
    }
    if (ev.key === 'Escape' && drawer.classList.contains('is-open')) {
      ev.preventDefault();
      closeDrawer();
    }
  });

  /* ===== 启动 ===== */
  renderJobs();
  drawPayChart();

  dbAll().then((list) => {
    photos = list;
    renderWall();
  }).catch((err) => {
    console.warn('本地数据库打不开，照片只在这次打开期间有效', err);
    photos = memoFallback.slice();
    renderWall();
    toast('这台浏览器不让存东西，照片只在这次打开期间在');
  });

})();
