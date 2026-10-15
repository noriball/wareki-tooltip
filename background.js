import { convert } from './converter.js';

// content.js からの変換依頼に答えるだけ（状態なし）。
chrome.runtime.onMessage.addListener((req, _sender, sendResponse) => {
  if (req?.action !== 'CONVERT' || typeof req.text !== 'string') return;
  sendResponse(convert(req.text));
});
