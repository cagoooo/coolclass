/* attendance.js — 出勤記錄表行為 */

const STORAGE_KEY = 'akai_attendance_v1';
const WKDAYS = ['日','一','二','三','四','五','六'];

const MARK_MAP = {
  empty:   { sym: '·', cls: 'm-empty' },
  present: { sym: '✓', cls: 'm-present' },
  late:    { sym: '遲', cls: 'm-late' },
  leave:   { sym: '假', cls: 'm-leave' },
  absent:  { sym: '✕', cls: 'm-absent' },
};
const CYCLE = ['empty','present','late','leave','absent'];

let store = loadStore();
let current = null;

function loadStore() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { sheets: {}, settings: {} }; }
  catch { return { sheets: {}, settings: {} }; }
}
function saveStore() { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }

function init() {
  const now = new Date();
  const monthInput = document.getElementById('monthPick');
  const last = store.settings;
  const r = AkaiRoster.load();
  document.getElementById('className').value = r.className || '（未設定）';
  document.getElementById('studentCount').value = r.count || 30;
  monthInput.value = last.month || `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  apply();
}

function sheetKey(year, month) { return `${year}-${String(month).padStart(2,'0')}`; }

function apply() {
  const r = AkaiRoster.load();
  const className = r.className || '';
  const count = r.count || 30;
  document.getElementById('className').value = className || '（未設定）';
  document.getElementById('studentCount').value = count;
  const monthValue = document.getElementById('monthPick').value;
  if (!monthValue) { alert('請選一個月份'); return; }
  const [yStr, mStr] = monthValue.split('-');
  const year = parseInt(yStr);
  const month = parseInt(mStr);

  document.getElementById('heroYear').textContent = year;
  document.getElementById('heroMonth').textContent = month;

  store.settings = { month: monthValue };
  saveStore();

  const key = sheetKey(year, month);
  if (!store.sheets[key]) {
    store.sheets[key] = { className, count, marks: {} };
  } else {
    store.sheets[key].className = className;
    store.sheets[key].count = count;
  }
  current = { year, month, key };
  render();
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function render() {
  if (!current) return;
  const sheet = store.sheets[current.key];
  const days = daysInMonth(current.year, current.month);
  const count = sheet.count;

  document.getElementById('sheetTitle').textContent =
    `${sheet.className || '未命名班級'}　${current.year} 年 ${current.month} 月　出勤記錄`;

  const thead = document.querySelector('#sheetTable thead');
  const tbody = document.querySelector('#sheetTable tbody');
  thead.innerHTML = '';
  tbody.innerHTML = '';

  const tr1 = document.createElement('tr');
  tr1.innerHTML = '<th rowspan="2" style="width:104px;">座號 / 姓名</th>';
  let upDayCount = 0;
  for (let d = 1; d <= days; d++) {
    const dt = new Date(current.year, current.month - 1, d);
    const wk = dt.getDay();
    const th = document.createElement('th');
    th.textContent = d;
    if (wk === 0) th.classList.add('sunday');
    else if (wk === 6) th.classList.add('weekend');
    else upDayCount++;
    tr1.appendChild(th);
  }
  tr1.innerHTML += '<th rowspan="2" style="width:60px;">應到</th>';
  tr1.innerHTML += '<th rowspan="2" style="width:48px;">遲</th>';
  tr1.innerHTML += '<th rowspan="2" style="width:48px;">假</th>';
  tr1.innerHTML += '<th rowspan="2" style="width:48px;">缺</th>';
  thead.appendChild(tr1);

  const tr2 = document.createElement('tr');
  for (let d = 1; d <= days; d++) {
    const dt = new Date(current.year, current.month - 1, d);
    const wk = dt.getDay();
    const th = document.createElement('th');
    th.className = 'wkday';
    th.textContent = WKDAYS[wk];
    if (wk === 0) th.classList.add('sunday');
    else if (wk === 6) th.classList.add('weekend');
    tr2.appendChild(th);
  }
  thead.appendChild(tr2);

  let totalLate = 0, totalLeave = 0, totalAbsent = 0;

  for (let s = 1; s <= count; s++) {
    const tr = document.createElement('tr');
    const sh = document.createElement('th');
    const stuName = AkaiRoster.getName(s);
    if (stuName) {
      sh.innerHTML = `<span class="stu-num">${s} 號</span><span class="stu-name">${escapeHtml(stuName)}</span>`;
    } else {
      sh.innerHTML = `<span class="stu-num">${s} 號</span>`;
    }
    tr.appendChild(sh);

    let late = 0, leave = 0, absent = 0;

    for (let d = 1; d <= days; d++) {
      const dt = new Date(current.year, current.month - 1, d);
      const wk = dt.getDay();
      const td = document.createElement('td');
      const dKey = `${current.year}-${String(current.month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      if (wk === 0 || wk === 6) {
        td.classList.add('weekend-cell');
        td.innerHTML = '<span class="mark">·</span>';
      } else {
        const mark = (sheet.marks[dKey] && sheet.marks[dKey][s]) || 'empty';
        const cfg = MARK_MAP[mark];
        td.classList.add(cfg.cls);
        td.innerHTML = `<span class="mark">${cfg.sym}</span>`;
        td.dataset.s = s;
        td.dataset.d = dKey;
        if (mark === 'late') late++;
        if (mark === 'leave') leave++;
        if (mark === 'absent') absent++;
        td.addEventListener('click', onCellClick);
        td.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          openPicker(e.clientX, e.clientY, s, dKey);
        });
        let pressT;
        td.addEventListener('touchstart', () => {
          pressT = setTimeout(() => {
            const r = td.getBoundingClientRect();
            openPicker(r.left + 8, r.top + 8, s, dKey);
          }, 500);
        });
        td.addEventListener('touchend', () => clearTimeout(pressT));
        td.addEventListener('touchmove', () => clearTimeout(pressT));
      }
      tr.appendChild(td);
    }

    const tdUp = document.createElement('td');
    tdUp.textContent = upDayCount;
    tdUp.style.fontWeight = '700';
    tr.appendChild(tdUp);
    const mkTd = (n, cls) => {
      const t = document.createElement('td');
      t.className = cls;
      if (n > 0) t.innerHTML = `<span class="mark">${n}</span>`;
      else t.textContent = n;
      return t;
    };
    tr.appendChild(mkTd(late, 'm-late'));
    tr.appendChild(mkTd(leave, 'm-leave'));
    tr.appendChild(mkTd(absent, 'm-absent'));

    totalLate += late;
    totalLeave += leave;
    totalAbsent += absent;

    tbody.appendChild(tr);
  }

  document.getElementById('sheetStats').textContent =
    `上學日 ${upDayCount} 天　|　全班遲到 ${totalLate} 次　請假 ${totalLeave} 次　缺席 ${totalAbsent} 次`;
}

