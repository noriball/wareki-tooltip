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

/**
 * 江戸時代の元号（旧暦）。元年に当たる西暦年のみ持つ（一般的な年表の表記）。
 * 旧暦は西暦と月日が一致しないため、年のみ換算する。
 * 最終年は「次の元号の元年 − 元年 + 1」（改元年は両方の元号に属する）。
 */
const EDO_RAW = [
  ['慶長', 1596], ['元和', 1615], ['寛永', 1624], ['正保', 1644], ['慶安', 1648],
  ['承応', 1652], ['明暦', 1655], ['万治', 1658], ['寛文', 1661], ['延宝', 1673],
  ['天和', 1681], ['貞享', 1684], ['元禄', 1688], ['宝永', 1704], ['正徳', 1711],
  ['享保', 1716], ['元文', 1736], ['寛保', 1741], ['延享', 1744], ['寛延', 1748],
  ['宝暦', 1751], ['明和', 1764], ['安永', 1772], ['天明', 1781], ['寛政', 1789],
  ['享和', 1801], ['文化', 1804], ['文政', 1818], ['天保', 1830], ['弘化', 1844],
  ['嘉永', 1848], ['安政', 1854], ['万延', 1860], ['文久', 1861], ['元治', 1864],
  ['慶応', 1865],
];
const MEIJI_FIRST_YEAR = 1868;
export const EDO_ERAS = EDO_RAW.map(([name, firstYear], i) => {
  const next = i + 1 < EDO_RAW.length ? EDO_RAW[i + 1][1] : MEIJI_FIRST_YEAR;
  return { name, firstYear, lastYear: next - firstYear + 1, old: true };
});

/** 明治6年(1873)の改暦より前は旧暦。月日は西暦と一致しない */
const GREGORIAN_ADOPTED_YEAR = 1873;

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

// [y, m, d] を比較可能な数値に
const key = ([y, m, d]) => y * 10000 + m * 100 + d;

const eraByName = (name) => ERAS.find((e) => e.name === name) ?? EDO_ERAS.find((e) => e.name === name);
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

// ============================================================
//  出力書式の設定
// ============================================================

/**
 * 出力書式の既定値。
 *  sep         : 'kanji'(年月日) | 'slash' | 'dot' | 'hyphen' | 'none'(区切りなし 20240315)
 *  pad         : 月日を2桁に（3 → 03）。sep='none' のときは常に2桁
 *  weekday     : 'none' | 'paren-full'（金） | 'paren-half'(金) | 'full' 金曜日
 *  copyWeekday : コピーする値にも曜日を含めるか
 *  warekiStyle : 'long'(令和6年) | 'alpha'(R6)。江戸期の元号は常に long
 *  gannen      : 1年を「元年」と書くか（false なら「1年」）
 */
export const DEFAULT_SETTINGS = Object.freeze({
  sep: 'kanji',
  pad: false,
  weekday: 'paren-full',
  copyWeekday: true,
  warekiStyle: 'long',
  gannen: true,
});

const ALLOWED = {
  sep: ['kanji', 'slash', 'dot', 'hyphen', 'none'],
  weekday: ['none', 'paren-full', 'paren-half', 'full'],
  warekiStyle: ['long', 'alpha'],
};

/** 保存値などの信頼できない入力を、既定値で補いつつ許可された値だけに絞る */
export function sanitizeSettings(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const d = DEFAULT_SETTINGS;
  const pick = (k) => (ALLOWED[k].includes(r[k]) ? r[k] : d[k]);
  const bool = (k) => (typeof r[k] === 'boolean' ? r[k] : d[k]);
  return {
    sep: pick('sep'),
    pad: bool('pad'),
    weekday: pick('weekday'),
    copyWeekday: bool('copyWeekday'),
    warekiStyle: pick('warekiStyle'),
    gannen: bool('gannen'),
  };
}

const pad2 = (n) => String(n).padStart(2, '0');

/** 元号年のラベル（年の数字まで。「年」は付けない）。略記 R6 は alpha を持つ元号のみ */
function eraYearLabel(era, n, st) {
  if (st.warekiStyle === 'alpha' && era.alpha) return { text: `${era.alpha}${n}`, alpha: true };
  if (st.sep === 'none') return { text: `${era.name}${pad2(n)}`, alpha: false };
  return { text: `${era.name}${n === 1 && st.gannen ? '元' : n}`, alpha: false };
}

/**
 * 年・月・日を書式に従って文字列にする。
 * @param {{text:string, alpha:boolean}} year 年のラベル（西暦なら 2024）
 */
