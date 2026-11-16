/* sugar-lane · 个人主页
   只读自己这一份：贴过的照片、回过的话、收到的话。
   数据来自 Supabase，前端只带 publishable key。 */
(function () {
  'use strict';

  var SB_URL = 'https://oblpvxkrnpfnanetkzpz.supabase.co';
  var SB_KEY = 'sb_publishable_qUWvcjrwBF9qfJNA98qNTg_30cztdQe';
  var API    = SB_URL + '/rest/v1';

  var ME = (function () {
    try { return sessionStorage.getItem('sugar-lane:user') || ''; } catch (e) { return ''; }
  })();

  var $ = function (s, r) { return (r || document).querySelector(s); };

  var el = {
    whoami:   $('#whoami'),
    logout:   $('#logoutBtn'),
    av:       $('#profAv'),
    name:     $('#profName'),
    meta:     $('#profMeta'),
    statM:    $('#statMoments'),
    statC:    $('#statComments'),
    statR:    $('#statReceived'),
    grid:     $('#profGrid'),
    emptyM:   $('#profEmpty'),
    myCount:  $('#myCount'),
    received: $('#profReceived'),
    emptyR:   $('#recvEmpty'),
    said:     $('#profSaid'),
    emptyS:   $('#saidEmpty'),
    toast:    $('#toast')
  };

  var toastTimer = null;
  function toast(msg, bad) {
    if (!el.toast) return;
    el.toast.textContent = msg;
    el.toast.className = 'fri-toast is-show' + (bad ? ' is-bad' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.className = 'fri-toast'; }, 3200);
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
    if (d < 86400 * 30) return Math.floor(d / 86400) + ' 天前';
    var dt = new Date(t);
    return dt.getFullYear() + ' 年 ' + (dt.getMonth() + 1) + ' 月';
  }

  function humanError(err) {
    var s = (err && err.message) ? err.message : String(err);
    if (/Failed to fetch|NetworkError/i.test(s)) return '连不上服务器，等一下再试';
    if (/permission denied/i.test(s)) return '没有权限读这张表，让站主看一下授权';
    return s.slice(0, 120);
  }

  function headers() {
    return { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY };
  }

  function apiGet(path, query) {
    return fetch(API + path + (query ? '?' + query : ''), { headers: headers() })
      .then(function (r) {
        if (!r.ok) return r.text().then(function (t) { throw new Error(t.slice(0, 200)); });
        return r.json();
      });
  }

  /* ---------- 渲染 ---------- */

  function renderGrid(moments) {
    if (!moments.length) {
      el.grid.innerHTML = '';
      el.grid.hidden = true;
      el.emptyM.hidden = false;
      return;
    }
    el.emptyM.hidden = true;
    el.grid.hidden = false;
    var html = '';
    moments.forEach(function (m) {
      var cap = (m.caption || '').trim();
      html += '<a class="prof-cell" href="' + esc(m.image_url) + '" target="_blank" rel="noopener">' +
        '<img src="' + esc(m.image_url) + '" alt="' + esc(cap || '贴过的照片') + '" loading="lazy">' +
        (cap ? '<span class="prof-cell-cap">' + esc(cap) + '</span>' : '') +
        '<span class="prof-cell-time">' + esc(relTime(m.created_at)) + '</span>' +
        '</a>';
    });
    el.grid.innerHTML = html;
  }

  function renderReceived(list) {
    if (!list.length) {
      el.received.innerHTML = '';
      el.received.hidden = true;
      el.emptyR.hidden = false;
      return;
    }
    el.emptyR.hidden = true;
    el.received.hidden = false;
    var html = '';
    list.forEach(function (c) {
      html += '<li class="prof-line">' +
        '<b>' + esc(c.author) + '</b>' +
        '<span class="prof-line-body">' + esc(c.body) + '</span>' +
        '<span class="prof-line-time">' + esc(relTime(c.created_at)) + '</span>' +
        '</li>';
    });
    el.received.innerHTML = html;
  }

  function renderSaid(list) {
    if (!list.length) {
      el.said.innerHTML = '';
      el.said.hidden = true;
      el.emptyS.hidden = false;
      return;
    }
    el.emptyS.hidden = true;
    el.said.hidden = false;
    var html = '';
    list.forEach(function (c) {
      html += '<li class="prof-line">' +
        '<span class="prof-line-body">' + esc(c.body) + '</span>' +
        '<span class="prof-line-time">' + esc(relTime(c.created_at)) + '</span>' +
        '</li>';
    });
    el.said.innerHTML = html;
  }

  /* ---------- 主流程 ---------- */

  function load() {
    if (!ME) {
      el.meta.textContent = '没认出来你是谁，回登录页重新进来一下。';
      toast('没有读到登录身份', true);
      return;
    }

    el.whoami.textContent = ME;
    el.av.textContent = ME.charAt(0).toUpperCase();
    el.name.textContent = ME;
    el.meta.textContent = ME === 'wusha'
      ? '站主 · 这个罐子是你起的头'
      : '来串门的朋友 · 随手留一句就走';

    var q = 'select=id,image_url,caption,created_at&author=eq.' +
      encodeURIComponent(ME) + '&order=created_at.desc&limit=200';

    apiGet('/moments', q)
      .then(function (moments) {
        moments = moments || [];
        renderGrid(moments);
        el.statM.textContent = moments.length;
        el.myCount.textContent = moments.length + ' 张';

        var ids = moments.map(function (m) { return '"' + m.id + '"'; }).join(',');

        var saidP = apiGet('/comments',
          'select=id,moment_id,body,created_at&author=eq.' + encodeURIComponent(ME) +
          '&order=created_at.desc&limit=200')
          .then(function (rows) {
            rows = rows || [];
            renderSaid(rows);
            el.statC.textContent = rows.length;
          });

        var recvP = (ids
          ? apiGet('/comments',
              'select=id,moment_id,author,body,created_at&moment_id=in.(' + ids + ')' +
              '&author=neq.' + encodeURIComponent(ME) +
              '&order=created_at.desc&limit=200')
          : Promise.resolve([]))
          .then(function (rows) {
            rows = rows || [];
            renderReceived(rows);
            el.statR.textContent = rows.length;
          });

        return Promise.all([saidP, recvP]);
      })
      .catch(function (err) {
        el.meta.textContent = '没读出来：' + humanError(err);
        el.grid.innerHTML = '';
        el.received.innerHTML = '';
        el.said.innerHTML = '';
        toast('加载失败，等一下再试', true);
      });
  }

  function logout() {
    try {
      sessionStorage.removeItem('sugar-lane:key');
      sessionStorage.removeItem('sugar-lane:user');
    } catch (e) {}
    location.replace('login.html');
  }

  if (el.logout) el.logout.addEventListener('click', logout);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
