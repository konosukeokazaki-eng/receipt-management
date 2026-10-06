const assert = require('assert');
const L = require('../Logic.js');
const periods = [
  { from: '2023/10/01', to: '2026/09/30', ratio: 80, name10: '課対仕入内10%区分80%', name8: '' },
  { from: '2026/10/01', to: '2028/09/30', ratio: 70, name10: '課対仕入内10%区分70%', name8: '' },
];
// 判定額（要件定義書5章の表）
assert.strictEqual(L.judgeAmount_(11000, true, 10, 100), 10000);
assert.strictEqual(L.judgeAmount_(11000, true, 8, 100), 10186);
assert.strictEqual(L.judgeAmount_(11000, false, 10, 80), 10200);
assert.strictEqual(L.judgeAmount_(11000, false, 10, 70), 10300);
// 科目
const base = { isFood: true, underAccount: '会議費', hasInvoice: true, rate: 10, ratio: 100, threshold: 10000 };
assert.strictEqual(L.decideAccount_({ ...base, amount: 11000, people: 0 }).account, '会議費');
assert.strictEqual(L.decideAccount_({ ...base, amount: 11001, people: 0 }).account, '交際費');
assert.strictEqual(L.decideAccount_({ ...base, amount: 11001, people: 0 }).needPeople, true);
assert.strictEqual(L.decideAccount_({ ...base, amount: 44000, people: 4 }).account, '会議費');
assert.strictEqual(L.decideAccount_({ ...base, amount: 44000, people: 3 }).account, '交際費');
assert.strictEqual(L.decideAccount_({ ...base, underAccount: '', amount: 5000, people: 2 }).account, '少額交際費');
assert.strictEqual(L.decideAccount_({ ...base, amount: 11000, people: 1, hasInvoice: false, ratio: 70 }).account, '交際費');
assert.strictEqual(L.decideAccount_({ isFood: false, baseAccount: '旅費交通費', amount: 50000, hasInvoice: true, rate: 10, ratio: 100, threshold: 10000 }).account, '旅費交通費');
// ルール
const rules = [
  { keyword: 'タクシー', account: '旅費交通費', food: false, under: '', type: '手動' },
  { keyword: '日本交通タクシー', account: '車両費', food: false, under: '', type: '手動' },
  { keyword: '鳥貴族 新宿店', account: '', food: true, under: '少額交際費', type: '学習' },
];
assert.strictEqual(L.matchRule_('ＡＢＣタクシー', rules).rule.account, '旅費交通費');
assert.strictEqual(L.matchRule_('日本交通タクシー(株)', rules).rule.account, '車両費');
assert.strictEqual(L.matchRule_('鳥貴族　新宿店', rules).basis, '履歴');
assert.strictEqual(L.matchRule_('鳥貴族 渋谷店', rules), null);
// 税区分（領収書日付で切り替え）
const t = { taxable: true, amount: 11000, rate: 10, periods, invoiceName10: 'INV10', invoiceName8: '' };
assert.deepStrictEqual(L.taxInfo_({ ...t, hasInvoice: true, dateYmd: '2026/10/05' }), { taxCat: 'INV10', taxAmount: 1000, ratio: 100, missing: false });
assert.strictEqual(L.taxInfo_({ ...t, hasInvoice: false, dateYmd: '2026/09/30' }).taxCat, '課対仕入内10%区分80%');
assert.strictEqual(L.taxInfo_({ ...t, hasInvoice: false, dateYmd: '2026/09/30' }).taxAmount, 800);
assert.strictEqual(L.taxInfo_({ ...t, hasInvoice: false, dateYmd: '2026/10/01' }).taxCat, '課対仕入内10%区分70%');
assert.strictEqual(L.taxInfo_({ ...t, hasInvoice: false, dateYmd: '2026/10/01' }).taxAmount, 700);
assert.strictEqual(L.taxInfo_({ ...t, hasInvoice: false, rate: 8, dateYmd: '2026/10/01' }).missing, true);
assert.strictEqual(L.taxInfo_({ ...t, taxable: false, hasInvoice: true, dateYmd: '2026/10/01' }).taxAmount, 0);
// 期
assert.strictEqual(L.fiscalPeriod_('2026/10/05', 4, 12, 2026).label, '第12期');
assert.strictEqual(L.fiscalPeriod_('2026/03/31', 4, 12, 2026).label, '第11期');
assert.strictEqual(L.fiscalPeriod_('2027/04/01', 4, 12, 2026).label, '第13期');
assert.strictEqual(L.fiscalPeriod_('2026/10/05', 10, '', '').label, '2026年10月〜2027年9月');
assert.strictEqual(L.fiscalPeriod_('2026/09/30', 10, '', '').label, '2025年10月〜2026年9月');
assert.strictEqual(L.fiscalPeriod_('2026/05/05', 1, '', '').label, '2026年1月〜2026年12月');
assert.strictEqual(L.fiscalPeriod_('2026/05/05', '', '', ''), null);
// 6社の期（2026/10/05時点）と期の境目
assert.strictEqual(L.fiscalPeriod_('2026/10/05', 1, 1, 2021).label, '第6期');
assert.strictEqual(L.fiscalPeriod_('2026/10/05', 3, 1, 2011).label, '第16期');
assert.strictEqual(L.fiscalPeriod_('2026/10/05', 3, 1, 2012).label, '第15期');
assert.strictEqual(L.fiscalPeriod_('2026/10/05', 4, 1, 2023).label, '第4期');
assert.strictEqual(L.fiscalPeriod_('2026/10/05', 5, 1, 2014).label, '第13期');
assert.strictEqual(L.fiscalPeriod_('2026/10/05', 8, 1, 2014).label, '第13期');
assert.strictEqual(L.fiscalPeriod_('2026/07/31', 8, 1, 2014).label, '第12期');
assert.strictEqual(L.fiscalPeriod_('2026/08/01', 8, 1, 2014).label, '第13期');
assert.strictEqual(L.fiscalPeriod_('2026/02/28', 3, 1, 2011).label, '第15期');
// 整形
assert.strictEqual(L.normMonth_('2026/10'), '2026/10');
assert.strictEqual(L.normMonth_('2026-9'), '2026/09');
assert.strictEqual(L.normMonth_('202610'), '2026/10');
assert.strictEqual(L.normMonth_(new Date(2026, 9, 1)), '2026/10');
assert.strictEqual(L.normMonth_('10月'), '');
assert.strictEqual(L.normDate_('2026-10-5'), '2026/10/05');
assert.strictEqual(L.toNumber_('¥11,000'), 11000);
assert.strictEqual(L.normRate_('8%'), 8);
assert.strictEqual(L.normRate_('10%'), 10);
assert.strictEqual(L.normRate_(''), 10);
assert.strictEqual(L.buildFileName_('0657', '2026/10/05', 'a/b:店', 11000, 'jpg'), '0657_20261005_a_b_店_11000.jpg');
assert.strictEqual(L.buildWarnings_({ status: '未確定', dateYmd: '2026/10/05', amount: 1, store: 's', account: 'a', company: '', purpose: '', month: '', isFood: true, people: 0 }), '利用者未入力、計上会社未入力、用途未入力、精算月未入力、人数未記録');
assert.deepStrictEqual(L.blockReasons_({ dateYmd: '2026/10/05', amount: 1, account: 'a', company: 'c', month: '' }), ['利用者', '精算月']);
const row = L.yayoiRow_({ dateYmd: '2026/10/05', account: '交際費', taxCat: 'X', amount: 11000, taxAmount: 1000, store: '店', purpose: 'A社 "山田"様', memo: '' }, { creditAccount: '未払金', creditTax: '対象外', creditSub: '代表' });
assert.strictEqual(row.length, 25);
assert.strictEqual(L.csvLine_(row).split('","')[16], '店 A社 ""山田""様');
console.log('logic tests passed');
