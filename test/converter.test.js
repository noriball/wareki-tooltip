import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convert } from '../converter.js';

const v = (s) => convert(s)?.value;
const err = (s) => convert(s)?.error;

test('和暦→西暦 基本', () => {
  assert.equal(v('令和6年'), '2024年');
  assert.equal(v('令和元年'), '2019年');
  assert.equal(v('昭和64年'), '1989年');
  assert.equal(v('R6'), '2024年');
  assert.equal(v('平3'), '1991年');
});

test('和暦→西暦 日付と曜日', () => {
  assert.equal(v('令和6年3月15日'), '2024年3月15日（金）');
  assert.equal(v('昭和20年8月15日'), '1945年8月15日（水）');
  assert.equal(v('令和6年3月'), '2024年3月'); // 日がなければ曜日なし
});

test('和暦→西暦 存在しない年を拒否', () => {
  assert.ok(err('昭和70年'));
  assert.ok(err('令和0年'));
  assert.ok(err('明治50年'));
  assert.ok(err('平成32年'));
  assert.ok(err('S65'));
});

test('和暦→西暦 存在しない月日・元号範囲外を拒否', () => {
  assert.ok(err('令和6年13月'));
  assert.ok(err('令和6年2月30日'));
  assert.ok(err('平成31年5月1日')); // 5/1 から令和
  assert.ok(err('令和元年4月30日')); // 令和は 5/1 から
  assert.ok(err('昭和64年1月8日')); // 1/8 から平成
});

test('和暦→西暦 改元日', () => {
  assert.equal(v('平成31年4月30日'), '2019年4月30日（火）');
  assert.equal(v('令和元年5月1日'), '2019年5月1日（水）');
  assert.equal(v('昭和64年1月7日'), '1989年1月7日（土）');
  assert.equal(v('平成元年1月8日'), '1989年1月8日（日）');
});

test('「令和63月」は令和6年3月とは解釈しない', () => {
  assert.equal(convert('令和63月'), null);
});

test('西暦→和暦 基本と曜日', () => {
  assert.equal(v('2024年'), '令和6年');
  assert.equal(v('2024/3/15'), '令和6年3月15日（金）');
  assert.equal(v('2024-03-15'), '令和6年3月15日（金）');
  assert.equal(v('2024.3'), '令和6年3月');
  assert.equal(v('1945年8月15日'), '昭和20年8月15日（水）');
});

test('西暦→和暦 改元年は併記、日付があれば確定', () => {
  assert.equal(v('1989年'), '平成元年／昭和64年');
  assert.equal(v('2019年'), '令和元年／平成31年');
  assert.equal(v('1926年'), '昭和元年／大正15年');
  assert.equal(v('1912年'), '大正元年／明治45年');
  assert.equal(v('1989年1月'), '平成元年1月／昭和64年1月');
  assert.equal(v('1989年1月7日'), '昭和64年1月7日（土）');
  assert.equal(v('1989年1月8日'), '平成元年1月8日（日）');
  assert.equal(v('2019年4月30日'), '平成31年4月30日（火）');
  assert.equal(v('2019年5月1日'), '令和元年5月1日（水）');
  assert.equal(v('2019年3月'), '平成31年3月');
});

test('西暦→和暦 不正な日付と範囲外', () => {
  assert.ok(err('2024年2月30日'));
  assert.ok(err('2024年13月'));
  assert.equal(v('1800年'), '寛政12年');
  assert.equal(convert('1595年'), null); // 慶長元年(1596)より前は対象外
});

test('うるう年', () => {
  assert.equal(v('2024年2月29日'), '令和6年2月29日（木）');
  assert.ok(err('2023年2月29日'));
});

test('明治5年以前は旧暦: 月日・曜日は換算しない', () => {
  assert.equal(v('明治5年3月10日'), '1872年');
  assert.equal(v('明治6年1月1日'), '1873年1月1日（水）');
  assert.equal(v('1872年3月10日').includes('（'), false); // 曜日なし
});

test('対象外テキストは null', () => {
  assert.equal(convert('こんにちは'), null);
  assert.equal(convert('12345'), null);
});

test('全角数字・全角記号・全角英字', () => {
  assert.equal(v('令和６年３月１５日'), '2024年3月15日（金）');
  assert.equal(v('２０２４年３月１５日'), '令和6年3月15日（金）');
  assert.equal(v('２０２４／３／１５'), '令和6年3月15日（金）');
  assert.equal(v('２０２４－０３－１５'), '令和6年3月15日（金）');
  assert.equal(v('２０２４．３．１５'), '令和6年3月15日（金）');
  assert.equal(v('Ｒ６'), '2024年');
  assert.equal(v('ｈ３１'), '2019年');
  assert.equal(v('平３'), '1991年');
});

