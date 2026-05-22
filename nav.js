/* 教室小幫手｜Nav FAB（回到頂部 + 工具導航）
 *
 * 在所有頁面右下角自動注入兩個 floating action button：
 *   ⬆ 回到頂部   (bottom: 84px, right: 20px) — 只在 scroll > 300px 顯示
 *   🧭 工具導航  (bottom: 148px, right: 20px) — 永遠顯示，點開展示 26 工具分類面板
 *
 * 與 tweaks FAB（bottom: 20px）堆疊不衝突。
 * SW banner / 備份 banner 居中（left: 50%）也不會撞。
 *
 * 自動偵測 currentPage：當頁工具會顯示「目前位置」chip 而非 button。
 */
(function () {
  'use strict';
  if (window.AkaiNavLoaded) return;
  window.AkaiNavLoaded = true;

  // ===== 工具目錄（與 README / index.html 同源） =====
  const GROUPS = [
    {
      title: '🌅 班級基礎五件套',
      tools: [
        { f: 'emotion.html',     i: '😊', t: '情緒打卡牆' },
        { f: 'todo.html',        i: '📝', t: '班級 To-Do' },
        { f: 'cards.html',       i: '🌈', t: '彩虹能量卡' },
        { f: 'attendance.html',  i: '📋', t: '出勤記錄表' },
        { f: 'marquee.html',     i: '📢', t: '跑馬燈通知' },
      ],
    },
    {
      title: '📚 課堂控場四件套',
      tools: [
        { f: 'picker.html',  i: '🎯', t: '隨機抽號' },
        { f: 'timer.html',   i: '⏱️', t: '教室計時器' },
        { f: 'grouper.html', i: '👥', t: '隨機分組' },
        { f: 'bell.html',    i: '🔔', t: '上下課鈴聲' },
      ],
    },
    {
      title: '🏆 班級管理三件套',
      tools: [
        { f: 'points.html',           i: '🏆', t: '班級積點榜' },
        { f: 'report.html',           i: '📊', t: '每月班級報告' },
        { f: 'emotion-history.html',  i: '📈', t: '情緒歷史趨勢' },
      ],
    },
    {
      title: '🎓 學生視角三件套',
      tools: [
        { f: 'student.html',         i: '🎓', t: '學生個人成長報告' },
        { f: 'finance.html',         i: '💰', t: '班費記帳' },
        { f: 'emotion-kiosk.html',   i: '🧒', t: '學生 Kiosk 打卡' },
      ],
    },
    {
      title: '🎉 教室生態三件套',
      tools: [
        { f: 'lottery.html', i: '🎲', t: '萬用抽籤箱' },
        { f: 'rules.html',   i: '📜', t: '班級公約' },
        { f: 'gallery.html', i: '🖼️', t: '學生作品牆' },
      ],
    },
    {
      title: '🪑 老師日常九件套',
      tools: [
        { f: 'seating.html',     i: '🪑', t: '座位表' },
        { f: 'schedule.html',    i: '📅', t: '課表' },
        { f: 'birthday.html',    i: '🎂', t: '生日榜' },
        { f: 'lunch.html',       i: '🍱', t: '午餐點餐' },
        { f: 'contact.html',     i: '📞', t: '親師溝通記錄' },
        { f: 'behavior.html',    i: '🎯', t: '行為觀察' },
        { f: 'substitute.html',  i: '📋', t: '代課交接單' },
        { f: 'field-trip.html',  i: '🎒', t: '戶外教學助手' },
        { f: 'lesson.html',      i: '📚', t: '教案備忘' },
      ],
    },
    {
      title: '🔧 設定與輔助',
      tools: [
        { f: 'index.html',   i: '🏠', t: '回主頁' },
        { f: 'roster.html',  i: '👥', t: '班級名單' },
        { f: 'backup.html',  i: '💾', t: '備份與還原' },
        { f: 'qr.html',      i: '📱', t: 'QR Code 工具' },
      ],
    },
  ];

  const currentFile = (() => {
    const p = location.pathname;
    const name = p.split('/').pop() || 'index.html';
    return name.toLowerCase();
  })();

  // ===== Style 注入（一次） =====
  function injectStyle() {
    if (document.getElementById('akai-nav-style')) return;
    const s = document.createElement('style');
    s.id = 'akai-nav-style';
    s.textContent = `
      .akai-nav-fab {
        position: fixed; right: 20px;
        width: 52px; height: 52px;
        border-radius: 50%;
        background: var(--ink, #2a1f4a);
        color: var(--y, #ffd23f);
        border: 3px solid var(--ink, #2a1f4a);
        font-size: 20px;
        cursor: pointer;
        box-shadow: 4px 4px 0 var(--ink, #2a1f4a);
        z-index: 9999;
        display: flex; align-items: center; justify-content: center;
        transition: transform .15s ease, box-shadow .15s ease, opacity .25s ease;
        font-family: inherit;
      }
      .akai-nav-fab:hover {
        transform: translate(-2px, -2px) rotate(-6deg);
        box-shadow: 6px 6px 0 var(--y, #ffd23f);
      }
      .akai-nav-fab:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 var(--ink, #2a1f4a); }

      .akai-nav-top  { bottom: 84px; opacity: 0; pointer-events: none; }
      .akai-nav-top.show { opacity: 1; pointer-events: auto; }
      .akai-nav-menu { bottom: 148px; }

      /* 面板 */
      .akai-nav-panel {
        position: fixed;
        bottom: 84px; right: 20px;
        width: min(380px, calc(100vw - 40px));
        max-height: calc(100vh - 120px);
        background: var(--paper, #fff8e8);
        border: 3px solid var(--ink, #2a1f4a);
        border-radius: 16px;
        box-shadow: 8px 8px 0 var(--ink, #2a1f4a);
        z-index: 10000;
        overflow: hidden;
        display: none;
        flex-direction: column;
        font-family: inherit;
      }
      .akai-nav-panel.show { display: flex; }
      .akai-nav-head {
        padding: 14px 16px;
        border-bottom: 2px dashed var(--ink, #2a1f4a);
        display: flex; align-items: center; gap: 10px;
        background: var(--y, #ffd23f);
      }
      .akai-nav-head h3 { margin: 0; font-size: 16px; color: var(--ink, #2a1f4a); flex: 1; }
      .akai-nav-close {
        border: 2px solid var(--ink, #2a1f4a);
        background: var(--paper, #fff8e8);
        width: 32px; height: 32px; border-radius: 50%;
        cursor: pointer; font-size: 14px; font-weight: 700;
        color: var(--ink, #2a1f4a);
      }
      .akai-nav-search {
        padding: 10px 14px;
        border-bottom: 2px dashed var(--ink, #2a1f4a);
      }
      .akai-nav-search input {
        width: 100%;
        padding: 8px 12px;
        border: 2px solid var(--ink, #2a1f4a);
        border-radius: 8px;
        font-size: 14px;
        font-family: inherit;
        background: #fff;
        color: var(--ink, #2a1f4a);
      }
      .akai-nav-search input:focus { outline: none; box-shadow: 3px 3px 0 var(--y, #ffd23f); }
      .akai-nav-body {
        overflow-y: auto;
        padding: 8px 10px 14px;
        flex: 1;
      }
      .akai-nav-group { margin-top: 8px; }
      .akai-nav-group-title {
        font-size: 12px; font-weight: 700;
        color: var(--ink, #2a1f4a); opacity: .65;
        padding: 6px 6px 4px;
        letter-spacing: .5px;
      }
      .akai-nav-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
      }
      .akai-nav-item {
        display: flex; align-items: center; gap: 6px;
        padding: 8px 10px;
        border: 2px solid var(--ink, #2a1f4a);
        border-radius: 8px;
        background: #fff;
        color: var(--ink, #2a1f4a);
        text-decoration: none;
        font-size: 13px; font-weight: 600;
        cursor: pointer;
        transition: transform .1s ease, box-shadow .1s ease;
        font-family: inherit;
      }
      .akai-nav-item:hover {
        transform: translate(-1px, -1px);
        box-shadow: 3px 3px 0 var(--y, #ffd23f);
      }
      .akai-nav-item.current {
        background: var(--y, #ffd23f);
        cursor: default;
        position: relative;
      }
      .akai-nav-item.current::after {
        content: '目前';
        position: absolute; top: -8px; right: -4px;
        background: var(--ink, #2a1f4a);
        color: var(--y, #ffd23f);
        font-size: 9px; padding: 2px 6px;
        border-radius: 999px;
        font-weight: 700;
      }
      .akai-nav-item .ic { font-size: 16px; flex-shrink: 0; }
      .akai-nav-item .tx { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .akai-nav-empty {
        text-align: center; padding: 20px;
        color: var(--ink, #2a1f4a); opacity: .5;
        font-size: 13px;
      }
      .akai-nav-foot {
        padding: 10px 14px;
        border-top: 2px dashed var(--ink, #2a1f4a);
        font-size: 11px;
        color: var(--ink, #2a1f4a); opacity: .6;
        text-align: center;
      }

      /* 列印時隱藏 */
      @media print {
        .akai-nav-fab, .akai-nav-panel { display: none !important; }
      }

      /* 手機 RWD */
      @media (max-width: 480px) {
        .akai-nav-fab { width: 46px; height: 46px; font-size: 18px; right: 14px; }
        .akai-nav-top { bottom: 72px; }
        .akai-nav-menu { bottom: 128px; }
        .akai-nav-panel {
          right: 14px; bottom: 72px;
          width: calc(100vw - 28px);
        }
        .akai-nav-grid { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(s);
  }

  // ===== Build DOM =====
  function buildPanel() {
    const panel = document.createElement('div');
    panel.className = 'akai-nav-panel';
    panel.id = 'akai-nav-panel';
    panel.innerHTML = `
      <div class="akai-nav-head">
        <h3>🧭 工具導航</h3>
        <button class="akai-nav-close" title="關閉" type="button">✕</button>
      </div>
      <div class="akai-nav-search">
        <input type="text" placeholder="🔍 搜尋工具名稱…" autocomplete="off" />
      </div>
      <div class="akai-nav-body" id="akai-nav-body"></div>
      <div class="akai-nav-foot">
        共 26 工具 · 點選即跳轉
      </div>
    `;

    const body = panel.querySelector('#akai-nav-body');
    GROUPS.forEach(g => {
      const wrap = document.createElement('div');
      wrap.className = 'akai-nav-group';
      wrap.dataset.title = g.title;
      const grid = g.tools.map(t => {
        const isCurrent = t.f.toLowerCase() === currentFile;
        return `<a class="akai-nav-item${isCurrent ? ' current' : ''}" href="${t.f}" data-name="${t.t}">
          <span class="ic">${t.i}</span><span class="tx">${t.t}</span>
        </a>`;
      }).join('');
      wrap.innerHTML = `
        <div class="akai-nav-group-title">${g.title}</div>
        <div class="akai-nav-grid">${grid}</div>
      `;
      body.appendChild(wrap);
    });

    // 關閉
    panel.querySelector('.akai-nav-close').onclick = () => panel.classList.remove('show');

    // 搜尋
    const inp = panel.querySelector('input');
    inp.addEventListener('input', () => {
      const q = inp.value.trim().toLowerCase();
      let total = 0;
      panel.querySelectorAll('.akai-nav-group').forEach(g => {
        let shown = 0;
        g.querySelectorAll('.akai-nav-item').forEach(it => {
          const name = (it.dataset.name || '').toLowerCase();
          const match = !q || name.includes(q);
          it.style.display = match ? '' : 'none';
          if (match) shown++;
        });
        g.style.display = shown > 0 ? '' : 'none';
        total += shown;
      });
      let empty = panel.querySelector('.akai-nav-empty');
      if (total === 0) {
        if (!empty) {
          empty = document.createElement('div');
          empty.className = 'akai-nav-empty';
          empty.textContent = '找不到符合的工具 🤔';
          body.appendChild(empty);
        }
      } else if (empty) {
        empty.remove();
      }
    });

    // 阻止當前頁的 item 跳轉
    panel.querySelectorAll('.akai-nav-item.current').forEach(it => {
      it.addEventListener('click', e => e.preventDefault());
    });

    // 點擊面板外關閉
    document.addEventListener('click', (e) => {
      if (!panel.classList.contains('show')) return;
      const menuBtn = document.getElementById('akai-nav-menu-btn');
      if (panel.contains(e.target)) return;
      if (menuBtn && menuBtn.contains(e.target)) return;
      panel.classList.remove('show');
    });

    return panel;
  }

  function buildFabs() {
    const topBtn = document.createElement('button');
    topBtn.className = 'akai-nav-fab akai-nav-top';
    topBtn.id = 'akai-nav-top-btn';
    topBtn.type = 'button';
    topBtn.title = '回到頂部';
    topBtn.innerHTML = '⬆';
    topBtn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });

    const menuBtn = document.createElement('button');
    menuBtn.className = 'akai-nav-fab akai-nav-menu';
    menuBtn.id = 'akai-nav-menu-btn';
    menuBtn.type = 'button';
    menuBtn.title = '工具導航（共 26 個）';
    menuBtn.innerHTML = '🧭';

    return { topBtn, menuBtn };
  }

  function init() {
    injectStyle();
    const { topBtn, menuBtn } = buildFabs();
    const panel = buildPanel();

    menuBtn.onclick = (e) => {
      e.stopPropagation();
      panel.classList.toggle('show');
      if (panel.classList.contains('show')) {
        const inp = panel.querySelector('input');
        if (inp) setTimeout(() => inp.focus(), 50);
      }
    };

    document.body.appendChild(topBtn);
    document.body.appendChild(menuBtn);
    document.body.appendChild(panel);

    // 滾動偵測 — 顯示/隱藏「回頂部」
    let scrollT;
    const checkScroll = () => {
      if (window.scrollY > 300) topBtn.classList.add('show');
      else topBtn.classList.remove('show');
    };
    window.addEventListener('scroll', () => {
      clearTimeout(scrollT);
      scrollT = setTimeout(checkScroll, 80);
    }, { passive: true });
    checkScroll();

    // ESC 關閉面板
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panel.classList.contains('show')) {
        panel.classList.remove('show');
      }
    });
  }

  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init);
})();
