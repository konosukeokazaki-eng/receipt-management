// ============================================================
// Logic.js - 計算だけを行う関数（GASのサービスを使わない。tests/ でnode実行できる）
// ============================================================

function normText_(s) {
  if (s == null) return '';
  return String(s).normalize('NFKC').toLowerCase().replace(/[\s　]/g, '');
}

function pad2_(n) { return (n < 10 ? '0' : '') + n; }

// 精算月を "YYYY/MM" に揃える。解釈できなければ空文字。
function normMonth_(v) {
  if (v == null || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return isNaN(v.getTime()) ? '' : v.getFullYear() + '/' + pad2_(v.getMonth() + 1);
  }
  var s = String(v).normalize('NFKC').trim();
  var m = s.match(/^(\d{4})\D{0,2}(\d{1,2})(?:\D.*)?$/);
  if (!m) return '';
  var mo = parseInt(m[2], 10);
  if (mo < 1 || mo > 12) return '';
  return m[1] + '/' + pad2_(mo);
}

// 日付を "YYYY/MM/DD" に揃える。
function normDate_(v) {
  if (v == null || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return isNaN(v.getTime()) ? '' : v.getFullYear() + '/' + pad2_(v.getMonth() + 1) + '/' + pad2_(v.getDate());
  }
  var m = String(v).normalize('NFKC').trim().match(/^(\d{4})\D(\d{1,2})\D(\d{1,2})/);
  if (!m) return '';
  var mo = parseInt(m[2], 10), d = parseInt(m[3], 10);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return '';
  return m[1] + '/' + pad2_(mo) + '/' + pad2_(d);
}

function toNumber_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  if (v == null || v === '') return 0;
  var n = Number(String(v).normalize('NFKC').replace(/[,円¥\\\s]/g, ''));
  return isFinite(n) ? n : 0;
}

// 税率: 8 または 10（それ以外は10として扱う）
function normRate_(v) {
  var s = String(v == null ? '' : v).normalize('NFKC');
  return /8/.test(s) && !/10/.test(s) ? 8 : 10;
}

// インボイス無しの領収書日付に対応する経過措置の行を返す。該当なしは控除0%。
// periods: [{from:'YYYY/MM/DD', to:'YYYY/MM/DD', ratio:80, name10:'', name8:''}]
function findTaxPeriod_(dateYmd, periods) {
  for (var i = 0; i < periods.length; i++) {
    var p = periods[i];
    if (dateYmd >= p.from && dateYmd <= p.to) return p;
  }
  return { from: '', to: '', ratio: 0, name10: '', name8: '' };
}

// 仮払消費税として控除できる額（円未満切り捨て）
function deductibleTax_(amount, hasInvoice, rate, ratio) {
  var tax = rate === 8 ? amount * 8 / 108 : amount * 10 / 110;
  var d = hasInvoice ? tax : tax * ratio / 100;
  return Math.floor(d + 1e-6);
}

// 飲食費の判定額（税抜経理。控除できない消費税は費用に含める）
function judgeAmount_(amount, hasInvoice, rate, ratio) {
  return amount - deductibleTax_(amount, hasInvoice, rate, ratio);
}

// 店名から科目ルールを探す。学習（店名一致）→ キーワード（長いもの優先）の順。
// rules: [{keyword, account, food, under, type}]
function matchRule_(store, rules) {
  var s = normText_(store);
  if (!s) return null;
  var best = null, i, k;
  for (i = 0; i < rules.length; i++) {
    if (rules[i].type === '学習' && normText_(rules[i].keyword) === s) {
      return { rule: rules[i], basis: '履歴' };
    }
  }
  for (i = 0; i < rules.length; i++) {
    if (rules[i].type === '学習') continue;
    k = normText_(rules[i].keyword);
    if (k && s.indexOf(k) >= 0 && (!best || k.length > normText_(best.keyword).length)) best = rules[i];
  }
  return best ? { rule: best, basis: 'ルール' } : null;
}

// 勘定科目を決める。
// in: {isFood, baseAccount, underAccount, amount, hasInvoice, rate, ratio, people, threshold}
function decideAccount_(p) {
  var judge = judgeAmount_(p.amount, p.hasInvoice, p.rate, p.ratio);
  if (!p.isFood) return { account: p.baseAccount || '', judge: judge, perPerson: null, needPeople: false };
  var people = p.people > 0 ? p.people : 0;
  var per = people ? judge / people : judge;
  var under = per <= p.threshold;
  return {
    account: under ? (p.underAccount || '少額交際費') : '交際費',
    judge: judge,
    perPerson: per,
    needPeople: !people
  };
}

