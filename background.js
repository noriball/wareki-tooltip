import { convert } from './converter.js';

// 状態を持たない設計: Service Worker が停止しても動くよう、
// 変換結果はメニュークリック時に info.selectionText から再計算する。

const MENU_ID = 'wareki_convert';
const TITLE_DEFAULT = '和暦または西暦を選択してください';
const TITLE_INVALID = '変換できません（和暦・西暦を選択してください）';

const titleFor = (result) => {
  if (!result) return TITLE_INVALID;
  return result.error ? `⚠ ${result.error}` : result.label;
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: TITLE_DEFAULT,
    contexts: ['selection'],
  });
});

// content.js が右クリックの直前に選択テキストを送ってくる → メニュー表記だけ更新
chrome.runtime.onMessage.addListener((req) => {
  if (req?.action !== 'UPDATE') return;
  chrome.contextMenus.update(MENU_ID, { title: titleFor(convert(req.text)) });
});

// メニュークリック → 再計算してクリップボードへ
chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU_ID) return;
  const result = convert(info.selectionText ?? '');
  if (!result || result.error) return;

  try {
    await copyToClipboard(result.value);
  } catch (e) {
    console.error('クリップボードへのコピーに失敗:', e);
    chrome.contextMenus.update(MENU_ID, { title: '⚠ コピーに失敗しました' });
  }
});

// ---- クリップボード（offscreen document 経由）----
let creating;
async function ensureOffscreen() {
  const exists = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (exists.length) return;
  creating ??= chrome.offscreen
    .createDocument({
      url: 'offscreen.html',
      reasons: ['CLIPBOARD'],
      justification: '変換結果をクリップボードにコピーするため',
    })
    .finally(() => { creating = null; });
  await creating;
}

async function copyToClipboard(text) {
  await ensureOffscreen();
  const res = await chrome.runtime.sendMessage({ action: 'COPY', text });
  if (!res?.ok) throw new Error(res?.error ?? 'copy failed');
}
