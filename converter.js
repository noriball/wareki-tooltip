// ============================================================
//  和暦⇔西暦 変換ロジック（副作用なし。background.js とテストから共用）
// ============================================================

/**
 * 元号テーブル。start/end は西暦(グレゴリオ暦)の [年, 月, 日]。
 * 元号の年数は「西暦年 − 開始年 + 1」（改元年は元年）。
 */
export const ERAS = [
  { name: '令和', kanji: '令', alpha: 'R', start: [2019, 5, 1],   end: null },
  { name: '平成', kanji: '平', alpha: 'H', start: [1989, 1, 8],   end: [2019, 4, 30] },
  { name: '昭和', kanji: '昭', alpha: 'S', start: [1926, 12, 25], end: [1989, 1, 7] },
  { name: '大正', kanji: '大', alpha: 'T', start: [1912, 7, 30],  end: [1926, 12, 24] },
  { name: '明治', kanji: '明', alpha: 'M', start: [1868, 1, 25],  end: [1912, 7, 29] },
];

/** 明治6年(1873)の改暦より前は旧暦。月日は西暦と一致しない */
const GREGORIAN_ADOPTED_YEAR = 1873;

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

// [y, m, d] を比較可能な数値に
const key = ([y, m, d]) => y * 10000 + m * 100 + d;

const eraByName = (name) => ERAS.find((e) => e.name === name);
const eraByKanji = (c) => ERAS.find((e) => e.kanji === c);
const eraByAlpha = (c) => ERAS.find((e) => e.alpha === c.toUpperCase());

