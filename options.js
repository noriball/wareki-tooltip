import { convert, DEFAULT_SETTINGS, sanitizeSettings } from './converter.js';

const $ = (id) => document.getElementById(id);
const SAMPLES = {
  seireki: ['令和6年3月5日', '平成31年4月', '昭和64年1月7日'],
  wareki: ['2024/3/5', '2019年5月', '1989年1月7日'],
};
const TPL_HELP = '年のトークン（YYYY, y, yy, G, g）を1つ以上含め、40文字以内にしてください';

/** 画面の入力から設定を作る。テンプレートが不正な側は既定値になり、エラーを返す */
function read() {
  const raw = {
    seireki: { template: $('seireki-tpl').value, copyWeekday: $('seireki-copy').checked },
    wareki: { template: $('wareki-tpl').value, copyWeekday: $('wareki-copy').checked },
    gannen: $('gannen').checked,
  };
  const st = sanitizeSettings(raw);
  const invalid = {
    seireki: st.seireki.template !== raw.seireki.template,
    wareki: st.wareki.template !== raw.wareki.template,
  };
  return { st, invalid };
}

function write(st) {
  $('seireki-tpl').value = st.seireki.template;
  $('seireki-copy').checked = st.seireki.copyWeekday;
  $('wareki-tpl').value = st.wareki.template;
  $('wareki-copy').checked = st.wareki.copyWeekday;
  $('gannen').checked = st.gannen;
}

function preview(st, invalid) {
  for (const dir of ['seireki', 'wareki']) {
    $(`${dir}-err`).textContent = invalid[dir] ? TPL_HELP : '';
    $(`${dir}-tpl`).setAttribute('aria-invalid', String(invalid[dir]));
    const box = $(`${dir}-prev`);
    box.textContent = '';
    for (const text of SAMPLES[dir]) {
      const r = convert(text, st);
      const line = document.createElement('div');
      const a = document.createElement('span');
      a.className = 'in';
      a.textContent = `${text}  →  `;
      const b = document.createElement('span');
      b.textContent = r?.value ?? '';
      line.append(a, b);
      box.append(line);
    }
  }
}

let statusTimer;
function flash(msg) {
  $('status').textContent = msg;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { $('status').textContent = ''; }, 1500);
}

async function save() {
  const { st, invalid } = read();
  preview(st, invalid);
  if (invalid.seireki || invalid.wareki) return; // 不正なテンプレートは保存しない
  try {
    await chrome.storage.sync.set({ format: st });
    flash('保存しました');
  } catch {
    flash('保存に失敗しました');
  }
}

document.addEventListener('input', save);
document.addEventListener('change', save);
for (const box of document.querySelectorAll('.presets')) {
  box.addEventListener('click', (e) => {
    const v = e.target.dataset?.v;
    if (!v) return;
    $(box.dataset.target).value = v;
    save();
  });
}
$('reset').addEventListener('click', () => { write(DEFAULT_SETTINGS); save(); });

(async () => {
  let st = DEFAULT_SETTINGS;
  try {
    const { format } = await chrome.storage.sync.get('format');
    st = sanitizeSettings(format);
  } catch { /* 既定値で表示 */ }
  write(st);
  preview(st, { seireki: false, wareki: false });
})();