function composeDate(year, month, day, st) {
  const yearOnly = year.alpha ? year.text : `${year.text}年`;
  if (!month) return yearOnly;

  let sep = st.sep;
  // 略記(R6)に「年月日」は不自然なので「.」で区切る
  if (year.alpha && sep === 'kanji') sep = 'dot';
  const padded = st.pad || sep === 'none';
  const m = padded ? pad2(month) : String(month);
  const d = day ? (padded ? pad2(day) : String(day)) : null;

  if (sep === 'kanji') return `${year.text}年${m}月${d ? `${d}日` : ''}`;
  if (sep === 'none') return `${year.text}${m}${d ?? ''}`;
  const c = sep === 'slash' ? '/' : sep === 'dot' ? '.' : '-';
  return `${year.text}${c}${m}${d ? `${c}${d}` : ''}`;
}

/** 曜日の文字列。日付まで無い・旧暦時代・設定が「なし」なら空 */
function weekdayText(y, m, d, st) {
  if (!m || !d || st.weekday === 'none') return '';
  const w = weekdayOf(y, m, d);
  if (!w) return '';
  if (st.weekday === 'paren-full') return `（${w}）`;
  if (st.weekday === 'paren-half') return `(${w})`;
  return `${w}曜日`;
}

/** 表示用(label)とコピー用(value)を組み立てる。曜日はコピー用だけ外せる */
function result(t, body, weekday, st) {
  const label = `${t}  →  ${body}${weekday}`;
  return { label, value: st.copyWeekday ? `${body}${weekday}` : body };
}

/**
 * 和暦 → 西暦。
 * @returns {{label:string,value:string}|{error:string}}
 */
function warekiToSeireki(t, era, yearNum, month, day, st) {
  // 江戸期（旧暦のみ）: 年だけ換算し、月日は換算しない
  if (era.old) {
    if (yearNum < 1 || yearNum > era.lastYear) {
      return { error: `${era.name}は元年〜${era.lastYear}年です` };
    }
    return oldCalendarResult(t, era.firstYear + yearNum - 1, month, day, st);
  }

  const last = eraLastYear(era);
  if (yearNum < 1 || (last && yearNum > last)) {
    return { error: last ? `${era.name}は元年〜${last}年です` : `${era.name}${yearNum}年は指定できません` };
  }
  const year = era.start[0] + yearNum - 1;

  // 明治1〜5年も旧暦
  if (year < GREGORIAN_ADOPTED_YEAR) return oldCalendarResult(t, year, month, day, st);

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

  const body = composeDate({ text: String(year), alpha: false }, month, day, st);
  return result(t, body, weekdayText(year, month, day, st), st);
}

/** 旧暦時代の和暦 → 西暦。年のみ換算（月日は旧暦のため換算しない） */
function oldCalendarResult(t, year, month, day, st) {
  if (month && (month < 1 || month > 12)) return { error: `${month}月は存在しません` };
  if (day && (day < 1 || day > 30)) return { error: `${day}日は存在しません` };
  const body = `${year}年`;
  const note = month
    ? '（旧暦のため年のみ換算・月日は換算せず）'
    : '（旧暦の年。西暦では翌年1〜2月にかかる場合あり）';
  return { label: `${t}  →  ${body}${note}`, value: body };
}

/**
 * 西暦 → 和暦。改元をまたぐ年・月は両方の元号を併記する。
 * @returns {{label:string,value:string}|null}
 */
function seirekiToWareki(t, year, month, day, st) {
  if (month && (month < 1 || month > 12)) return { error: `${month}月は存在しません` };
  if (day && !isValidDate(year, month, day)) {
    return { error: `${year}年${month}月${day}日は存在しません` };
  }
  // 旧暦時代（慶長元年〜明治5年）: 年のみ換算。改元年は両方の元号を併記
  if (year < GREGORIAN_ADOPTED_YEAR) return oldEraResult(t, year, month, day, st);

  const from = [year, month || 1, day || 1];
  const to = [year, month || 12, day || daysInMonth(year, month || 12)];
  const eras = erasOverlapping(from, to);
  if (eras.length === 0) return null;

  const parts = eras.map((e) =>
    composeDate(eraYearLabel(e, year - e.start[0] + 1, st), month, day, st));
  return result(t, parts.join('／'), weekdayText(year, month, day, st), st);
}

