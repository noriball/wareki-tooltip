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
//  出力書式（テンプレート）
// ============================================================

/**
 * 出力書式の既定値。西暦で出力するとき(seireki)と和暦で出力するとき(wareki)で別々に持つ。
 *  template    : 書式テンプレート（下記トークン）
 *  copyWeekday : コピーする文字列にも曜日を含めるか
 *  gannen      : 和暦の1年を「元年」と書くか（false なら「1年」）
 *
 * テンプレートのトークン（それ以外の文字はそのまま出力。'...' で囲むと文字そのもの）
 *  YYYY 西暦4桁 / G 元号(令和) / g 略記(R) / y 和暦の年(元年は「元」) / yy 和暦の年2桁
 *  M 月 / MM 月2桁 / D 日 / DD 日2桁 / W 曜日(金) / WW 曜日(金曜日)
 */
export const DEFAULT_SETTINGS = Object.freeze({
  seireki: Object.freeze({ template: 'YYYY年M月D日（W）', copyWeekday: true }),
  wareki: Object.freeze({ template: 'Gy年M月D日（W）', copyWeekday: true }),
  gannen: true,
});

const MAX_TEMPLATE_LENGTH = 40;
const TOKEN_RE = /'([^']*)'|YYYY|yy|y|G|g|MM|M|DD|D|WW|W/g;
const YEAR_TOKENS = new Set(['YYYY', 'yy', 'y', 'G', 'g']);

/** テンプレートを {lit} / {tok} の並びに分解する */
function parseTemplate(tpl) {
  const items = [];
  let last = 0;
  for (const m of tpl.matchAll(TOKEN_RE)) {
    if (m.index > last) items.push({ lit: tpl.slice(last, m.index) });
    if (m[0][0] === "'") items.push({ lit: m[1] === '' ? "'" : m[1] });
    else items.push({ tok: m[0] });
    last = m.index + m[0].length;
  }
  if (last < tpl.length) items.push({ lit: tpl.slice(last) });
  return items;
}

/** 使えるテンプレートか（文字列・長さ・制御文字なし・年のトークンを1つ以上含む） */
function isValidTemplate(tpl) {
  return typeof tpl === 'string'
    && tpl.length >= 1 && tpl.length <= MAX_TEMPLATE_LENGTH
    && !/[\u0000-\u001f\u007f]/.test(tpl)
    && parseTemplate(tpl).some((it) => it.tok && YEAR_TOKENS.has(it.tok));
}

/** 保存値などの信頼できない入力を、既定値で補いつつ許可された値だけに絞る */
export function sanitizeSettings(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const d = DEFAULT_SETTINGS;
  const dir = (k) => {
    const v = r[k] && typeof r[k] === 'object' ? r[k] : {};
    return {
      template: isValidTemplate(v.template) ? v.template : d[k].template,
      copyWeekday: typeof v.copyWeekday === 'boolean' ? v.copyWeekday : d[k].copyWeekday,
    };
  };
  return {
    seireki: dir('seireki'),
    wareki: dir('wareki'),
    gannen: typeof r.gannen === 'boolean' ? r.gannen : d.gannen,
  };
}

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * 曜日の部分を日付の部分から切り離す。
 * 最初の W より後ろ（と、W 直前の「年月日以外の文字」＝（ や空白）を曜日グループとし、
 * 曜日が出せないときはグループごと消す。直前の「日」などはそのまま日付側に残す。
 */
function splitWeekday(items) {
  const idx = items.findIndex((it) => it.tok === 'W' || it.tok === 'WW');
  if (idx < 0) return { date: items, group: [] };
  const date = items.slice(0, idx);
  const group = items.slice(idx);
  const prev = date.at(-1);
  if (prev && prev.lit !== undefined) {
    const [, units, rest] = prev.lit.match(/^([年月日]*)([\s\S]*)$/);
    date.pop();
    if (units) date.push({ lit: units });
    if (rest) group.unshift({ lit: rest });
  }
  return { date, group };
}

function tokenText(tok, ctx, st) {
  switch (tok) {
    case 'YYYY': return String(ctx.year).padStart(4, '0');
    case 'G': return ctx.era ? ctx.era.name : '';
    case 'g': return ctx.era ? (ctx.era.alpha ?? ctx.era.name) : '';
    case 'y':
      if (!ctx.era) return '';
      return ctx.eraYear === 1 && st.gannen && !ctx.alphaTemplate ? '元' : String(ctx.eraYear);
    case 'yy': return ctx.era ? pad2(ctx.eraYear) : '';
    case 'M': return ctx.month ? String(ctx.month) : '';
    case 'MM': return ctx.month ? pad2(ctx.month) : '';
    case 'D': return ctx.day ? String(ctx.day) : '';
    case 'DD': return ctx.day ? pad2(ctx.day) : '';
    case 'W': return ctx.weekday ?? '';
    case 'WW': return ctx.weekday ? `${ctx.weekday}曜日` : '';
    default: return '';
  }
}

const isYearTok = (it) => it.tok && YEAR_TOKENS.has(it.tok);
const isMonthTok = (it) => it.tok === 'M' || it.tok === 'MM';
const isDayTok = (it) => it.tok === 'D' || it.tok === 'DD';

