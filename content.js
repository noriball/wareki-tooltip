(() => {
  const MAX_LEN = 25; // 年月日・区切り文字込みで最大25文字
  let host = null;    // ツールチップの親要素 (Shadow DOM)
  let box = null;
  let getRect = null; // 現在の選択範囲の矩形を返す関数
  let token = 0;      // 古い応答を捨てるための連番
  let timer;

  // ---------- 選択テキスト・位置の取得 ----------
  function readSelection() {
    const el = document.activeElement;
    if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')) {
      try {
        const { selectionStart: s, selectionEnd: e, value } = el;
        if (s != null && e != null && s !== e) {
          // input/textarea 内は文字単位の矩形が取れないので要素全体を基準にする
          return { text: value.slice(s, e), rect: () => el.getBoundingClientRect() };
        }
      } catch { /* type=number などは非対応 */ }
    }
    const sel = window.getSelection();
    if (sel && sel.rangeCount && !sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      return { text: sel.toString(), rect: () => range.getBoundingClientRect() };
    }
    return null;
  }

  // ---------- ツールチップ ----------
  function ensureBox() {
    if (host) return;
    host = document.createElement('div');
    host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;top:0;left:0;';
    const root = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `
        .tip {
          position: fixed; width: max-content; max-width: 90vw; padding: 6px 10px;
          font: 13px/1.5 system-ui, "Hiragino Sans", "Yu Gothic", sans-serif;
          color: #fff; background: #222; border-radius: 6px;
          box-shadow: 0 2px 8px rgba(0,0,0,.35);
          cursor: pointer; user-select: none;
        }
        .tip:hover { background: #000; }
        .tip.err { background: #8a5a00; cursor: default; white-space: normal; }
        .tip.done { background: #1a7f37; }
        .hint { margin-left: 8px; font-size: 11px; opacity: .65; }
      `;
    box = document.createElement('div');
    box.className = 'tip';
    box.setAttribute('role', 'button');
    root.append(style, box);
    // 選択を外さないよう mousedown を止める
    box.addEventListener('mousedown', (e) => e.preventDefault());
    box.addEventListener('click', onClick);
    document.documentElement.appendChild(host);
  }

  function place() {
    if (!box || !getRect) return;
    const r = getRect();
    const bw = box.offsetWidth, bh = box.offsetHeight;
    let top = r.top - bh - 8;
    if (top < 4) top = r.bottom + 8; // 上に収まらなければ下
    let left = r.left + r.width / 2 - bw / 2;
    left = Math.max(4, Math.min(left, window.innerWidth - bw - 4));
    box.style.top = `${top}px`;
    box.style.left = `${left}px`;
  }

  function show(result, rect) {
    ensureBox();
    getRect = rect;
    box.className = 'tip';
    box.dataset.value = '';
    box.textContent = '';
    if (result.error) {
      box.classList.add('err');
      box.textContent = `⚠ ${result.error}`;
    } else {
      box.dataset.value = result.value;
      const main = document.createElement('span');
      main.textContent = result.label;
      const hint = document.createElement('span');
      hint.className = 'hint';
      hint.textContent = 'クリックでコピー';
      box.append(main, hint);
    }
    place();
  }

  function hide() {
    token++;
    getRect = null;
    host?.remove();
    host = box = null;
  }

  // ---------- コピー ----------
  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    }
  }

  async function onClick(e) {
    // ページ側スクリプトが合成した click ではクリップボードに書かない
    if (!e.isTrusted) return;
    const value = box?.dataset.value;
    if (!value) return;
    const ok = await copy(value);
    if (!box) return;
    box.classList.toggle('done', ok);
    box.textContent = ok ? `✓ コピーしました: ${value}` : '⚠ コピーに失敗しました';
    place();
    setTimeout(hide, 1200);
  }

  // ---------- 選択の監視 ----------
  async function update() {
    const sel = readSelection();
    const text = sel?.text.trim() ?? '';
    if (!sel || text.length < 1 || text.length > MAX_LEN) return hide();

    const my = ++token;
    let result;
    try {
      result = await chrome.runtime.sendMessage({ action: 'CONVERT', text });
    } catch {
      return; // 拡張が更新・再読込された直後など
    }
    if (my !== token) return;      // 選択が変わった
    if (!result) return hide();    // 和暦・西暦ではない
    show(result, sel.rect);
  }

  const schedule = () => { clearTimeout(timer); timer = setTimeout(update, 150); };

  document.addEventListener('mouseup', (e) => {
    if (host && e.composedPath().includes(host)) return;
    schedule();
  }, true);
  document.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') return hide();
    if (e.shiftKey || e.key.startsWith('Arrow') || (e.ctrlKey || e.metaKey) && e.key === 'a') schedule();
  }, true);
  // 選択が解除されたら消す（ツールチップのクリック中は消さない）
  document.addEventListener('mousedown', (e) => {
    if (host && e.composedPath().includes(host)) return;
    hide();
  }, true);
  window.addEventListener('scroll', () => place(), true);
  window.addEventListener('resize', () => place());
})();