/** 西暦年(〜1872)に当たる旧暦時代の元号を新しい順に */
function oldEraResult(t, year, month, day, st) {
  const parts = [];
  const yearOnly = (e, n) => composeDate(eraYearLabel(e, n, st), null, null, st);
  if (year >= MEIJI_FIRST_YEAR) parts.push(yearOnly(eraByName('明治'), year - MEIJI_FIRST_YEAR + 1));
  for (const e of [...EDO_ERAS].reverse()) {
    if (year >= e.firstYear && year <= e.firstYear + e.lastYear - 1) {
      parts.push(yearOnly(e, year - e.firstYear + 1));
    }
  }
  if (parts.length === 0) return null; // 慶長より前は対象外
  const value = parts.join('／');
  const note = month
    ? '（旧暦のため年のみ換算・月日は換算せず）'
    : '（旧暦の年。月によっては前後の元号になる場合あり）';
  return { label: `${t}  →  ${value}${note}`, value };
}

/**
 * 全角英数・全角記号を半角に、㋿㍻㍼㍽㍾ を元号名に、各種ダッシュをハイフンに揃える。
 * （NFKC で 2024→2024、Ｒ６→R6、／→/、．→.、㋿→令和 などになる）
 */
function normalize(s) {
  return s
    .normalize('NFKC')
    .replace(/[\u2010-\u2015\u2212\uFF0D\u30FC]/g, '-')
    .replace(/[〇零一二三四五六七八九十廿卅]+/g, kanjiNumeralToArabic);
}

const KANJI_DIGIT = { 〇: 0, 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

/**
 * 漢数字の連なりを算用数字に。位取り(二〇二四→2024)と十進(二十五→25)、廿・卅に対応。
 * 解釈できない並びは元のまま返す。
 */
function kanjiNumeralToArabic(run) {
  if (!/[十廿卅]/.test(run)) {
    return [...run].map((c) => KANJI_DIGIT[c]).join(''); // 位取り: 二〇二四 → 2024
  }
  let m;
  if ((m = run.match(/^([二三四五六七八九]?)十([一二三四五六七八九]?)$/))) {
    return String((m[1] ? KANJI_DIGIT[m[1]] : 1) * 10 + (m[2] ? KANJI_DIGIT[m[2]] : 0));
  }
  if ((m = run.match(/^廿([一二三四五六七八九]?)$/))) return String(20 + (m[1] ? KANJI_DIGIT[m[1]] : 0));
  if ((m = run.match(/^卅([一二三四五六七八九]?)$/))) return String(30 + (m[1] ? KANJI_DIGIT[m[1]] : 0));
  return run;
}

const ERA_NAME_RE = new RegExp(
  `^(${[...ERAS, ...EDO_ERAS].map((e) => e.name).join('|')})(元|\\d{1,2})(?:年(?:(\\d{1,2})月(?:(\\d{1,2})日)?)?)?$`,
);

const num = (s) => (s === undefined ? undefined : parseInt(s, 10));

/**
 * テキストを解析して変換結果を返す。
 * 変換対象でなければ null、書式は合っているが不正な値なら {error}。
 * @returns {{label:string,value:string}|{error:string}|null}
 */
export function convert(text, settings) {
  const st = sanitizeSettings(settings);
  // 想定外に長い入力は処理しない（選択は content.js 側でも25文字に制限している）
  if (typeof text !== 'string' || text.length > 100) return null;
  const orig = text.trim();       // 表示用（選択したままの表記）
  const t = normalize(orig);      // 解析用（全角→半角など）
  let m;

  // 漢字: 令和6年 / 令和6年3月 / 令和6年3月15日 / 令和元年 / 令和6
  m = t.match(ERA_NAME_RE);
  if (m) {
    const y = m[2] === '元' ? 1 : num(m[2]);
    return warekiToSeireki(orig, eraByName(m[1]), y, num(m[3]), num(m[4]), st);
  }

  // 漢字1文字略記: 明20 / 昭10 / 平3 / 令6
  m = t.match(/^(明|昭|大|平|令)(\d{1,2})$/);
  if (m) return warekiToSeireki(orig, eraByKanji(m[1]), num(m[2]), undefined, undefined, st);

  // アルファベット略記: R6 / H31 / S64 / T15 / M45
  m = t.match(/^([RrHhSsTtMm])(\d{1,2})$/);
  if (m) return warekiToSeireki(orig, eraByAlpha(m[1]), num(m[2]), undefined, undefined, st);

  // 西暦(漢字): 2024年 / 2024年3月 / 2024年3月15日
  m = t.match(/^(\d{4})年(?:(\d{1,2})月(?:(\d{1,2})日)?)?$/);
  if (m) return seirekiToWareki(orig, num(m[1]), num(m[2]), num(m[3]), st);

  // 西暦(区切り): 2024/3 / 2024-3-15 / 2024.3.15
  m = t.match(/^(\d{4})[\/\-.](\d{1,2})(?:[\/\-.](\d{1,2}))?$/);
  if (m) return seirekiToWareki(orig, num(m[1]), num(m[2]), num(m[3]), st);

  return null;
}
