import { convert } from './converter.js';

// content.js からの変換依頼に答える。書式設定は毎回 storage から読む（Service Worker は状態を持たない）。
chrome.runtime.onMessage.addListener((req, _sender, sendResponse) => {
  if (req?.action !== 'CONVERT' || typeof req.text !== 'string') return;
  chrome.storage.sync
    .get('format')
    .then(({ format }) => sendResponse(convert(req.text, format)))
    .catch(() => sendResponse(convert(req.text)));
  return true; // 非同期で応答する
});
