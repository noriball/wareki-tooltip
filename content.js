(() => {
  let timer;

  document.addEventListener('selectionchange', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const text = window.getSelection()?.toString().trim() ?? '';
      // 年月日・区切り文字込みで最大25文字まで送信
      if (text.length >= 1 && text.length <= 25) {
        chrome.runtime.sendMessage({ action: 'UPDATE', text }).catch(() => {});
      }
    }, 200);
  });
})();
