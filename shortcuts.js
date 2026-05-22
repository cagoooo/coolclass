/* 教室小幫手｜全頁快捷鍵總覽（v3.8 A4）
 *
 * 在所有頁面注入按 `?` 鍵彈出 modal 列出當頁支援的快捷鍵。
 * 也支援按 / 鍵聚焦右下角 🧭 工具導航的搜尋框（如果有開）。
 *
 * 偵測頁面：根據 location.pathname 對應不同 cheatsheet。
 */
(function () {
  'use strict';
  if (window.AkaiShortcutsLoaded) return;
  window.AkaiShortcutsLoaded = true;

  // ===== 各頁快捷鍵清單 =====
  const COMMON = [
    { k: '?',       d: '顯示 / 隱藏這張快捷鍵總覽' },
    { k: 'Esc',     d: '關閉彈出視窗 / 離開全螢幕' },
    { k: '/',       d: '聚焦右下角 🧭 工具導航搜尋框' },
    { k: 'Home',    d: '回到頁面頂部（瀏覽器原生）' },
  ];

  const PER_PAGE = {
    'picker.html': [
      { k: '空白鍵', d: '抽號（開始 / 再抽一次）' },
    ],
    'timer.html': [
      { k: '空白鍵', d: '開始 / 暫停計時' },
      { k: 'R',       d: '重設計時器' },
      { k: 'F',       d: '全螢幕模式' },
    ],
    'marquee.html': [
      { k: '空白鍵', d: '暫停 / 繼續跑馬燈' },
      { k: '點擊跑馬燈', d: '進入全螢幕投影' },
    ],
    'cards.html': [
      { k: '空白鍵', d: '抽下一張卡' },
      { k: '←  →',   d: '瀏覽歷史抽過的卡' },
      { k: 'F',       d: '收藏這張卡' },
    ],
    'index.html': [
      { k: '點工具卡 ⭐', d: '加到 / 移出「我的常用」' },
    ],
    'lottery.html': [
      { k: '空白鍵', d: '抽下一個' },
    ],
    'attendance.html': [
      { k: '點格子', d: '切換 4 種狀態（出席 → 遲到 → 請假 → 缺席）' },
    ],
  };

  function currentPageKey() {
    const path = location.pathname;
    const name = (path.split('/').pop() || 'index.html').toLowerCase();
    return name === '' || name === '/' ? 'index.html' : name;
  }

  // ===== Style 注入 =====
  function injectStyle() {
    if (document.getElementById('akai-sc-style')) return;
    const s = document.createElement('style');
    s.id = 'akai-sc-style';
    s.textContent = `
      .akai-sc-bg {
        position: fixed; inset: 0;
        background: rgba(15, 8, 32, 0.7);
        z-index: 10500;
        display: none;
        align-items: center; justify-content: center;
        backdrop-filter: blur(4px);
      }
      .akai-sc-bg.show { display: flex; }
      .akai-sc-modal {
        background: var(--paper, #fff8e8);
        border: 3px solid var(--ink, #2a1f4a);
        border-radius: 18px;
        box-shadow: 8px 8px 0 var(--ink, #2a1f4a);
        width: min(520px, calc(100vw - 32px));
        max-height: 80vh;
        overflow: hidden;
        display: flex; flex-direction: column;
        font-family: inherit;
      }
      .akai-sc-head {
        padding: 16px 20px;
        background: var(--y, #ffd23f);
        border-bottom: 2px dashed var(--ink, #2a1f4a);
        display: flex; align-items: center; gap: 12px;
      }
      .akai-sc-head h3 {
        margin: 0; font-size: 18px;
        color: var(--ink, #2a1f4a);
        flex: 1;
      }
      .akai-sc-close {
        border: 2px solid var(--ink, #2a1f4a);
        background: var(--paper, #fff8e8);
        width: 32px; height: 32px;
        border-radius: 50%;
        cursor: pointer; font-weight: 700;
        font-family: inherit;
        color: var(--ink, #2a1f4a);
      }
      .akai-sc-body {
        padding: 16px 20px;
        overflow-y: auto;
        flex: 1;
      }
      .akai-sc-section {
        margin-bottom: 18px;
      }
      .akai-sc-section:last-child { margin-bottom: 0; }
      .akai-sc-section h4 {
        margin: 0 0 10px;
        font-size: 12px;
        font-weight: 700;
        color: var(--ink, #2a1f4a);
        opacity: .55;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      .akai-sc-row {
        display: flex; align-items: center; gap: 12px;
        padding: 8px 0;
        border-bottom: 1px dashed rgba(42, 31, 74, .15);
      }
      .akai-sc-row:last-child { border-bottom: none; }
      .akai-sc-key {
        flex-shrink: 0;
        min-width: 100px;
        display: flex; gap: 4px; flex-wrap: wrap;
      }
      .akai-sc-key kbd {
        background: var(--paper, #fff8e8);
        border: 2px solid var(--ink, #2a1f4a);
        border-bottom-width: 3px;
        border-radius: 6px;
        padding: 3px 8px;
        font-family: 'Fraunces', 'Noto Sans TC', monospace;
        font-size: 12px;
        font-weight: 700;
        color: var(--ink, #2a1f4a);
        white-space: nowrap;
      }
      .akai-sc-desc {
        flex: 1;
        font-size: 14px;
        color: var(--ink, #2a1f4a);
        line-height: 1.4;
      }
      .akai-sc-foot {
        padding: 10px 20px;
        background: var(--paper-2, #fff3d6);
        border-top: 2px dashed var(--ink, #2a1f4a);
        text-align: center;
        font-size: 12px;
        color: var(--ink, #2a1f4a);
        opacity: .65;
      }
      .akai-sc-foot kbd {
        background: var(--paper, #fff8e8);
        border: 1.5px solid var(--ink, #2a1f4a);
        border-radius: 4px;
        padding: 1px 6px;
        font-family: monospace;
        font-size: 11px;
      }

      @media print {
        .akai-sc-bg { display: none !important; }
      }
      @media (max-width: 600px) {
        .akai-sc-key { min-width: 70px; }
        .akai-sc-key kbd { font-size: 11px; padding: 2px 6px; }
        .akai-sc-desc { font-size: 13px; }
      }
    `;
    document.head.appendChild(s);
  }

  function parseKeys(str) {
    return str.split(/\s+/).filter(Boolean).map(k => `<kbd>${k}</kbd>`).join(' ');
  }

  function buildModal() {
    if (document.getElementById('akai-sc-bg')) return document.getElementById('akai-sc-bg');
    const pageKey = currentPageKey();
    const pageKeys = PER_PAGE[pageKey] || [];

    const bg = document.createElement('div');
    bg.className = 'akai-sc-bg';
    bg.id = 'akai-sc-bg';
    bg.innerHTML = `
      <div class="akai-sc-modal" role="dialog" aria-label="鍵盤快捷鍵總覽">
        <div class="akai-sc-head">
          <h3>⌨️ 鍵盤快捷鍵</h3>
          <button class="akai-sc-close" title="關閉 (Esc)" type="button">✕</button>
        </div>
        <div class="akai-sc-body">
          ${pageKeys.length ? `
            <div class="akai-sc-section">
              <h4>📌 本頁專屬</h4>
              ${pageKeys.map(r => `
                <div class="akai-sc-row">
                  <div class="akai-sc-key">${parseKeys(r.k)}</div>
                  <div class="akai-sc-desc">${r.d}</div>
                </div>
              `).join('')}
            </div>
          ` : ''}
          <div class="akai-sc-section">
            <h4>🌐 全域通用</h4>
            ${COMMON.map(r => `
              <div class="akai-sc-row">
                <div class="akai-sc-key">${parseKeys(r.k)}</div>
                <div class="akai-sc-desc">${r.d}</div>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="akai-sc-foot">
          按 <kbd>?</kbd> 隨時打開這張總覽 · 按 <kbd>Esc</kbd> 關閉
        </div>
      </div>
    `;

    bg.querySelector('.akai-sc-close').onclick = () => bg.classList.remove('show');
    bg.addEventListener('click', (e) => {
      if (e.target === bg) bg.classList.remove('show');
    });
    document.body.appendChild(bg);
    return bg;
  }

  function open() {
    const bg = buildModal();
    bg.classList.add('show');
  }
  function close() {
    const bg = document.getElementById('akai-sc-bg');
    if (bg) bg.classList.remove('show');
  }
  function toggle() {
    const bg = document.getElementById('akai-sc-bg');
    if (bg && bg.classList.contains('show')) close();
    else open();
  }

  function init() {
    injectStyle();
    // 對外暴露
    window.AkaiShortcuts = { open, close, toggle };

    document.addEventListener('keydown', (e) => {
      // 在 input / textarea / contenteditable 中不觸發
      const t = e.target;
      const tag = t && t.tagName ? t.tagName.toUpperCase() : '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (t && t.isContentEditable)) return;

      // ? = shift + /
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        toggle();
        return;
      }
      // Esc 關閉
      if (e.key === 'Escape') {
        const bg = document.getElementById('akai-sc-bg');
        if (bg && bg.classList.contains('show')) {
          e.preventDefault();
          close();
        }
        return;
      }
      // / 聚焦工具導航搜尋
      if (e.key === '/' && !e.shiftKey) {
        const menuBtn = document.getElementById('akai-nav-menu-btn');
        const panel = document.getElementById('akai-nav-panel');
        if (menuBtn && panel) {
          e.preventDefault();
          if (!panel.classList.contains('show')) menuBtn.click();
          else {
            const inp = panel.querySelector('input');
            if (inp) inp.focus();
          }
        }
      }
    });
  }

  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init);
})();