/**
 * 日付の部分を描画する。月・日が無いときは、無い部分と、その区切りを省く
 * （2024/3/15 → 年のみは「2024年」、年月は「2024/3」）。
 * 年 → 月 → 日 の順に書くテンプレートを想定する。
 */
function renderDate(items, ctx, st) {
  const present = (it) => isYearTok(it) || (isMonthTok(it) && ctx.month) || (isDayTok(it) && ctx.day);
  const isComponent = (it) => isYearTok(it) || isMonthTok(it) || isDayTok(it);
  let last = -1;
  let lastComponent = -1;
  items.forEach((it, i) => {
    if (present(it)) last = i;
    if (isComponent(it)) lastComponent = i;
  });
  if (last < 0) return '';

  const upto = last === lastComponent ? items.length : last + 1; // 最後の要素まで出せるなら末尾の文字も出す
  let out = '';
  for (let i = 0; i < upto; i++) out += items[i].lit ?? tokenText(items[i].tok, ctx, st);

  if (last !== lastComponent) {
    // 省略した部分の手前に「月」「年」などの単位だけが残っているときは付ける
    const next = items[last + 1];
    if (next && next.lit !== undefined && /^[年月日]+$/.test(next.lit)) out += next.lit;
    else if (isYearTok(items[last]) && !ctx.alphaTemplate) out += '年'; // 年のみ → 「2024年」「令和6年」
  }
  return out;
}

function renderGroup(items, ctx, st) {
  if (!ctx.weekday) return '';
  return items.map((it) => it.lit ?? tokenText(it.tok, ctx, st)).join('');
}

/**
 * 結果を組み立てる。曜日グループは全元号の後ろに1回だけ付ける。
 * @param {object[]} ctxs 日付の文脈（改元年は元号ごとに複数）
 * @param {string} weekday 曜日1文字。出せないときは空
 */
function buildResult(t, cfg, st, ctxs, weekday) {
  const { date, group } = splitWeekday(parseTemplate(cfg.template));
  const hasAlphaToken = date.some((it) => it.tok === 'g');
  // 略記(R6)になる元号だけ「年」を付けず「元」にもしない。略記を持たない江戸期の元号は元号名のまま
  const body = ctxs
    .map((c) => renderDate(date, { ...c, alphaTemplate: hasAlphaToken && !!c.era?.alpha }, st))
    .join('／');
  const wd = renderGroup(group, { weekday }, st);
  return { label: `${t}  →  ${body}${wd}`, value: cfg.copyWeekday ? `${body}${wd}` : body };
}

/** 曜日1文字。年月日がそろっていて、旧暦時代(〜1872)でなければ。無ければ '' */
function weekdayChar(y, m, d) {
  return m && d ? (weekdayOf(y, m, d) ?? '') : '';
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
    return oldCalendarResult(t, era, yearNum, era.firstYear + yearNum - 1, month, day, st);
  }

  const last = eraLastYear(era);
  if (yearNum < 1 || (last && yearNum > last)) {
    return { error: last ? `${era.name}は元年〜${last}年です` : `${era.name}${yearNum}年は指定できません` };
  }
  const year = era.start[0] + yearNum - 1;

  // 明治1〜5年も旧暦
  if (year < GREGORIAN_ADOPTED_YEAR) return oldCalendarResult(t, era, yearNum, year, month, day, st);

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

  return buildResult(t, st.seireki, st, [{ year, month, day, era, eraYear: yearNum }], weekdayChar(year, month, day));
}

/** 旧暦時代の和暦 → 西暦。年のみ換算（月日は旧暦のため換算しない） */
function oldCalendarResult(t, era, yearNum, year, month, day, st) {
  if (month && (month < 1 || month > 12)) return { error: `${month}月は存在しません` };
  if (day && (day < 1 || day > 30)) return { error: `${day}日は存在しません` };
  // 年のみ換算（月日・曜日は付けない）。書式のテンプレートは年の部分だけが効く
  const body = buildResult(t, st.seireki, st, [{ year, era, eraYear: yearNum }], '').value;
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

  const ctxs = eras.map((e) => ({ year, month, day, era: e, eraYear: year - e.start[0] + 1 }));
  return buildResult(t, st.wareki, st, ctxs, weekdayChar(year, month, day));
}

/** 西暦年(〜1872)に当たる旧暦時代の元号を新しい順に */
function oldEraResult(t, year, month, day, st) {
  const ctxs = [];
  if (year >= MEIJI_FIRST_YEAR) {
    ctxs.push({ year, era: eraByName('明治'), eraYear: year - MEIJI_FIRST_YEAR + 1 });
  }
  for (const e of [...EDO_ERAS].reverse()) {
    if (year >= e.firstYear && year <= e.firstYear + e.lastYear - 1) {
      ctxs.push({ year, era: e, eraYear: year - e.firstYear + 1 });
    }
  }
  if (ctxs.length === 0) return null; // 慶長より前は対象外
  // 年のみ換算（月日・曜日は付けない）。書式のテンプレートは年の部分だけが効く
  const value = buildResult(t, st.wareki, st, ctxs, '').value;
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