function onCellClick(e) {
  const td = e.currentTarget;
  const s = parseInt(td.dataset.s);
  const dKey = td.dataset.d;
  const sheet = store.sheets[current.key];
  if (!sheet.marks[dKey]) sheet.marks[dKey] = {};
  const cur = sheet.marks[dKey][s] || 'empty';
  const next = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length];
  if (next === 'empty') delete sheet.marks[dKey][s];
  else sheet.marks[dKey][s] = next;
  saveStore();
  render();
}

function openPicker(x, y, s, dKey) {
  const pk = document.getElementById('picker');
  pk.dataset.s = s;
  pk.dataset.d = dKey;
  pk.style.left = Math.min(x, window.innerWidth - 280) + 'px';
  pk.style.top = Math.min(y, window.innerHeight - 80) + 'px';
  pk.classList.add('show');
}
document.querySelectorAll('#picker button').forEach(btn => {
  btn.onclick = () => {
    const pk = document.getElementById('picker');
    const s = parseInt(pk.dataset.s);
    const dKey = pk.dataset.d;
    const mark = btn.dataset.mark;
    const sheet = store.sheets[current.key];
    if (!sheet.marks[dKey]) sheet.marks[dKey] = {};
    if (mark === 'empty') delete sheet.marks[dKey][s];
    else sheet.marks[dKey][s] = mark;
    saveStore();
    pk.classList.remove('show');
    render();
  };
});
document.addEventListener('click', (e) => {
  const pk = document.getElementById('picker');
  if (!pk.contains(e.target) && !e.target.closest('td')) pk.classList.remove('show');
});

