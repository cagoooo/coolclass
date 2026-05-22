/* ============================================================
   onboarding.js — 教室小幫手 v3 首次使用引導
   只在使用者第一次打開首頁時跳出；可隨時按右下角浮鈕重新開啟。
   ============================================================ */

(function () {
  const KEY = 'akai_onboarded_v1';

  function alreadyOnboarded() {
    try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
  }
  function markDone() {
    try { localStorage.setItem(KEY, '1'); } catch {}
  }

  const SLIDES = [
    {
      tag: 'WELCOME · 你好',
      title: '歡迎使用<em>教室小幫手</em>',
      desc: '一套給老師的每日課堂工具，<b>已收錄 26 個小工具</b>：情緒打卡、能量卡、抽號、計時器、跑馬燈、座位表、生日榜、行為觀察…<br><br><b>免登入、不會把資料上傳</b>，所有記錄都存在你的瀏覽器裡。',
      visual: 'rainbow',
      cta: '開始介紹 →',
    },
    {
      tag: 'STEP 1 · 設定班級',
      title: '先建立<em>班級名單</em>',
      desc: '設定一次，<b>所有工具都自動帶入</b>：情緒打卡、出勤、抽號、分組、生日榜、座位表、行為觀察…<br><br>輸入班級名稱、人數、學生姓名（姓名可選填，沒填就顯示「3 號」）。可以從 Excel 直接複製貼上。',
      visual: 'roster',
      cta: '下一步 →',
      goto: 'roster.html',
      gotoLabel: '👥 現在去設定',
    },
    {
      tag: 'STEP 2 · 早晨例行',
      title: '每天<em>三分鐘</em>暖場',
      desc: '建議的早晨流程：<br><b>1. 情緒打卡</b> — 孩子進教室自己按下今天的心情<br><b>2. 看今日能量卡</b> — 一句小語，當作今天的心錨<br><b>3. 出勤點到</b> — 點格子就好，月底匯出 CSV 給教務處',
      visual: 'morning',
      cta: '下一步 →',
    },
    {
      tag: 'STEP 3 · 認識 26 工具',
      title: '<em>六大組</em>分類速覽',
      desc: '<b>🌅 基礎五件套</b>：情緒/待辦/能量卡/出勤/跑馬燈<br><b>📚 課堂控場</b>：抽號/計時器/分組/鈴聲<br><b>🏆 班級管理</b>：積點榜/月度報告/情緒趨勢<br><b>🎓 學生視角</b>：成長報告/班費/Kiosk 打卡<br><b>🎉 教室生態</b>：抽籤箱/班級公約/作品牆<br><b>🪑 老師日常</b>：座位/課表/生日/午餐/親師/行為/代課/戶外/教案',
      visual: 'tools',
      cta: '下一步 →',
    },
    {
      tag: 'STEP 4 · 安裝成 App',
      title: '加到主畫面，<em>離線可用</em>',
      desc: '電腦：用 Chrome / Edge 開啟，網址列右邊有「安裝」圖示。<br>iPad / iPhone：用 Safari → 分享 → 加入主畫面。<br><br>裝成 App 之後，<b>離線也能開</b>，速度也比較快。',
      visual: 'pwa',
      cta: '下一步 →',
    },
    {
      tag: 'TIPS · 右下角探秘',
      title: '<em>右下角</em>三顆按鈕',
      desc: '<b>🧭 工具導航</b> — 點開展示 26 工具分類面板（含搜尋），一鍵跳到任何工具<br><b>⬆ 回到頂部</b> — 捲到下方時浮現，點一下平滑回頂<br><b>🎨 視覺微調</b> — 換主色、深色模式、扁平模式、字級調整<br><br>還有：左上角「← 回主頁」、按 <b>?</b> 看當頁快捷鍵、跑馬燈支援「一鍵自動讀今日重點」<br><br>祝你和孩子一起，過好每一天 🌈',
      visual: 'tips',
      cta: '開始使用 ✨',
    },
  ];

  let idx = 0;
  let overlay = null;

  function el(html) {
    const d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstChild;
  }

  function buildOverlay() {
    overlay = el(`
      <div class="akai-ob-bg" role="dialog" aria-label="使用引導">
        <div class="akai-ob-modal">
          <div class="akai-ob-progress">
            ${SLIDES.map((_, i) => `<span class="akai-ob-dot" data-i="${i}"></span>`).join('')}
          </div>
          <button class="akai-ob-skip" title="跳過">跳過</button>
          <div class="akai-ob-slide-wrap" id="akai-ob-slide"></div>
          <div class="akai-ob-foot">
            <button class="akai-ob-back">← 上一步</button>
            <button class="akai-ob-goto" style="display:none;"></button>
            <button class="akai-ob-next">下一步 →</button>
          </div>
        </div>
      </div>
    `);
    document.body.appendChild(overlay);
    overlay.querySelector('.akai-ob-skip').onclick = close;
    overlay.querySelector('.akai-ob-back').onclick = back;
    overlay.querySelector('.akai-ob-next').onclick = next;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => overlay.classList.add('show'));
  }

  function renderSlide() {
    const s = SLIDES[idx];
    const wrap = overlay.querySelector('#akai-ob-slide');
    wrap.innerHTML = `
      <div class="akai-ob-slide" key="${idx}">
        <div class="akai-ob-visual akai-ob-vis-${s.visual}">${visualFor(s.visual)}</div>
        <span class="akai-ob-tag">${s.tag}</span>
        <h2 class="akai-ob-title">${s.title}</h2>
        <p class="akai-ob-desc">${s.desc}</p>
      </div>
    `;
    overlay.querySelectorAll('.akai-ob-dot').forEach((d, i) => {
      d.classList.toggle('on', i === idx);
      d.classList.toggle('done', i < idx);
      d.onclick = () => { idx = i; renderSlide(); };
    });
    overlay.querySelector('.akai-ob-back').style.visibility = idx === 0 ? 'hidden' : '';
    const nextBtn = overlay.querySelector('.akai-ob-next');
    nextBtn.textContent = s.cta || '下一步 →';
    const gotoBtn = overlay.querySelector('.akai-ob-goto');
    if (s.goto) {
      gotoBtn.style.display = '';
      gotoBtn.textContent = s.gotoLabel || '前往';
      gotoBtn.onclick = () => { markDone(); window.location.href = s.goto; };
    } else {
      gotoBtn.style.display = 'none';
    }
  }

  function visualFor(kind) {
    switch (kind) {
      case 'rainbow':
        return `
          <svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="200" height="120" rx="16" fill="var(--ink)"/>
            <path d="M 28 96 A 72 72 0 0 1 172 96" fill="none" stroke="#ff6b6b" stroke-width="12" stroke-linecap="round"/>
            <path d="M 48 96 A 52 52 0 0 1 152 96" fill="none" stroke="#ff9d4d" stroke-width="12" stroke-linecap="round"/>
            <path d="M 64 96 A 36 36 0 0 1 136 96" fill="none" stroke="#ffd23f" stroke-width="12" stroke-linecap="round"/>
            <path d="M 80 96 A 20 20 0 0 1 120 96" fill="none" stroke="#6bcb77" stroke-width="12" stroke-linecap="round"/>
            <circle cx="34" cy="32" r="14" fill="#ffd23f" stroke="#1a1230" stroke-width="3"/>
            <circle cx="166" cy="36" r="6" fill="#ff97c5"/>
            <circle cx="180" cy="60" r="4" fill="#4d96ff"/>
          </svg>`;
      case 'roster':
        return `
          <svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="200" height="120" rx="16" fill="var(--paper-2, #fff3d6)"/>
            ${[0,1,2,3,4,5,6,7,8,9].map((i) => {
              const x = 16 + (i % 5) * 36;
              const y = 18 + Math.floor(i / 5) * 38;
              return `<rect x="${x}" y="${y}" width="32" height="32" rx="8" fill="#fff" stroke="var(--ink)" stroke-width="2.5"/>
                      <text x="${x+16}" y="${y+22}" text-anchor="middle" font-family="Fraunces,serif" font-style="italic" font-weight="900" font-size="14" fill="var(--ink)">${i+1}</text>`;
            }).join('')}
            <rect x="16" y="94" width="168" height="14" rx="4" fill="var(--y)" stroke="var(--ink)" stroke-width="2"/>
          </svg>`;
      case 'morning':
        return `
          <svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="200" height="120" rx="16" fill="var(--paper-2, #fff3d6)"/>
            <rect x="14" y="20" width="56" height="80" rx="10" fill="#ff97c5" stroke="var(--ink)" stroke-width="3"/>
            <text x="42" y="56" text-anchor="middle" font-size="24">😄</text>
            <text x="42" y="80" text-anchor="middle" font-family="Fraunces,serif" font-style="italic" font-weight="900" font-size="14" fill="var(--ink)">12</text>
            <rect x="76" y="20" width="56" height="80" rx="10" fill="var(--y)" stroke="var(--ink)" stroke-width="3"/>
            <text x="104" y="48" text-anchor="middle" font-size="22">🌈</text>
            <text x="104" y="78" text-anchor="middle" font-family="Noto Sans TC,sans-serif" font-weight="900" font-size="9" fill="var(--ink)">今日心錨</text>
            <rect x="138" y="20" width="48" height="80" rx="10" fill="#4d96ff" stroke="var(--ink)" stroke-width="3"/>
            <text x="162" y="56" text-anchor="middle" font-family="Fraunces,serif" font-style="italic" font-weight="900" font-size="22" fill="#fff">28</text>
            <text x="162" y="80" text-anchor="middle" font-family="Noto Sans TC,sans-serif" font-weight="700" font-size="9" fill="#fff">/ 30 人</text>
          </svg>`;
      case 'pwa':
        return `
          <svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="200" height="120" rx="16" fill="var(--ink)"/>
            <rect x="62" y="16" width="76" height="88" rx="14" fill="var(--paper-2,#fff3d6)" stroke="#1a1230" stroke-width="3"/>
            <circle cx="100" cy="36" r="5" fill="var(--ink)"/>
            <circle cx="100" cy="62" r="18" fill="var(--y)" stroke="var(--ink)" stroke-width="2.5"/>
            <text x="100" y="68" text-anchor="middle" font-size="20">🌈</text>
            <text x="100" y="92" text-anchor="middle" font-family="Noto Sans TC,sans-serif" font-weight="900" font-size="10" fill="var(--ink)">教室小幫手</text>
            <text x="38" y="68" font-family="Fraunces,serif" font-style="italic" font-weight="900" font-size="22" fill="var(--y)">＋</text>
            <text x="158" y="68" font-family="Fraunces,serif" font-style="italic" font-weight="900" font-size="22" fill="var(--y)">App</text>
          </svg>`;
      case 'tools':
        return `
          <svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="200" height="120" rx="16" fill="var(--paper-2, #fff3d6)"/>
            ${[
              { x: 16, y: 14, c: '#ff6b6b', e: '😊' },
              { x: 48, y: 14, c: '#ffd23f', e: '📝' },
              { x: 80, y: 14, c: '#6bcb77', e: '🌈' },
              { x: 112, y: 14, c: '#4d96ff', e: '📋' },
              { x: 144, y: 14, c: '#ff97c5', e: '📢' },
              { x: 176, y: 14, c: '#ff9d4d', e: '🎯' },
              { x: 16, y: 46, c: '#ff9d4d', e: '⏱️' },
              { x: 48, y: 46, c: '#b070ff', e: '👥' },
              { x: 80, y: 46, c: '#ffd23f', e: '🔔' },
              { x: 112, y: 46, c: '#6bcb77', e: '🏆' },
              { x: 144, y: 46, c: '#4d96ff', e: '📊' },
              { x: 176, y: 46, c: '#ff97c5', e: '📈' },
              { x: 16, y: 78, c: '#b070ff', e: '🎓' },
              { x: 48, y: 78, c: '#6bcb77', e: '💰' },
              { x: 80, y: 78, c: '#ff6b6b', e: '🧒' },
              { x: 112, y: 78, c: '#ff9d4d', e: '🎲' },
              { x: 144, y: 78, c: '#4d96ff', e: '📜' },
              { x: 176, y: 78, c: '#ff97c5', e: '🖼️' },
            ].map(t => `
              <rect x="${t.x}" y="${t.y}" width="24" height="24" rx="6" fill="${t.c}" stroke="var(--ink)" stroke-width="2"/>
              <text x="${t.x+12}" y="${t.y+17}" text-anchor="middle" font-size="13">${t.e}</text>
            `).join('')}
            <text x="100" y="115" text-anchor="middle" font-family="Noto Sans TC,sans-serif" font-weight="900" font-size="9" fill="var(--ink)">…還有 9 個老師日常工具</text>
          </svg>`;
      case 'tips':
        return `
          <svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="200" height="120" rx="16" fill="var(--paper-2,#fff3d6)"/>
            <circle cx="100" cy="60" r="42" fill="var(--y)" stroke="var(--ink)" stroke-width="3"/>
            <circle cx="84" cy="52" r="5" fill="var(--ink)"/>
            <circle cx="116" cy="52" r="5" fill="var(--ink)"/>
            <path d="M 80 70 Q 100 86 120 70" fill="none" stroke="var(--ink)" stroke-width="4" stroke-linecap="round"/>
            <path d="M 152 32 L 158 44 L 170 50 L 158 56 L 152 68 L 146 56 L 134 50 L 146 44 Z" fill="#ff6b6b" stroke="var(--ink)" stroke-width="2"/>
            <circle cx="32" cy="92" r="6" fill="#6bcb77" stroke="var(--ink)" stroke-width="2"/>
            <circle cx="46" cy="28" r="4" fill="#4d96ff"/>
          </svg>`;
      default: return '';
    }
  }

  function next() {
    if (idx < SLIDES.length - 1) {
      idx++;
      renderSlide();
    } else {
      close();
    }
  }
  function back() {
    if (idx > 0) {
      idx--;
      renderSlide();
    }
  }
  function close() {
    markDone();
    if (!overlay) return;
    overlay.classList.remove('show');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => { overlay && overlay.remove(); overlay = null; }, 200);
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') back();
  }

  function open() {
    idx = 0;
    if (!overlay) buildOverlay();
    renderSlide();
  }

  // 自動開啟（首次）
  function maybeAutoOpen() {
    if (alreadyOnboarded()) return;
    // 等其他資源載入再開（避免遮住 install banner）
    setTimeout(open, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', maybeAutoOpen);
  } else {
    maybeAutoOpen();
  }

  // 對外暴露：讓首頁的「使用小提醒」可以再次開啟
  window.AkaiOnboarding = { open, reset() { try { localStorage.removeItem(KEY); } catch {} open(); } };
})();
