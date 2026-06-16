// ============================================================
//  和暦⇔西暦 変換ロジック（年月日・区切り文字対応版）
// ============================================================
const ERA_BASE = {
  '令和': 2018, '平成': 1988, '昭和': 1925, '大正': 1911, '明治': 1867,
};

/** 西暦（数値）→ 和暦文字列。変換できなければ null */
function seirekiToWareki(year) {
  if (year >= 2019) { const y = year - 2018; return `令和${y === 1 ? '元' : y}年`; }
  if (year >= 1989) { const y = year - 1988; return `平成${y === 1 ? '元' : y}年`; }
  if (year >= 1926) { const y = year - 1925; return `昭和${y === 1 ? '元' : y}年`; }
  if (year >= 1912) { const y = year - 1911; return `大正${y === 1 ? '元' : y}年`; }
  if (year >= 1868) { const y = year - 1867; return `明治${y === 1 ? '元' : y}年`; }
  return null;
}

/** 月・日を和暦/西暦共通のサフィックスに変換 */
function buildSuffix(month, day) {
  let s = '';
  if (month) s += `${parseInt(month)}月`;
  if (day)   s += `${parseInt(day)}日`;
  return s;
}

/** テキストを解析して変換結果を返す */
function convert(text) {
  const t = text.trim();

  // ────────────────────────────────
  //  和暦 → 西暦
  // ────────────────────────────────

  // 漢字: 令和6年 / 令和6年3月 / 令和6年3月15日 / 令和元年 など
  const kanjiMatch = t.match(
    /^(令和|平成|昭和|大正|明治)(元|\d{1,2})年?(?:(\d{1,2})月(?:(\d{1,2})日)?)?$/
  );
  if (kanjiMatch) {
    const era = kanjiMatch[1];
    const y   = kanjiMatch[2] === '元' ? 1 : parseInt(kanjiMatch[2]);
    const seireki = ERA_BASE[era] + y;
    const suffix  = buildSuffix(kanjiMatch[3], kanjiMatch[4]);
    return {
      label: `${t}  →  ${seireki}年${suffix}（西暦）`,
      value: `${seireki}年${suffix}`,
    };
  }

  // 漢字1文字略記: 明20 / 昭10 / 平3 など
  const kanjiAbbrMatch = t.match(/^(明|昭|大|平|令)(\d{1,2})$/);
  if (kanjiAbbrMatch) {
    const eraMap = { 明: '明治', 昭: '昭和', 大: '大正', 平: '平成', 令: '令和' };
    const era = eraMap[kanjiAbbrMatch[1]];
    const y   = parseInt(kanjiAbbrMatch[2]);
    const seireki = ERA_BASE[era] + y;
    return { label: `${t}  →  ${seireki}年（西暦）`, value: `${seireki}年` };
  }

  // アルファベット略記: R6 / H31 / S64（年のみ）
  const alphaMatch = t.match(/^([RrHhSsTtMm])(\d{1,2})$/);
  if (alphaMatch) {
    const baseMap = { R: 2018, H: 1988, S: 1925, T: 1911, M: 1867 };
    const base = baseMap[alphaMatch[1].toUpperCase()];
    if (base) {
      const seireki = base + parseInt(alphaMatch[2]);
      return { label: `${t}  →  ${seireki}年（西暦）`, value: `${seireki}年` };
    }
  }

  // ────────────────────────────────
  //  西暦 → 和暦
  // ────────────────────────────────

  // 漢字: 2024年 / 2024年3月 / 2024年3月15日
  const seirekiKanji = t.match(
    /^(\d{4})年(?:(\d{1,2})月(?:(\d{1,2})日)?)?$/
  );
  if (seirekiKanji) {
    const year   = parseInt(seirekiKanji[1]);
    const wareki = seirekiToWareki(year);
    if (wareki) {
      const suffix = buildSuffix(seirekiKanji[2], seirekiKanji[3]);
      return {
        label: `${t}  →  ${wareki}${suffix}（和暦）`,
        value: `${wareki}${suffix}`,
      };
    }
  }

  // 区切り文字: 2024/3 / 2024-3 / 2024.3 / 2024/3/15 / 2024-3-15 / 2024.3.15
  const separatorMatch = t.match(
    /^(\d{4})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{1,2}))?$/
  );
  if (separatorMatch) {
    const year   = parseInt(separatorMatch[1]);
    const wareki = seirekiToWareki(year);
    if (wareki) {
      const suffix = buildSuffix(separatorMatch[2], separatorMatch[3]);
      return {
        label: `${t}  →  ${wareki}${suffix}（和暦）`,
        value: `${wareki}${suffix}`,
      };
    }
  }

  return null;
}

// ============================================================
//  コンテキストメニュー管理
// ============================================================
const MENU_ID = 'wareki_convert';
let lastValue = null;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: '和暦または西暦を選択してください',
    contexts: ['selection'],
  });
});

// content.js から選択テキストを受信 → 変換してメニュー更新
chrome.runtime.onMessage.addListener((req) => {
  if (req.action !== 'UPDATE') return;
  const result = convert(req.text);
  if (result) {
    lastValue = result.value;
    chrome.contextMenus.update(MENU_ID, { title: result.label });
  } else {
    lastValue = null;
    chrome.contextMenus.update(MENU_ID, { title: '変換できません（和暦・西暦を選択してください）' });
  }
});

// メニュークリック → クリップボードにコピー
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !lastValue || !tab?.id) return;
  if (!tab.url || /^(chrome|about|edge):/.test(tab.url)) return;

  const text = lastValue;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (t) => {
        if (navigator.clipboard) return navigator.clipboard.writeText(t);
        const el = Object.assign(document.createElement('textarea'), {
          value: t, style: 'position:fixed;opacity:0',
        });
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        el.remove();
      },
      args: [text],
    });
  } catch (e) {
    // コピーできなくてもメニューで結果は確認できるので無視
  }
});