function resetMonth() {
  if (!current) return;
  if (!confirm(`要清空 ${current.year}/${current.month} 的所有記號嗎？（其他月份不會受影響）`)) return;
  store.sheets[current.key].marks = {};
  saveStore();
  render();
  flash('✓ 已清空');
}

function exportJSON() {
  if (!current) return;
  const sheet = store.sheets[current.key];
  const data = {
    className: sheet.className,
    count: sheet.count,
    year: current.year,
    month: current.month,
    marks: sheet.marks,
    roster: AkaiRoster.load(),
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `出勤_${sheet.className || '班級'}_${current.year}-${String(current.month).padStart(2,'0')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCSV() {
  if (!current) return;
  const sheet = store.sheets[current.key];
  const days = daysInMonth(current.year, current.month);
  let upDayCount = 0;
  const colDates = [];
  for (let d = 1; d <= days; d++) {
    const dt = new Date(current.year, current.month - 1, d);
    const wk = dt.getDay();
    colDates.push({ d, wk, isWeekend: wk === 0 || wk === 6 });
    if (wk !== 0 && wk !== 6) upDayCount++;
  }

  const rows = [];
  const header = ['座號','姓名'];
  colDates.forEach(c => header.push(`${c.d}日(${'日一二三四五六'[c.wk]})`));
  header.push('應到', '出席', '遲到', '請假', '缺席', '出席率');
  rows.push(header);

  const symMap = { present: '出', late: '遲', leave: '假', absent: '缺' };
  let cntLate = 0, cntLeave = 0, cntAbsent = 0;

  for (let s = 1; s <= sheet.count; s++) {
    const row = [s, AkaiRoster.getName(s) || ''];
    let late = 0, leave = 0, absent = 0, present = 0;
    colDates.forEach(c => {
      if (c.isWeekend) { row.push(''); return; }
      const dKey = `${current.year}-${String(current.month).padStart(2,'0')}-${String(c.d).padStart(2,'0')}`;
      const mark = (sheet.marks[dKey] && sheet.marks[dKey][s]) || '';
      row.push(symMap[mark] || '');
      if (mark === 'late') late++;
      else if (mark === 'leave') leave++;
      else if (mark === 'absent') absent++;
      else if (mark === 'present') present++;
    });
    const rate = upDayCount > 0 ? ((present + late) / upDayCount * 100).toFixed(1) + '%' : '—';
    row.push(upDayCount, present, late, leave, absent, rate);
    cntLate += late; cntLeave += leave; cntAbsent += absent;
    rows.push(row);
  }

  rows.push([]);
  rows.push(['班級總計']);
  rows.push(['班級名稱', sheet.className || '']);
  rows.push(['月份', `${current.year}-${String(current.month).padStart(2,'0')}`]);
  rows.push(['上學日數', upDayCount]);
  rows.push(['遲到總次數', cntLate]);
  rows.push(['請假總次數', cntLeave]);
  rows.push(['缺席總次數', cntAbsent]);
  rows.push(['匯出時間', new Date().toLocaleString('zh-TW')]);

  const csv = rows.map(r => r.map(cell => {
    const s = String(cell ?? '');
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }).join(',')).join('\r\n');
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safe = (sheet.className || '班級').replace(/[\/\\:*?"<>|]/g, '_');
  a.href = url;
  a.download = `出勤_${safe}_${current.year}-${String(current.month).padStart(2,'0')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  flash('✓ CSV 已下載（Excel 可直接打開）');
}

function flash(text) {
  const t = document.getElementById('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(window._flashT);
  window._flashT = setTimeout(() => t.classList.remove('show'), 1400);
}

window.addEventListener('storage', (e) => {
  if (e.key === 'akai_roster_v1' && current) apply();
});
window.addEventListener('focus', () => { if (current) apply(); });

init();
