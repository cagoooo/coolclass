/* roster.js — 阿凱老師教室小幫手｜共用班級名單模組
 * 所有需要學生號碼/姓名的工具都讀這個。
 * 改一次班級名單，情緒打卡牆 / 出勤表 / 抽號 / 分組 全部跟著更新。
 */
(function (global) {
  const KEY = 'akai_roster_v1';
  const DEFAULT = {
    className: '',
    count: 30,
    names: {}, // { "1": "陳小明", "2": "林小華" }
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { ...DEFAULT, names: {} };
      const obj = JSON.parse(raw);
      const r = { ...DEFAULT, ...obj };
      r.names = r.names || {};
      r.count = parseInt(r.count) || 30;
      return r;
    } catch (e) { return { ...DEFAULT, names: {} }; }
  }

  function save(r) {
    localStorage.setItem(KEY, JSON.stringify(r));
    try { window.dispatchEvent(new CustomEvent('roster-changed', { detail: r })); } catch (e) {}
  }

  function getName(num) {
    const r = load();
    return r.names[String(num)] || '';
  }

  /** 「3 號」或「3 號 小明」 */
  function display(num, opts) {
    const o = opts || {};
    const name = getName(num);
    if (!name) return `${num} 號`;
    if (o.nameOnly) return name;
    return `${num} 號 ${name}`;
  }

  function getList() {
    const r = load();
    const list = [];
    for (let i = 1; i <= r.count; i++) {
      list.push({ num: i, name: r.names[String(i)] || '' });
    }
    return list;
  }

  function isSet() {
    const r = load();
    return r.className || Object.keys(r.names).length > 0;
  }

  global.AkaiRoster = {
    KEY, DEFAULT,
    load, save, getName, display, getList, isSet,
  };
})(window);
