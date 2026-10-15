(() => {
  // 右クリックの直前に選択テキストを background に伝え、メニュー表記を更新する。
  // input / textarea 内の選択は window.getSelection() では取れないため別途読む。
  function selectedText() {
    const el = document.activeElement;
    if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')) {
      try {
        const { selectionStart: s, selectionEnd: e, value } = el;
        if (s != null && e != null && s !== e) return value.slice(s, e);
      } catch { /* type=number などは selection API 非対応 */ }
    }
    return window.getSelection()?.toString() ?? '';
  }

  document.addEventListener('contextmenu', () => {
    const text = selectedText().trim();
    // 年月日・区切り文字込みで最大25文字まで
    if (text.length >= 1 && text.length <= 25) {
      chrome.runtime.sendMessage({ action: 'UPDATE', text }).catch(() => {});
    }
  }, true);
})();
