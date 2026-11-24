/* inapp-escape.js — 教室小幫手｜App 內建瀏覽器自動跳到預設瀏覽器（v4.8，2026-11-24）
 *
 * 為什麼：老師多半從 LINE 群組點連結打開，網頁會開在 LINE 的「內建瀏覽器」裡。
 * 教室小幫手的資料存在瀏覽器裡，存在 LINE 內建瀏覽器的資料，換用 Chrome／Safari 打開就看不到，
 * LINE 清除快取時也會一起被清掉；內建瀏覽器通常也不能下載備份檔、不能加到主畫面。
 *
 * 做法（參考 skill inapp-browser-oauth-escape 2026-11-08 定稿版，改成適合「不用登入、但資料存在本機」的版本）：
 *   - LINE：網址加官方參數 openExternalBrowser=1，自動改用手機預設瀏覽器開啟（保留原本的 query 與 hash）。
 *   - FB／IG／Messenger 等，Android：先畫引導，再用 intent:// 叫出 Chrome（每個分頁只試一次，沒裝 Chrome 帶 iabEscape=1 回來不再跳）。
 *   - iPhone 的 FB／IG 等：沒有可靠的自動方法，只顯示引導。
 *   - 如果老師「已經在 LINE 裡存了班級資料」：不直接跳走（不然到瀏覽器會看到空白），
 *     先顯示「把資料搬到瀏覽器」：按一下就把資料複製到剪貼簿、跳到瀏覽器的備份頁，再按一下貼上就搬完。
 *   - 引導都可以按「先留在這裡」關掉（同一個分頁不再出現）。
 * 放在每一頁 <head> 的最前面（同步載入），越早跳轉越好。
 */
