import { convert, DEFAULT_SETTINGS, sanitizeSettings } from './converter.js';

const $ = (sel) => document.querySelector(sel);
const SAMPLES = ['令和6年3月5日', '2024/3/5', '1989年1月7日'];

function read() {
  const get = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value;
  const chk = (name) => document.querySelector(`input[name="${name}"]`).checked;
  return sanitizeSettings({
    sep: get('sep'),
    pad: chk('pad'),
    weekday: get('weekday'),
    copyWeekday: chk('copyWeekday'),
    warekiStyle: get('warekiStyle'),
    gannen: chk('gannen'),
  });
}

function write(st) {
  for (const k of ['sep', 'weekday', 'warekiStyle']) {
    const el = document.querySelector(`input[name="${k}"][value="${st[k]}"]`);
    if (el) el.checked = true;
  }
  for (const k of ['pad', 'copyWeekday', 'gannen']) {
    document.querySelector(`input[name="${k}"]`).checked = st[k];
  }
}

function preview(st) {
  SAMPLES.forEach((text, i) => {
    const r = convert(text, st);
    const el = $(`#p${i + 1}`);
    el.textContent = '';
    const a = document.createElement('span');
    a.className = 'in';
    a.textContent = `${text}  →  `;
    const b = document.createElement('span');
    b.textContent = r?.value ?? '';
    el.append(a, b);
  });
}

let statusTimer;
async function save() {
  const st = read();
  preview(st);
  try {
    await chrome.storage.sync.set({ format: st });
    $('#status').textContent = '保存しました';
  } catch {
    $('#status').textContent = '保存に失敗しました';
  }
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { $('#status').textContent = ''; }, 1500);
}

document.addEventListener('change', save);
$('#reset').addEventListener('click', () => { write(DEFAULT_SETTINGS); save(); });

(async () => {
  let st = DEFAULT_SETTINGS;
  try {
    const { format } = await chrome.storage.sync.get('format');
    st = sanitizeSettings(format);
  } catch { /* 既定値で表示 */ }
  write(st);
  preview(st);
})();