test('㋿㍻㍼㍽㍾ の合字', () => {
  assert.equal(v('㋿6年'), '2024年');
  assert.equal(v('㍻３年'), '1991年');
  assert.equal(v('㍼２０年８月１５日'), '1945年8月15日（水）');
});

test('全角でも不正値は拒否、ラベルは選択したままの表記', () => {
  assert.ok(err('昭和７０年'));
  assert.match(convert('令和６年').label, /^令和６年\s+→\s+2024年$/);
});

test('異常入力: 長大文字列・非文字列・制御文字でも即座に null', () => {
  const t0 = Date.now();
  assert.equal(convert('9'.repeat(100000)), null);
  assert.equal(convert('令和' + '1'.repeat(50000) + '年'), null);
  assert.equal(convert(null), null);
  assert.equal(convert(undefined), null);
  assert.equal(convert({}), null);
  assert.equal(convert('\u0000‮令和6年'), null);
  assert.ok(Date.now() - t0 < 500);
});

test('ファジング: 例外を投げない・出力にHTML特殊文字を含まない', () => {
  const chars = '令和平成昭和大正明治元年月日RHSTM0123456789０１２３４５６７８９/-.－／．<>&"\' ㋿㍻';
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 20000; i++) {
    const n = 1 + Math.floor(rnd() * 14);
    let s = '';
    for (let j = 0; j < n; j++) s += chars[Math.floor(rnd() * chars.length)];
    const r = convert(s);
    if (r && r.value) assert.doesNotMatch(r.value, /[<>&"']/);
  }
});

test('漢数字（位取り・十進・廿卅）', () => {
  assert.equal(v('令和六年三月十五日'), '2024年3月15日（金）');
  assert.equal(v('二〇二四年三月十五日'), '令和6年3月15日（金）');
  assert.equal(v('昭和二十年八月十五日'), '1945年8月15日（水）');
  assert.equal(v('平成三十一年'), '2019年');
  assert.equal(v('令和十二年'), '2030年');
  assert.equal(v('大正十五年十二月二十四日'), '1926年12月24日（金）');
  assert.equal(v('明治廿五年'), '1892年');
  assert.equal(v('明治卅年'), '1897年');
  assert.equal(v('令和元年五月一日'), '2019年5月1日（水）');
  assert.equal(convert('昭和百年'), null); // 百は未対応
  assert.ok(err('昭和七十年'));
});

test('江戸期 和暦→西暦（年のみ・旧暦）', () => {
  assert.equal(v('嘉永6年'), '1853年');
  assert.equal(v('嘉永六年'), '1853年');
  assert.equal(v('慶長元年'), '1596年');
  assert.equal(v('慶応4年'), '1868年');
  assert.equal(v('寛政12年'), '1800年');
  assert.equal(v('天保15年'), '1844年');
  assert.equal(v('安政7年'), '1860年');
  assert.equal(v('万延2年'), '1861年');
  assert.equal(v('元治2年'), '1865年');
  assert.match(convert('嘉永6年6月3日').label, /月日は換算せず/);
  assert.equal(v('嘉永6年6月3日'), '1853年'); // 月日・曜日は付かない
});

test('江戸期 範囲外・不正値を拒否', () => {
  assert.ok(err('慶長21年'));
  assert.ok(err('弘化6年'));
  assert.ok(err('元治3年'));
  assert.ok(err('嘉永0年'));
  assert.ok(err('嘉永6年13月'));
  assert.ok(err('嘉永6年6月31日'));
});

test('西暦→和暦 江戸期（改元年は併記）', () => {
  assert.equal(v('1853年'), '嘉永6年');
  assert.equal(v('1615年'), '元和元年／慶長20年');
  assert.equal(v('1844年'), '弘化元年／天保15年');
  assert.equal(v('1864年'), '元治元年／文久4年');
  assert.equal(v('1865年'), '慶応元年／元治2年');
  assert.equal(v('1868年'), '明治元年／慶応4年');
  assert.equal(v('1853/7/8'), '嘉永6年'); // 月日は換算せず
  assert.equal(v('1596年'), '慶長元年');
  assert.equal(convert('1595年'), null);
});

test('江戸期テーブルの整合性', async () => {
  const { EDO_ERAS } = await import('../converter.js');
  assert.equal(EDO_ERAS.length, 36);
  for (let i = 1; i < EDO_ERAS.length; i++) {
    // 前の元号の最終年 = 次の元号の元年（改元年は重なる）
    assert.equal(EDO_ERAS[i - 1].firstYear + EDO_ERAS[i - 1].lastYear - 1, EDO_ERAS[i].firstYear);
  }
  const last = EDO_ERAS.at(-1);
  assert.equal(last.firstYear + last.lastYear - 1, 1868); // 慶応4年 = 明治元年
});

// ---------------- 出力書式 ----------------
import { DEFAULT_SETTINGS, sanitizeSettings } from '../converter.js';
const f = (s, o) => convert(s, o)?.value;

test('既定値は従来どおりの出力', () => {
  assert.equal(f('令和6年3月15日', {}), '2024年3月15日（金）');
  assert.equal(f('令和6年3月15日', DEFAULT_SETTINGS), '2024年3月15日（金）');
  assert.equal(f('令和6年3月15日'), '2024年3月15日（金）');
});

test('区切り文字: スラッシュ・ドット・ハイフン・なし', () => {
  assert.equal(f('令和6年3月15日', { sep: 'slash' }), '2024/3/15（金）');
  assert.equal(f('令和6年3月15日', { sep: 'dot' }), '2024.3.15（金）');
  assert.equal(f('令和6年3月15日', { sep: 'hyphen' }), '2024-3-15（金）');
  assert.equal(f('令和6年3月15日', { sep: 'none' }), '20240315（金）'); // なしは常に2桁
  assert.equal(f('令和6年3月', { sep: 'slash' }), '2024/3');
  assert.equal(f('令和6年', { sep: 'slash' }), '2024年'); // 年のみは区切りなし
});

test('0埋め', () => {
  assert.equal(f('令和6年3月5日', { pad: true }), '2024年03月05日（火）');
  assert.equal(f('令和6年3月5日', { pad: true, sep: 'slash' }), '2024/03/05（火）');
  assert.equal(f('令和6年3月5日', { pad: false, sep: 'slash' }), '2024/3/5（火）');
  assert.equal(f('令和6年3月5日', { sep: 'none' }), '20240305（火）');
});

test('曜日の表示形式とコピー', () => {
  assert.equal(f('令和6年3月15日', { weekday: 'none' }), '2024年3月15日');
  assert.equal(f('令和6年3月15日', { weekday: 'paren-half' }), '2024年3月15日(金)');
  assert.equal(f('令和6年3月15日', { weekday: 'full' }), '2024年3月15日金曜日');
  const r = convert('令和6年3月15日', { weekday: 'paren-full', copyWeekday: false });
  assert.equal(r.value, '2024年3月15日');           // コピーには曜日なし
  assert.match(r.label, /2024年3月15日（金）$/);    // 表示には曜日あり
  assert.equal(f('令和6年3月', { weekday: 'full' }), '2024年3月'); // 日がなければ曜日なし
});

test('和暦の出力書式: 長い表記・略記・元年', () => {
  assert.equal(f('2024/3/15', { sep: 'slash' }), '令和6/3/15（金）');
  assert.equal(f('2024/3/15', { sep: 'dot', pad: true }), '令和6.03.15（金）');
  assert.equal(f('2024/3/15', { warekiStyle: 'alpha' }), 'R6.3.15（金）'); // 略記は年月日→ドット
  assert.equal(f('2024/3/15', { warekiStyle: 'alpha', sep: 'slash' }), 'R6/3/15（金）');
  assert.equal(f('2024年', { warekiStyle: 'alpha' }), 'R6');
  assert.equal(f('2019/5/1', { gannen: false }), '令和1年5月1日（水）');
  assert.equal(f('2019/5/1'), '令和元年5月1日（水）');
  assert.equal(f('2024/3/15', { sep: 'none' }), '令和06' + '0315（金）');
});

test('改元年の併記にも書式が効く／江戸期は略記にならない', () => {
  assert.equal(f('1989年', { warekiStyle: 'alpha' }), 'H1／S64');
  assert.equal(f('1989/1/7', { warekiStyle: 'alpha', sep: 'slash' }), 'S64/1/7（土）');
  assert.equal(f('1853年', { warekiStyle: 'alpha' }), '嘉永6年');
  assert.equal(f('1868年', { warekiStyle: 'alpha' }), 'M1／慶応4年');
});

test('不正な設定値は既定値に戻る（保存値は信頼しない）', () => {
  assert.deepEqual(sanitizeSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(sanitizeSettings({ sep: '<script>', pad: 'yes', weekday: 1 }), DEFAULT_SETTINGS);
  assert.equal(f('令和6年3月15日', { sep: 'bogus' }), '2024年3月15日（金）');
  assert.deepEqual(sanitizeSettings({ sep: 'dot', pad: true }), { ...DEFAULT_SETTINGS, sep: 'dot', pad: true });
});