(function () {
  'use strict';
  var ua = navigator.userAgent || '';
  var isLine = /\bLine\//i.test(ua);
  var isOtherInApp = /FBAN|FBAV|FB_IAB|Instagram|Messenger|MicroMessenger|KAKAOTALK/i.test(ua);
  if (!isLine && !isOtherInApp) return;
  var isAndroid = /Android/i.test(ua);
  window.AkaiInApp = isLine ? 'line' : (/Instagram/i.test(ua) ? 'instagram' : /Messenger/i.test(ua) ? 'messenger' : /MicroMessenger/i.test(ua) ? 'wechat' : /KAKAOTALK/i.test(ua) ? 'kakao' : 'facebook');

  // ===== 這台（這個 App 裡）有沒有班級資料 =====
  var NOT_DATA = ['akai_device_id_v1', 'akai_notify_queue_v1', 'akai_tool_open_v1', 'akai_dash_key_v1', 'akai_line_off',
    'akai_first_install_notified_v1', 'akai_idb_migrated_v1', 'akai_install_dismissed', 'akai_backup_reminder_dismissed_v1',
    'akai_last_backup_v1', 'akai_first_use_v1', 'akai_persist_asked_v1', 'akai_onboarded_v1', 'akai_tweaks_v1', 'akai_favs_v1',
    'akai_inapp_moved_v1'];
  function dataKeys() {
    var out = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('akai_') === 0 && NOT_DATA.indexOf(k) === -1 && k.indexOf('akai_empty_state_shown_') !== 0) out.push(k);
      }
    } catch (e) { /* 部分 App 關掉 localStorage */ }
    return out;
  }
  var moved = false;
  try { moved = localStorage.getItem('akai_inapp_moved_v1') === '1'; } catch (e) { /* 忽略 */ }
  var hasData = !moved && dataKeys().length > 0;
  var stay = false;
  try { stay = sessionStorage.getItem('akai_inapp_stay') === '1'; } catch (e) { /* 忽略 */ }

  function withParam(href, param) {
    var base = href.split('#')[0];
    var hash = href.indexOf('#') >= 0 ? href.slice(href.indexOf('#')) : '';
    return base + (base.indexOf('?') >= 0 ? '&' : '?') + param + hash;
  }
  function chromeIntentFor(url) {
    var u = new URL(url, location.href);
    var fallback = withParam(u.href, 'iabEscape=1');
    return 'intent://' + u.host + u.pathname + u.search + u.hash
      + '#Intent;scheme=' + u.protocol.replace(':', '')
      + ';package=com.android.chrome'
      + ';S.browser_fallback_url=' + encodeURIComponent(fallback) + ';end';
  }
  // 「用瀏覽器開啟」要去的網址（LINE 用官方參數；Android 其他 App 用 Chrome intent；iPhone 其他 App 沒有）
  function externalUrl(url) {
    if (isLine) return withParam(url, 'openExternalBrowser=1');
    if (isAndroid) return chromeIntentFor(url);
    return '';
  }

  // ===== 1) 沒有資料：直接自動跳 =====
  if (!hasData && !stay) {
    if (isLine && location.search.indexOf('openExternalBrowser=1') === -1) {
      location.replace(withParam(location.href, 'openExternalBrowser=1'));
      return;
    }
  }

  // ===== 2) 其他情況：畫引導（可關閉）=====
  var autoJump = false;
  if (!hasData && !stay && !isLine && isAndroid) {
    autoJump = location.search.indexOf('iabEscape=1') === -1;
    try { autoJump = autoJump && sessionStorage.getItem('iabEscapeTried') !== '1'; } catch (e) { /* 忽略 */ }
  }
  if (stay) return;

  // 把這個 App 裡的班級資料整理成備份格式（和備份頁同一種格式，備份頁可直接還原）
  function buildMovePack() {
    var pack = { _meta: { app: '教室小幫手 / classroom-kit', version: 'backup-v2', schemaVersion: '4.6', appVersion: 'v4.8-move', exportedAt: new Date().toISOString(), keysIncluded: [] } };
    dataKeys().concat(['akai_onboarded_v1', 'akai_tweaks_v1', 'akai_favs_v1']).forEach(function (k) {
      var raw = null;
      try { raw = localStorage.getItem(k); } catch (e) { /* 忽略 */ }
      if (raw === null) return;
      try { pack[k] = JSON.parse(raw); } catch (e) { pack[k] = raw; }
      pack._meta.keysIncluded.push(k);
    });
    return JSON.stringify(pack);
  }
  function copyText(text) {
    var done = function () { return true; };
    function legacy() {
      try {
        var ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
        document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
        var ok = document.execCommand('copy'); document.body.removeChild(ta); return ok;
      } catch (e) { return false; }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(done, legacy);
    }
    return Promise.resolve(legacy());
  }

  function render() {
    if (document.getElementById('inapp-browser-guide')) return;
    var appName = isLine ? 'LINE' : (window.AkaiInApp === 'instagram' ? 'Instagram' : window.AkaiInApp === 'messenger' ? 'Messenger' : window.AkaiInApp === 'wechat' ? '微信' : window.AkaiInApp === 'kakao' ? 'KakaoTalk' : 'Facebook');
    var ext = externalUrl(location.href);
    var btn = 'display:block;width:100%;box-sizing:border-box;margin:10px 0 0;padding:14px 18px;border-radius:999px;font-size:17px;font-weight:800;text-decoration:none;text-align:center;border:0;cursor:pointer;font-family:inherit;';
    var html;
    if (hasData) {
      html = '<div style="font-size:48px;">📦</div>'
        + '<h4 style="font-weight:900;font-size:21px;margin:10px 0 8px;">把班級資料搬到瀏覽器</h4>'
        + '<p style="font-size:15px;line-height:1.75;color:#cbd5e1;margin:0;">你的班級資料目前存在 <b style="color:#fbbf24;">' + appName + ' 的內建瀏覽器</b>裡，' + appName + ' 清除快取時可能會不見，也不能下載備份。<br>按下面的按鈕，資料會跟著搬到手機的瀏覽器。</p>'
        + (ext || !isLine ? '<button type="button" id="inapp-move" style="' + btn + 'background:#22c55e;color:#052e16;">📦 搬到瀏覽器（約 10 秒）</button>' : '')
        + '<p id="inapp-move-msg" style="font-size:14px;line-height:1.7;color:#94a3b8;margin:10px 0 0;">搬過去後，在瀏覽器的「備份與還原」頁按「貼上搬家資料」就完成了。</p>';
    } else {
      html = '<div style="font-size:48px;">🌐</div>'
        + '<h4 style="font-weight:900;font-size:21px;margin:10px 0 8px;">請改用瀏覽器開啟</h4>'
        + '<p style="font-size:15px;line-height:1.75;color:#cbd5e1;margin:0;">你目前在 <b style="color:#fbbf24;">' + appName + ' 的內建瀏覽器</b>裡。教室小幫手的班級資料存在瀏覽器裡，在這裡用的話，換個方式打開就看不到了。</p>'
        + (ext ? '<a id="inapp-open-browser" href="' + ext.replace(/"/g, '&quot;') + '" style="' + btn + 'background:#22c55e;color:#052e16;">' + (isLine ? '用手機瀏覽器開啟' : '用 Chrome 開啟') + '</a>' : '');
    }
    html += '<p style="font-size:14px;line-height:1.7;color:#cbd5e1;margin:14px 0 0;">' + (ext ? '按了沒反應的話，' : '') + '請點右上／右下角「<b>⋯</b>」→「<b style="color:#4ade80;">用預設瀏覽器開啟</b>」。</p>'
      + '<button type="button" id="inapp-stay" style="' + btn + 'background:transparent;color:#cbd5e1;border:1px solid #475569;font-size:14px;font-weight:600;padding:10px 18px;margin-top:16px;">先留在這裡繼續使用</button>';

    var d = document.createElement('div');
    d.id = 'inapp-browser-guide';
    d.setAttribute('role', 'dialog');
    d.setAttribute('aria-label', '請改用瀏覽器開啟');
    d.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,.96);color:#fff;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;font-family:"Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif;';
    d.innerHTML = '<div style="max-width:420px;width:100%;box-sizing:border-box;text-align:center;background:#1e293b;border-radius:20px;padding:28px 22px;border:2px solid #334155;">' + html + '</div>';
    document.body.appendChild(d);

    document.getElementById('inapp-stay').onclick = function () {
      try { sessionStorage.setItem('akai_inapp_stay', '1'); } catch (e) { /* 忽略 */ }
      d.remove();
    };
    var moveBtn = document.getElementById('inapp-move');
    if (moveBtn) {
      moveBtn.onclick = function () {
        var msg = document.getElementById('inapp-move-msg');
        moveBtn.disabled = true; moveBtn.textContent = '整理資料中…';
        copyText(buildMovePack()).then(function (ok) {
          if (!ok) {
            moveBtn.disabled = false; moveBtn.textContent = '📦 再試一次';
            msg.innerHTML = '⚠️ 這個 App 不讓網頁複製資料。請點「<b>⋯</b>」→「用預設瀏覽器開啟」後，回到 ' + appName + ' 這一頁的「備份與還原」用「複製到剪貼簿」搬家。';
            return;
          }
          try { localStorage.setItem('akai_inapp_moved_v1', '1'); } catch (e) { /* 忽略 */ }
          var target = new URL('backup.html#move', location.href).href;
          var go = externalUrl(target);
          moveBtn.textContent = '✅ 資料已複製';
          if (go) {
            msg.innerHTML = '正在打開瀏覽器…<br>到了之後按「<b>📋 貼上搬家資料</b>」就完成了。';
            setTimeout(function () { location.href = go; }, 400);
          } else {
            msg.innerHTML = '✅ 資料已複製！請點右上角「<b>⋯</b>」→「用預設瀏覽器開啟」，<br>再到「備份與還原」頁按「<b>📋 貼上搬家資料</b>」。';
          }
        });
      };
    }
    // 先把引導畫出來再自動叫 Chrome：就算跳轉被 App 擋下，畫面也不會停在空白
    if (autoJump && ext) {
      try { sessionStorage.setItem('iabEscapeTried', '1'); } catch (e) { /* 忽略 */ }
      setTimeout(function () { location.href = ext; }, 300);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();
