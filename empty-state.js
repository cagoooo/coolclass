/* 教室小幫手｜空狀態友善引導（v3.9 B3）
 *
 * 偵測當前頁是否依賴 roster（班級名單），若 roster 為空 → 在頂部插一個
 * 提示 banner，引導使用者去 roster.html 設定。
 *
 * 每個 session 只在每個工具提示一次（避免反覆打擾）。
 */
(function () {
  'use strict';
  if (window.AkaiEmptyStateLoaded) return;
  window.AkaiEmptyStateLoaded = true;

  // 需要 roster 才能用的工具（依 roster.count 或 names 判斷）
  const NEEDS_ROSTER = {
    'emotion.html':       { name: '情緒打卡牆', why: '需要班級名單顯示每位學生的格子' },
    'emotion-kiosk.html': { name: '學生 Kiosk 打卡', why: '學生需要從名單裡選自己' },
    'attendance.html':    { name: '出勤記錄表', why: '需要名單才能點到學生' },
    'picker.html':        { name: '隨機抽號', why: '抽號從名單範圍隨機選' },
    'grouper.html':       { name: '隨機分組', why: '需要學生人數才能分組' },
    'points.html':        { name: '班級積點榜', why: '加減分給名單內的學生' },
    'behavior.html':      { name: '行為觀察', why: '記錄哪位學生的行為' },
    'birthday.html':      { name: '生日榜', why: '記錄每位學生的生日' },
    'lunch.html':         { name: '午餐點餐', why: '記錄每位學生的午餐選擇' },
    'contact.html':       { name: '親師溝通記錄', why: '記錄與哪位家長溝通' },
    'seating.html':       { name: '座位表', why: '排座位需要學生編號' },
    'student.html':       { name: '學生個人成長報告', why: '顯示哪位學生的資料' },
    'gallery.html':       { name: '學生作品牆', why: '上傳的作品歸給哪位學生' },
    'emotion-history.html': { name: '情緒打卡歷史', why: '統計每位學生的情緒走勢' },
  };

  // Session 標記 key
  const SESSION_KEY_PREFIX = 'akai_empty_state_shown_';

  function currentPage() {
    const p = location.pathname;
    const name = (p.split('/').pop() || 'index.html').toLowerCase();
    return name;
  }

  function loadRoster() {
    try {
      if (window.AkaiRoster && typeof AkaiRoster.load === 'function') {
        return AkaiRoster.load();
      }
      const raw = localStorage.getItem('akai_roster_v1');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  }

  function isRosterEmpty(r) {
    if (!r) return true;
    if (!r.count || r.count === 0) return true;
    return false;
  }

  function isRosterUnnamed(r) {
    if (!r) return true;
    const names = r.names || {};
    return Object.keys(names).length === 0 || Object.values(names).every(v => !String(v || '').trim());
  }

  function alreadyShownThisSession(pageKey) {
    try { return sessionStorage.getItem(SESSION_KEY_PREFIX + pageKey) === '1'; }
    catch { return false; }
  }
  function markShown(pageKey) {
    try { sessionStorage.setItem(SESSION_KEY_PREFIX + pageKey, '1'); } catch {}
  }

  function injectStyle() {
    if (document.getElementById('akai-es-style')) return;
    const s = document.createElement('style');
    s.id = 'akai-es-style';
    s.textContent = `
      .akai-es-banner {
        background: linear-gradient(135deg, #ffd23f 0%, #ffb347 100%);
        border: 3px dashed var(--ink, #2a1f4a);
        border-radius: 14px;
        padding: 14px 18px;
        margin: 16px auto;
        max-width: 1200px;
        display: flex; gap: 14px; align-items: center;
        font-family: inherit;
        color: var(--ink, #2a1f4a);
        box-shadow: 4px 4px 0 var(--ink, #2a1f4a);
        position: relative;
      }
      .akai-es-icon {
        font-size: 28px;
        flex-shrink: 0;
        background: #fff;
        width: 48px; height: 48px;
        border-radius: 50%;
        border: 2px solid var(--ink, #2a1f4a);
        display: flex; align-items: center; justify-content: center;
      }
      .akai-es-body { flex: 1; line-height: 1.5; }
      .akai-es-body b { display: block; font-size: 15px; margin-bottom: 2px; }
      .akai-es-body small { font-size: 12px; opacity: .75; }
      .akai-es-actions { display: flex; gap: 8px; flex-shrink: 0; flex-wrap: wrap; }
      .akai-es-actions a, .akai-es-actions button {
        text-decoration: none;
        background: var(--ink, #2a1f4a);
        color: #fff;
        padding: 8px 16px;
        border-radius: 999px;
        font-weight: 700;
        font-size: 13px;
        border: 2px solid var(--ink, #2a1f4a);
        font-family: inherit;
        cursor: pointer;
        white-space: nowrap;
      }
      .akai-es-actions .ghost {
        background: transparent;
        color: var(--ink, #2a1f4a);
      }
      @media (max-width: 600px) {
        .akai-es-banner { flex-direction: column; align-items: flex-start; padding: 12px; margin: 10px; }
        .akai-es-icon { width: 36px; height: 36px; font-size: 20px; }
        .akai-es-actions { width: 100%; }
        .akai-es-actions a, .akai-es-actions button { flex: 1; text-align: center; }
      }
    `;
    document.head.appendChild(s);
  }

  function showBanner(opts) {
    injectStyle();
    if (document.querySelector('.akai-es-banner')) return;
    const banner = document.createElement('div');
    banner.className = 'akai-es-banner';
    banner.innerHTML = `
      <div class="akai-es-icon">${opts.icon}</div>
      <div class="akai-es-body">
        <b>${opts.title}</b>
        <small>${opts.desc}</small>
      </div>
      <div class="akai-es-actions">
        ${opts.actions.map(a => a.href
          ? `<a href="${a.href}">${a.label}</a>`
          : `<button type="button" class="${a.ghost ? 'ghost' : ''}" data-action="${a.id}">${a.label}</button>`
        ).join('')}
      </div>
    `;
    // 插到主要內容前面
    const wrap = document.querySelector('.wrap') || document.querySelector('main') || document.body;
    const firstChild = wrap.firstElementChild;
    if (firstChild && firstChild !== document.body) {
      wrap.insertBefore(banner, firstChild.nextSibling);  // 在 hero 後
    } else {
      wrap.prepend(banner);
    }
    // 處理 dismiss
    banner.querySelectorAll('[data-action="dismiss"]').forEach(b => {
      b.onclick = () => banner.remove();
    });
  }

  function init() {
    const page = currentPage();
    const cfg = NEEDS_ROSTER[page];
    if (!cfg) return;
    if (alreadyShownThisSession(page)) return;

    // 給其他 script 一點時間先載入 roster
    setTimeout(() => {
      const r = loadRoster();
      if (isRosterEmpty(r)) {
        showBanner({
          icon: '👥',
          title: `「${cfg.name}」需要班級名單`,
          desc: cfg.why + ' · 3 步驟可搞定（班級名 → 人數 → 姓名複製貼上）',
          actions: [
            { href: 'roster.html', label: '✏️ 現在去設定' },
            { id: 'dismiss', label: '稍後', ghost: true },
          ],
        });
        markShown(page);
      } else if (isRosterUnnamed(r) && (page === 'birthday.html' || page === 'contact.html' || page === 'student.html')) {
        // 對重視「姓名」的工具，提示補姓名
        showBanner({
          icon: '✏️',
          title: '建議補上學生姓名',
          desc: `${cfg.name}會顯示學生姓名，目前只有號碼。可到名單頁補上姓名。`,
          actions: [
            { href: 'roster.html', label: '✏️ 去補姓名' },
            { id: 'dismiss', label: '稍後', ghost: true },
          ],
        });
        markShown(page);
      }
    }, 200);
  }

  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init);
})();
