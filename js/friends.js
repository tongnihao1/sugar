/* sugar-lane · 朋友圈页
   数据存在 Supabase（项目 sugar-line / ap-southeast-1）。
   前端只用 publishable key，权限全靠库里的 RLS 与 GRANT，删改由 RPC 把关。 */
(function () {
  'use strict';

  var SB_URL  = 'https://oblpvxkrnpfnanetkzpz.supabase.co';
  var SB_KEY  = 'sb_publishable_qUWvcjrwBF9qfJNA98qNTg_30cztdQe';
  var API     = SB_URL + '/rest/v1';
  var STORE   = SB_URL + '/storage/v1';
  var BUCKET  = 'sugar-photos';
  var PAGE    = 10;          /* 每次翻多少条 */
  var MAX_SIDE = 1400;       /* 上传前压到长边 1400 */
  var QUALITY  = 0.82;

  var ME = (function () {
    try { return sessionStorage.getItem('sugar-lane:user') || ''; } catch (e) { return ''; }
  })();
  /* 目前只有 wusha 能删；口令走 RPC，前端只负责把它传过去 */
  var CAN_DELETE = ME === 'wusha';

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var el = {
    whoami:     $('#whoami'),
    logout:     $('#logoutBtn'),
    compose:    $('#composeForm'),
    pickZone:   $('#pickZone'),
    fileInput:  $('#fileInput'),
    previewWrap:$('#previewWrap'),
    previewImg: $('#previewImg'),
    previewSize:$('#previewSize'),
    clearPick:  $('#clearPick'),
    caption:    $('#captionInput'),
    captionCount:$('#captionCount'),
    publishBtn: $('#publishBtn'),
    composeHint:$('#composeHint'),
    stream:     $('#stream'),
    streamCount:$('#streamCount'),
    moreBtn:    $('#moreBtn'),
    toast:      $('#toast'),
    tpl:        $('#postTpl')
  };

  var state = {
    picked: null,      /* 压缩后的 Blob */
    pickedName: '',
    offset: 0,
    total: 0,
    loading: false,
    moments: []
  };

  /* ---------- 小工具 ---------- */

  var toastTimer = null;
  function toast(msg, bad) {
    if (!el.toast) return;
    el.toast.textContent = msg;
    el.toast.className = 'fri-toast is-show' + (bad ? ' is-bad' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.toast.className = 'fri-toast';
    }, 3200);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function relTime(iso) {
    var t = new Date(iso).getTime();
    if (!t || isNaN(t)) return '';
    var d = Math.floor((Date.now() - t) / 1000);
    if (d < 60) return '刚刚';
    if (d < 3600) return Math.floor(d / 60) + ' 分钟前';
    if (d < 86400) return Math.floor(d / 3600) + ' 小时前';
    if (d < 86400 * 7) return Math.floor(d / 86400) + ' 天前';
    var dt = new Date(t);
    return (dt.getMonth() + 1) + ' 月 ' + dt.getDate() + ' 日';
  }

  function initial(name) {
    var n = String(name || '?').trim();
    return n ? n.charAt(0).toUpperCase() : '?';
  }

  function headers(extra) {
    var h = {
      'apikey': SB_KEY,
      'Authorization': 'Bearer ' + SB_KEY
    };
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  }

  /* ---------- 与库打交道 ---------- */

  function apiGet(path, query) {
    return fetch(API + path + (query ? '?' + query : ''), { headers: headers() })
      .then(function (r) {
        if (!r.ok) return r.text().then(function (t) { throw new Error(t.slice(0, 200)); });
        return r.json();
      });
  }

  function apiPost(path, body, prefer) {
    return fetch(API + path, {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json', 'Prefer': prefer || 'return=representation' }),
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.text().then(function (t) {
        if (!r.ok) throw new Error(t.slice(0, 240));
        try { return JSON.parse(t); } catch (e) { return null; }
      });
    });
  }

  function uploadPhoto(blob) {
    var name = 'm/' + Date.now().toString(36) + '-' +
      Math.random().toString(36).slice(2, 8) + '.jpg';
    return fetch(STORE + '/object/' + BUCKET + '/' + name, {
      method: 'POST',
      headers: headers({
        'Content-Type': 'image/jpeg',
        'x-upsert': 'true',
        'cache-control': 'max-age=31536000'
      }),
      body: blob
    }).then(function (r) {
      return r.text().then(function (t) {
        if (!r.ok) throw new Error('照片没传上去：' + t.slice(0, 200));
        return STORE + '/object/public/' + BUCKET + '/' + name;
      });
    });
  }

  /* 长边压到 1400，避免手机原图几 MB 传半天 */
  function compress(file) {
    return new Promise(function (resolve, reject) {
      if (!/^image\//.test(file.type)) {
        reject(new Error('这个不是图片'));
        return;
      }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight;
        var scale = Math.min(1, MAX_SIDE / Math.max(w, h));
        var tw = Math.max(1, Math.round(w * scale));
        var th = Math.max(1, Math.round(h * scale));
        var cv = document.createElement('canvas');
        cv.width = tw; cv.height = th;
        var ctx = cv.getContext('2d');
        ctx.fillStyle = '#FFFCF9';
        ctx.fillRect(0, 0, tw, th);
        ctx.drawImage(img, 0, 0, tw, th);
        cv.toBlob(function (blob) {
          URL.revokeObjectURL(url);
          if (blob) resolve({ blob: blob, w: tw, h: th });
          else reject(new Error('图片处理失败'));
        }, 'image/jpeg', QUALITY);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('这张图打不开，换一张试试'));
      };
      img.src = url;
    });
  }

  /* ---------- 渲染 ---------- */

  function buildPost(m) {
    var node = el.tpl.content.firstElementChild.cloneNode(true);
    node.dataset.id = m.id;

    $('[data-av]', node).textContent = initial(m.author);
    $('[data-name]', node).textContent = m.author || '某人';
    $('[data-time]', node).textContent = relTime(m.created_at);

    var cap = $('[data-caption]', node);
    var caption = (m.caption || '').trim();
    if (caption) {
      cap.textContent = caption;
    } else {
      cap.remove();
    }

    var img = $('[data-photo]', node);
    img.src = m.image_url;
    img.alt = caption || (m.author || '某人') + ' 发的照片';
    img.loading = 'lazy';

    if (CAN_DELETE) {
      var delBtn = $('[data-del]', node);
      delBtn.hidden = false;
      delBtn.addEventListener('click', function () { removeMoment(m, node, delBtn); });
    }

    var list = $('[data-talklist]', node);
    var form = $('[data-talkform]', node);
    var input = $('[data-talkinput]', node);
    var hint = $('[data-talkhint]', node);

    renderComments(list, m.comments || []);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var body = input.value.trim();
      if (!body) { input.focus(); return; }
      var btn = $('[data-talksend]', node);
      btn.disabled = true;
      hint.textContent = '正在送出…';
      apiPost('/comments', { moment_id: m.id, author: ME || '某人', body: body }, 'return=representation')
        .then(function (rows) {
          var row = rows && rows[0];
          if (row) {
            m.comments = m.comments || [];
            m.comments.push(row);
            renderComments(list, m.comments);
          }
          input.value = '';
          hint.textContent = '';
          bumpCommentCount(1);
        })
        .catch(function (err) {
          hint.textContent = '没送出去：' + humanError(err);
        })
        .then(function () { btn.disabled = false; });
    });

    return node;
  }

  function renderComments(list, comments) {
    var html = '';
    for (var i = 0; i < comments.length; i++) {
      var c = comments[i];
      html += '<li class="talk-item"><b>' + esc(c.author) + '</b>' +
        '<span>' + esc(c.body) + '</span></li>';
    }
    list.innerHTML = html;
  }

  function humanError(err) {
    var s = (err && err.message) ? err.message : String(err);
    if (/permission denied/i.test(s)) return '这台机器没有这个权限，让站主看一下库里的授权';
    if (/violates row-level security/i.test(s)) return '这条内容不符合规则，改一下再试';
    if (/Failed to fetch|NetworkError/i.test(s)) return '连不上服务器，等一下再试';
    return s.replace(/^[{"].*?"message":"?([^",}]+).*$/, '$1').slice(0, 120);
  }

  function bumpCommentCount(delta) {
    var b = state.total;
    var c = $('.fri-comment-total');
    if (c) c.textContent = String(parseInt(c.dataset.n || '0', 10) + delta);
  }

  function ensureEmpty() {
    if (state.moments.length) return;
    el.stream.innerHTML = '<p class="fri-empty">这一格还空着。第一张，就等你来贴。</p>';
  }

  /* ---------- 拉数据 ---------- */

  function loadFeed(reset) {
    if (state.loading) return;
    state.loading = true;
    if (reset) {
      state.offset = 0;
      state.moments = [];
      el.stream.innerHTML = '<p class="fri-loading">正在把糖纸翻出来…</p>';
    }
    el.moreBtn.disabled = true;

    apiGet('/moments',
      'select=id,author,caption,image_url,created_at&order=created_at.desc&limit=' + PAGE + '&offset=' + state.offset)
      .then(function (rows) {
        if (reset) el.stream.innerHTML = '';
        state.moments = state.moments.concat(rows || []);
        if (!rows || !rows.length) {
          ensureEmpty();
          el.moreBtn.hidden = true;
          if (state.offset === 0) el.streamCount.textContent = '0 张';
          return [];
        }
        var ids = rows.map(function (r) { return '"' + r.id + '"'; }).join(',');
        return apiGet('/comments',
            'select=id,moment_id,author,body,created_at&order=created_at.asc&limit=500&moment_id=in.(' + ids + ')')
          .then(function (comments) {
            var byMoment = {};
            (comments || []).forEach(function (c) {
              (byMoment[c.moment_id] = byMoment[c.moment_id] || []).push(c);
            });
            rows.forEach(function (r) {
              r.comments = byMoment[r.id] || [];
              el.stream.appendChild(buildPost(r));
            });
            state.offset += rows.length;
            el.moreBtn.hidden = rows.length < PAGE;
            el.streamCount.textContent = state.offset + ' 张';
            return rows;
          });
      })
      .catch(function (err) {
        el.stream.innerHTML = '<p class="fri-empty">没翻出来：' + esc(humanError(err)) + '</p>';
        toast('加载失败，等一下再试', true);
      })
      .then(function () {
        state.loading = false;
        el.moreBtn.disabled = false;
      });
  }

  /* ---------- 发一条 ---------- */

  function setPick(blob, name, w, h) {
    state.picked = blob;
    state.pickedName = name || '';
    var url = URL.createObjectURL(blob);
    el.previewImg.src = url;
    el.previewWrap.hidden = false;
    el.previewSize.textContent = w && h ? w + ' × ' + h : '';
    el.pickZone.hidden = true;
    el.publishBtn.disabled = false;
  }

  function clearPick() {
    state.picked = null;
    state.pickedName = '';
    if (el.previewImg.src) URL.revokeObjectURL(el.previewImg.src);
    el.previewImg.removeAttribute('src');
    el.previewWrap.hidden = true;
    el.pickZone.hidden = false;
    el.fileInput.value = '';
    el.publishBtn.disabled = false;
  }

  function handleFile(file) {
    if (!file) return;
    el.composeHint.textContent = '正在把照片压小一点…';
    compress(file)
      .then(function (res) {
        setPick(res.blob, file.name, res.w, res.h);
        el.composeHint.textContent = '';
      })
      .catch(function (err) {
        el.composeHint.textContent = humanError(err);
        toast(humanError(err), true);
      });
  }

  function publish() {
    if (!state.picked) {
      el.composeHint.textContent = '先选一张照片';
      el.pickZone.focus();
      return;
    }
    var caption = (el.caption.value || '').trim();
    el.publishBtn.disabled = true;
    el.composeHint.textContent = '正在上传照片…（手机网络慢的话要等几秒）';

    uploadPhoto(state.picked)
      .then(function (publicUrl) {
        el.composeHint.textContent = '照片到了，正在贴上去…';
        return apiPost('/moments', {
          author: ME || '某人',
          caption: caption,
          image_url: publicUrl
        }, 'return=representation');
      })
      .then(function (rows) {
        var row = rows && rows[0];
        if (row) row.comments = [];
        clearPick();
        el.caption.value = '';
        updateCount();
        el.composeHint.textContent = '';
        toast('贴好了，去评论里回他一句');
        if (row) {
          var empty = $('.fri-empty', el.stream);
          if (empty) el.stream.innerHTML = '';
          el.stream.insertBefore(buildPost(row), el.stream.firstChild);
          state.moments.unshift(row);
          state.offset += 1;
          el.streamCount.textContent = state.offset + ' 张';
        }
      })
      .catch(function (err) {
        el.composeHint.textContent = humanError(err);
        toast('没贴上去：' + humanError(err), true);
      })
      .then(function () {
        el.publishBtn.disabled = false;
      });
  }

  /* ---------- 删 ---------- */

  function removeMoment(m, node, btn) {
    if (!CAN_DELETE) return;
    var pin = window.prompt('删掉「' + (m.author || '') + '」这条？\n输入管理口令确认：', '');
    if (pin === null) return;
    pin = (pin || '').trim();
    if (!pin) return;

    btn.disabled = true;
    btn.textContent = '删…';

    fetch(API + '/rpc/delete_moment', {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ p_id: m.id, p_token: pin })
    }).then(function (r) {
      return r.text().then(function (t) {
        if (!r.ok) throw new Error(t.slice(0, 240));
        return t;
      });
    }).then(function () {
      node.remove();
      state.offset = Math.max(0, state.offset - 1);
      el.streamCount.textContent = state.offset + ' 张';
      ensureEmpty();
      toast('删掉了');
    }).catch(function (err) {
      btn.disabled = false;
      btn.textContent = '删掉';
      var msg = humanError(err);
      if (/could not find the function|PGRST202/.test(err.message || '')) {
        msg = '库里还没有开这个删除口子，先执行建函数的那段 SQL';
      } else if (/token rejected/i.test(err.message || '')) {
        msg = '口令不对，删不了';
      }
      toast(msg, true);
    });
  }

  /* ---------- 计数 ---------- */

  function updateCount() {
    var n = el.caption.value.length;
    el.captionCount.textContent = n + ' / 1000';
  }

  /* ---------- 退出 ---------- */

  function logout() {
    try {
      sessionStorage.removeItem('sugar-lane:key');
      sessionStorage.removeItem('sugar-lane:user');
    } catch (e) {}
    location.replace('login.html');
  }

  /* ---------- 绑定 ---------- */

  function bind() {
    el.whoami.textContent = ME || '某人';
    if (el.logout) el.logout.addEventListener('click', logout);

    /* 选图 */
    el.pickZone.addEventListener('click', function () { el.fileInput.click(); });
    el.pickZone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.fileInput.click(); }
    });
    el.fileInput.addEventListener('change', function () {
      handleFile(el.fileInput.files && el.fileInput.files[0]);
    });
    ['dragenter', 'dragover'].forEach(function (ev) {
      el.pickZone.addEventListener(ev, function (e) {
        e.preventDefault();
        el.pickZone.classList.add('is-drag');
      });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      el.pickZone.addEventListener(ev, function (e) {
        e.preventDefault();
        el.pickZone.classList.remove('is-drag');
      });
    });
    el.pickZone.addEventListener('drop', function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      handleFile(f);
    });
    el.clearPick.addEventListener('click', clearPick);

    /* 配文 */
    el.caption.addEventListener('input', updateCount);

    /* 发布 */
    el.compose.addEventListener('submit', function (e) {
      e.preventDefault();
      publish();
    });

    /* 翻页 */
    el.moreBtn.addEventListener('click', function () { loadFeed(false); });

    updateCount();
    loadFeed(true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
