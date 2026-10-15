// クリップボード書き込み専用のオフスクリーンドキュメント
chrome.runtime.onMessage.addListener((req, _sender, sendResponse) => {
  if (req?.action !== 'COPY') return;
  try {
    const ta = document.createElement('textarea');
    ta.value = req.text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    sendResponse({ ok });
  } catch (e) {
    sendResponse({ ok: false, error: String(e) });
  }
});