// CSVに出す税区分と税額。
// in: {taxable, amount, hasInvoice, rate, dateYmd, periods, invoiceName10, invoiceName8, exemptName}
function taxInfo_(p) {
  if (!p.taxable) return { taxCat: p.exemptName || '対象外', taxAmount: 0, ratio: 100, missing: false };
  if (p.hasInvoice) {
    var n = p.rate === 8 ? p.invoiceName8 : p.invoiceName10;
    return { taxCat: n || '', taxAmount: deductibleTax_(p.amount, true, p.rate, 100), ratio: 100, missing: !n };
  }
  var per = findTaxPeriod_(p.dateYmd, p.periods);
  var name = p.rate === 8 ? per.name8 : per.name10;
  return { taxCat: name || '', taxAmount: deductibleTax_(p.amount, false, p.rate, per.ratio), ratio: per.ratio, missing: !name };
}

// 会社の期を求める。期首月が未設定なら null。
// 期番号と基準期の開始年があれば「第N期」、なければ「2026年4月〜2027年3月」。
function fiscalPeriod_(dateYmd, startMonth, baseTerm, baseStartYear) {
  var sm = parseInt(startMonth, 10);
  if (!dateYmd || !(sm >= 1 && sm <= 12)) return null;
  var y = parseInt(dateYmd.substring(0, 4), 10), m = parseInt(dateYmd.substring(5, 7), 10);
  var fy = m >= sm ? y : y - 1;
  var endM = sm === 1 ? 12 : sm - 1, endY = sm === 1 ? fy : fy + 1;
  var bt = parseInt(baseTerm, 10), by = parseInt(baseStartYear, 10);
  var label = (bt > 0 && by > 0) ? '第' + (bt + (fy - by)) + '期' : fy + '年' + sm + '月〜' + endY + '年' + endM + '月';
  return { startYear: fy, startMonth: sm, label: label };
}

function sanitizeFileName_(name) {
  return String(name == null ? '' : name).replace(/[\/\\:*?"<>|\r\n\t]/g, '_').trim();
}

// 確定後のファイル名: No_日付_店名_金額.拡張子
function buildFileName_(no, dateYmd, store, amount, ext) {
  return [no, String(dateYmd || '').replace(/\//g, ''), sanitizeFileName_(store || '不明'), amount].join('_') + '.' + (ext || 'jpg');
}

// 警告の一覧を作る。
function buildWarnings_(r) {
  var w = [];
  if (r.status === 'OCR待ち') return 'OCR待ち';
  if (r.status === 'OCR失敗') w.push('OCR失敗');
  if (!r.dateYmd) w.push('日付なし');
  if (!r.amount) w.push('金額なし');
  if (!r.store) w.push('店名なし');
  if (!r.account) w.push('科目なし');
  if (!r.user) w.push('利用者未入力');
  if (!r.company) w.push('計上会社未入力');
  if (!r.purpose) w.push('用途未入力');
  if (!r.month) w.push('精算月未入力');
  if (r.isFood && !r.people) w.push('人数未記録');
  if (r.taxMissing) w.push('税区分名未設定');
  return w.join('、');
}

// 確定を止める理由（空なら確定できる）
function blockReasons_(r) {
  var b = [];
  if (!r.dateYmd) b.push('日付');
  if (!r.amount) b.push('金額');
  if (!r.account) b.push('勘定科目');
  if (!r.user) b.push('利用者');
  if (!r.company) b.push('計上会社');
  if (!r.month) b.push('精算月');
  return b;
}

// 弥生会計インポート形式（25項目）の1行
// cfg: {creditAccount, creditTax, creditSub}
function yayoiRow_(r, cfg) {
  var memo = [r.store, r.purpose].filter(function (x) { return x; }).join(' ');
  return [
    '2000', '', '', r.dateYmd,
    r.account, '', '', r.taxCat, r.amount, r.taxAmount || '',
    cfg.creditAccount, cfg.creditSub || '', '', cfg.creditTax, r.amount, '',
    memo, '', '', '0', '', r.memo || '', '0', '0', 'no'
  ];
}

function csvLine_(cells) {
  return cells.map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(',');
}

if (typeof module !== 'undefined') {
  module.exports = {
    normText_: normText_, normMonth_: normMonth_, normDate_: normDate_, toNumber_: toNumber_, normRate_: normRate_,
    findTaxPeriod_: findTaxPeriod_, deductibleTax_: deductibleTax_, judgeAmount_: judgeAmount_, matchRule_: matchRule_,
    decideAccount_: decideAccount_, taxInfo_: taxInfo_, fiscalPeriod_: fiscalPeriod_, buildFileName_: buildFileName_,
    buildWarnings_: buildWarnings_, blockReasons_: blockReasons_, yayoiRow_: yayoiRow_, csvLine_: csvLine_
  };
}
