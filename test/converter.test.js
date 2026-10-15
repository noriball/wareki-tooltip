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
  assert.equal(v('1989年1月'), '平成元年／昭和64年1月');
  assert.equal(v('1989年1月7日'), '昭和64年1月7日（土）');
  assert.equal(v('1989年1月8日'), '平成元年1月8日（日）');
  assert.equal(v('2019年4月30日'), '平成31年4月30日（火）');
  assert.equal(v('2019年5月1日'), '令和元年5月1日（水）');
  assert.equal(v('2019年3月'), '平成31年3月');
});

test('西暦→和暦 不正な日付と範囲外', () => {
  assert.ok(err('2024年2月30日'));
  assert.ok(err('2024年13月'));
  assert.equal(convert('1800年'), null);
  assert.equal(convert('1868年1月1日'), null);
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
