/* ============================================================
   tweaks.js — 教室小幫手 v3 視覺微調面板
   主色 / 深色模式 / 背景裝飾 / 扁平模式
   設定存在 localStorage 'akai_tweaks_v1'，每頁載入時套用
   ============================================================ */

(function () {
  const KEY = 'akai_tweaks_v1';
  const DEFAULT = {
    accent: 'rainbow',  // rainbow / mint / sunset / berry / ocean
    theme: 'light',     // light / dark
    deco: 'on',         // on / off
    flat: 'off',        // off / on
    scale: 100,         // 90 / 100 / 110
  };

  const ACCENTS = [
    { id: 'rainbow',   label: '彩虹（預設）', color: '#ffd23f' },
    { id: 'mint',      label: '薄荷',         color: '#6bcb77' },
    { id: 'sunset',    label: '日落',         color: '#ff9d4d' },
    { id: 'berry',     label: '莓果',         color: '#b070ff' },
    { id: 'ocean',     label: '海洋',         color: '#4d96ff' },
    { id: 'xmas',      label: '🎄 聖誕',      color: '#d62b2b' },
    { id: 'lunar',     label: '🧧 春節',      color: '#ffc94a' },
    { id: 'eco',       label: '🌳 環保',      color: '#5a8c43' },
  ];

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { ...DEFAULT };
      return { ...DEFAULT, ...JSON.parse(raw) };
    } catch { return { ...DEFAULT }; }
  }
  function save(t) {
    localStorage.setItem(KEY, JSON.stringify(t));
    try { window.dispatchEvent(new CustomEvent('tweaks-changed', { detail: t })); } catch {}
  }

  function apply(t) {
    const h = document.documentElement;
    h.dataset.accent = t.accent || 'rainbow';
    h.dataset.theme  = t.theme  || 'light';
    h.dataset.deco   = t.deco   || 'on';
    h.dataset.flat   = t.flat   || 'off';
    h.style.fontSize = (t.scale || 100) + '%';
    updateThemeColor(t);
  }

  function updateThemeColor(t) {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    if (t.theme === 'dark') {
      meta.content = '#15102e';
    } else {
      const a = ACCENTS.find(x => x.id === t.accent) || ACCENTS[0];
      meta.content = a.color;
    }
  }

  // ===== 初始化：頁面一載入就套用 =====
  let tweaks = load();
  apply(tweaks);

  // ===== 面板 UI（lazy-build；活化時才建立） =====
  let panelEl = null;
  let panelOpen = false;

  function html(s) { const d = document.createElement('div'); d.innerHTML = s.trim(); return d.firstChild; }

  function buildPanel() {
    const t = tweaks;
    const root = html(`
      <div class="akai-tweaks" role="dialog" aria-label="視覺微調">
        <div class="akai-tweaks-head">
          <div class="akai-tweaks-title">
            <span class="dot"></span>
            <span>Tweaks <small>視覺微調</small></span>
          </div>
          <button class="akai-tweaks-close" title="關閉">✕</button>
        </div>

        <div class="akai-tweaks-body">

          <div class="akai-tw-section">
            <div class="akai-tw-label">主色 ACCENT</div>
            <div class="akai-tw-swatches" id="tw-accents"></div>
          </div>

          <div class="akai-tw-section">
            <div class="akai-tw-label">主題 MODE</div>
            <div class="akai-tw-seg" id="tw-theme">
              <button data-v="light" class="${t.theme==='light'?'on':''}">☀ 淺色</button>
              <button data-v="dark"  class="${t.theme==='dark'?'on':''}">🌙 深色</button>
            </div>
          </div>

          <div class="akai-tw-row">
            <div>
              <div class="akai-tw-label">背景裝飾 DECO</div>
              <div class="akai-tw-help">彩色雲朵 + 點點 + 線條</div>
            </div>
            <label class="akai-tw-switch">
              <input type="checkbox" id="tw-deco" ${t.deco==='on'?'checked':''}>
              <span class="knob"></span>
            </label>
          </div>

          <div class="akai-tw-row">
            <div>
              <div class="akai-tw-label">扁平模式 FLAT</div>
              <div class="akai-tw-help">移除黑色實心投影</div>
            </div>
            <label class="akai-tw-switch">
              <input type="checkbox" id="tw-flat" ${t.flat==='on'?'checked':''}>
              <span class="knob"></span>
            </label>
          </div>

          <div class="akai-tw-section">
            <div class="akai-tw-label">字級 SCALE <span style="float:right;font-family:'Fraunces',serif;font-style:italic;" id="tw-scale-val">${t.scale}%</span></div>
            <input type="range" min="90" max="120" step="5" value="${t.scale}" id="tw-scale" class="akai-tw-range">
          </div>

          <div class="akai-tw-foot">
            <button class="akai-tw-reset" id="tw-reset">回到預設</button>
            <span style="flex:1;"></span>
            <span class="akai-tw-hint">變動即時生效</span>
          </div>
        </div>
      </div>
    `);

    document.body.appendChild(root);
    panelEl = root;

    // accent swatches
    const sw = root.querySelector('#tw-accents');
    ACCENTS.forEach(a => {
      const b = document.createElement('button');
      b.className = 'akai-tw-swatch' + (tweaks.accent === a.id ? ' on' : '');
      b.dataset.v = a.id;
      b.title = a.label;
      b.style.background = a.color;
      b.innerHTML = '<span class="lbl">' + a.label + '</span>';
      b.onclick = () => {
        tweaks.accent = a.id;
        save(tweaks); apply(tweaks);
        sw.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.v === a.id));
      };
      sw.appendChild(b);
    });

    // theme seg
    root.querySelectorAll('#tw-theme button').forEach(b => {
      b.onclick = () => {
        tweaks.theme = b.dataset.v;
        save(tweaks); apply(tweaks);
        root.querySelectorAll('#tw-theme button').forEach(x => x.classList.toggle('on', x.dataset.v === b.dataset.v));
      };
    });

    // toggles
    root.querySelector('#tw-deco').onchange = (e) => {
      tweaks.deco = e.target.checked ? 'on' : 'off';
      save(tweaks); apply(tweaks);
    };
    root.querySelector('#tw-flat').onchange = (e) => {
      tweaks.flat = e.target.checked ? 'on' : 'off';
      save(tweaks); apply(tweaks);
    };

    // scale
    const scale = root.querySelector('#tw-scale');
    const scaleVal = root.querySelector('#tw-scale-val');
    scale.oninput = (e) => {
      tweaks.scale = parseInt(e.target.value);
      scaleVal.textContent = tweaks.scale + '%';
      apply(tweaks);
    };
    scale.onchange = () => save(tweaks);

    // reset
    root.querySelector('#tw-reset').onclick = () => {
      tweaks = { ...DEFAULT };
      save(tweaks); apply(tweaks);
      hide();
      setTimeout(show, 80); // 重建面板顯示新值
    };

    // close
    root.querySelector('.akai-tweaks-close').onclick = () => {
      hide();
      try { window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*'); } catch {}
    };
  }

  function show() {
    if (!panelEl) buildPanel();
    panelEl.classList.add('open');
    panelOpen = true;
  }
  function hide() {
    if (panelEl) panelEl.classList.remove('open');
    panelOpen = false;
  }

  // ===== 與宿主環境的 tweaks toolbar 對接 =====
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || typeof d !== 'object') return;
    if (d.type === '__activate_edit_mode')   show();
    if (d.type === '__deactivate_edit_mode') hide();
  });
  try { window.parent.postMessage({ type: '__edit_mode_available' }, '*'); } catch {}

  // ===== 提供小型「設定」浮鈕（非宿主環境也能開）=====
  // 只在首頁、roster 等頁面顯示；其他靠 tweaks toolbar
  const fab = document.createElement('button');
  fab.className = 'akai-tweaks-fab';
  fab.title = '視覺微調 Tweaks';
  fab.innerHTML = '🎨';
  fab.onclick = () => panelOpen ? hide() : show();
  // 等 body 出現再加入
  if (document.body) document.body.appendChild(fab);
  else document.addEventListener('DOMContentLoaded', () => document.body.appendChild(fab));

  // ===== 多分頁同步 =====
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      tweaks = load();
      apply(tweaks);
    }
  });

  // 對外暴露（萬一頁面想程式化讀寫）
  window.AkaiTweaks = { get: () => ({ ...tweaks }), set: (patch) => { tweaks = { ...tweaks, ...patch }; save(tweaks); apply(tweaks); } };
})();