/** その月の日数 */
function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** 実在する日付か */
function isValidDate(y, m, d) {
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

/** 曜日（日〜土）。旧暦時代(〜1872)は null */
function weekdayOf(y, m, d) {
  if (y < GREGORIAN_ADOPTED_YEAR) return null;
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** 元号年の表記。1 は「元」 */
const eraYearText = (n) => (n === 1 ? '元' : String(n));

/** 元号の最終年(数値)。令和は null */
function eraLastYear(era) {
  return era.end ? era.end[0] - era.start[0] + 1 : null;
}

/** 範囲 [from, to]（[y,m,d]）と重なる元号を新しい順に返す */
function erasOverlapping(from, to) {
  return ERAS.filter(
    (e) => key(e.start) <= key(to) && (!e.end || key(e.end) >= key(from)),
  );
}

/** 月・日のサフィックス */
function buildSuffix(month, day) {
  let s = '';
  if (month) s += `${month}月`;
  if (day) s += `${day}日`;
  return s;
}

/** 日付まであれば「（金）」 */
function weekdaySuffix(y, m, d) {
  if (!m || !d) return '';
  const w = weekdayOf(y, m, d);
  return w ? `（${w}）` : '';
}

/**
 * 和暦 → 西暦。
 * @returns {{label:string,value:string}|{error:string}}
 */
function warekiToSeireki(t, era, yearNum, month, day) {
  const last = eraLastYear(era);
  if (yearNum < 1 || (last && yearNum > last)) {
    return { error: last ? `${era.name}は元年〜${last}年です` : `${era.name}${yearNum}年は指定できません` };
  }
  const year = era.start[0] + yearNum - 1;

  if (month) {
    if (month < 1 || month > 12) return { error: `${month}月は存在しません` };
    if (day && !isValidDate(year, month, day)) {
      return { error: `${year}年${month}月${day}日は存在しません` };
    }
    // 元号の範囲内か（月のみなら月と範囲の重なりで判定）
    const from = [year, month, day || 1];
    const to = [year, month, day || daysInMonth(year, month)];
    if (key(to) < key(era.start) || (era.end && key(from) > key(era.end))) {
      const e = era.end;
      return {
        error: key(to) < key(era.start)
          ? `${era.name}は${era.start[0]}年${era.start[1]}月${era.start[2]}日から始まります`
          : `${era.name}は${e[0]}年${e[1]}月${e[2]}日までです`,
      };
    }
  }

  const suffix = buildSuffix(month, day);
  let wd = '';
  let note = '';
  if (month && year < GREGORIAN_ADOPTED_YEAR) {
    note = '（旧暦のため月日は換算せず）';
  } else {
    wd = weekdaySuffix(year, month, day);
  }
  const value = month && year < GREGORIAN_ADOPTED_YEAR
    ? `${year}年`
    : `${year}年${suffix}${wd}`;
  return { label: `${t}  →  ${value}${note}`, value };
}

/**
 * 西暦 → 和暦。改元をまたぐ年・月は両方の元号を併記する。
 * @returns {{label:string,value:string}|null}
 */
function seirekiToWareki(t, year, month, day) {
  if (month && (month < 1 || month > 12)) return { error: `${month}月は存在しません` };
  if (day && !isValidDate(year, month, day)) {
    return { error: `${year}年${month}月${day}日は存在しません` };
  }
  const from = [year, month || 1, day || 1];
  const to = [year, month || 12, day || daysInMonth(year, month || 12)];
  // 明治元年(1868-01-25)より前は対象外。年のみで 1868 は明治元年として扱う
  const eras = erasOverlapping(from, to);
  if (eras.length === 0) return null;

  const suffix = buildSuffix(month, day);
  const wd = weekdaySuffix(year, month, day);
  const parts = eras.map((e) => `${e.name}${eraYearText(year - e.start[0] + 1)}年`);
  const value = `${parts.join('／')}${suffix}${wd}`;
  return { label: `${t}  →  ${value}`, value };
}

/**
 * 全角英数・全角記号を半角に、㋿㍻㍼㍽㍾ を元号名に、各種ダッシュをハイフンに揃える。
 * （NFKC で 2024→2024、Ｒ６→R6、／→/、．→.、㋿→令和 などになる）
 */
function normalize(s) {
  return s.normalize('NFKC').replace(/[\u2010-\u2015\u2212\uFF0D\u30FC]/g, '-');
}

const num = (s) => (s === undefined ? undefined : parseInt(s, 10));

/**
 * テキストを解析して変換結果を返す。
 * 変換対象でなければ null、書式は合っているが不正な値なら {error}。
 * @returns {{label:string,value:string}|{error:string}|null}
 */
export function convert(text) {
  const orig = text.trim();       // 表示用（選択したままの表記）
  const t = normalize(orig);      // 解析用（全角→半角など）
  let m;

  // 漢字: 令和6年 / 令和6年3月 / 令和6年3月15日 / 令和元年 / 令和6
  m = t.match(/^(令和|平成|昭和|大正|明治)(元|\d{1,2})(?:年(?:(\d{1,2})月(?:(\d{1,2})日)?)?)?$/);
  if (m) {
    const y = m[2] === '元' ? 1 : num(m[2]);
    return warekiToSeireki(orig, eraByName(m[1]), y, num(m[3]), num(m[4]));
  }

  // 漢字1文字略記: 明20 / 昭10 / 平3 / 令6
  m = t.match(/^(明|昭|大|平|令)(\d{1,2})$/);
  if (m) return warekiToSeireki(orig, eraByKanji(m[1]), num(m[2]));

  // アルファベット略記: R6 / H31 / S64 / T15 / M45
  m = t.match(/^([RrHhSsTtMm])(\d{1,2})$/);
  if (m) return warekiToSeireki(orig, eraByAlpha(m[1]), num(m[2]));

  // 西暦(漢字): 2024年 / 2024年3月 / 2024年3月15日
  m = t.match(/^(\d{4})年(?:(\d{1,2})月(?:(\d{1,2})日)?)?$/);
  if (m) return seirekiToWareki(orig, num(m[1]), num(m[2]), num(m[3]));

  // 西暦(区切り): 2024/3 / 2024-3-15 / 2024.3.15
  m = t.match(/^(\d{4})[\/\-.](\d{1,2})(?:[\/\-.](\d{1,2}))?$/);
  if (m) return seirekiToWareki(orig, num(m[1]), num(m[2]), num(m[3]));

  return null;
}
