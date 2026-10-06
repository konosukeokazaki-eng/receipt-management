// ============================================================
// Master.js - 設定とマスタの読み込み
// ============================================================

var CONFIG_DEFAULTS = [
  ['飲食費の基準額', 10000, '1人当たりの判定額がこの金額以下なら少額交際費または会議費'],
  ['未処理フォルダID', '13AIMe4Fe2vRVXlMYD3jbTq0B2Di09wtI', '撮影した画像の保存先'],
  ['保管フォルダID', '', '利用者マスタに保管フォルダIDがない利用者の移動先（予備）'],
  ['OCRモデル', 'gemini-3.6-flash', 'Gemini APIのモデル名'],
  ['開始No', 1, '領収書Noの最小値。既存の続きから始める場合に設定'],
  ['Noの桁数', 4, '領収書Noのゼロ埋め桁数'],
  ['インボイス有の税区分(10%)', '課税対応仕入10%', '弥生会計の税区分名'],
  ['インボイス有の税区分(8%)', '', '軽減税率の税区分名。未入力のあいだは警告を出す'],
  ['対象外の税区分', '対象外', '租税公課など消費税がかからない科目の税区分名'],
  ['貸方勘定科目', '未払金', 'CSVの貸方'],
  ['貸方税区分', '対象外', 'CSVの貸方税区分'],
  ['Slack文面の宛名', '熊久保さん', '精算額の文面の冒頭'],
  ['旧スプレッドシートID', '10gHpjDwRcZev3hsQ98rkQ0m5s7RpBywyqzBlcbEPltI', '過去データを写す元（管理本部_経費前払）']
];

function sheetRows_(name) {
  var sh = getSS_().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
}

var MASTERS_CACHE_ = null;

// 1回の実行のあいだは読み込んだ結果を使い回す。
function loadMasters_() {
  if (MASTERS_CACHE_) return MASTERS_CACHE_;
  var cfg = {};
  CONFIG_DEFAULTS.forEach(function (d) { cfg[d[0]] = d[1]; });
  sheetRows_(SHEET_CONFIG).forEach(function (r) { if (r[0] !== '') cfg[String(r[0]).trim()] = r[1]; });

  var companies = sheetRows_(SHEET_COMPANY).filter(function (r) { return r[0] !== ''; }).map(function (r, i) {
    return { row: i + 2, name: String(r[0]).trim(), startMonth: r[2], baseTerm: r[3], baseStartYear: r[4], budget: toNumber_(r[5]) };
  });
  var users = sheetRows_(SHEET_USERS).filter(function (r) { return r[0] !== ''; }).map(function (r) {
    return { name: String(r[0]).trim(), sub: String(r[1] || '').trim(), folderId: String(r[2] || '').trim() };
  });
  var accounts = sheetRows_(SHEET_ACCOUNTS).filter(function (r) { return r[0] !== ''; }).map(function (r) {
    return { name: String(r[0]).trim(), taxable: String(r[1]).trim() !== '対象外' };
  });
  var periods = sheetRows_(SHEET_TAX).filter(function (r) { return r[0] !== ''; }).map(function (r) {
    return { from: normDate_(r[0]), to: normDate_(r[1]), ratio: toNumber_(r[2]), name10: String(r[3] || '').trim(), name8: String(r[4] || '').trim() };
  });
  var rules = sheetRows_(SHEET_RULES).filter(function (r) { return r[0] !== ''; }).map(function (r, i) {
    return { row: i + 2, keyword: String(r[0]), account: String(r[1] || '').trim(), food: isTrue_(r[2]), under: String(r[3] || '').trim(), type: String(r[4] || '手動').trim(), count: toNumber_(r[5]) };
  });
  MASTERS_CACHE_ = { cfg: cfg, companies: companies, users: users, accounts: accounts, periods: periods, rules: rules, threshold: toNumber_(cfg['飲食費の基準額']) || 10000 };
  return MASTERS_CACHE_;
}

function isTrue_(v) {
  if (v === true) return true;
  var s = String(v == null ? '' : v).trim().toLowerCase();
  return s === 'true' || s === '○' || s === '〇' || s === '有' || s === '1';
}

function accountTaxable_(m, name) {
  for (var i = 0; i < m.accounts.length; i++) if (m.accounts[i].name === name) return m.accounts[i].taxable;
  return true;
}

function findUser_(m, name) {
  for (var i = 0; i < m.users.length; i++) if (m.users[i].name === name) return m.users[i];
  return null;
}

function findCompany_(m, name) {
  for (var i = 0; i < m.companies.length; i++) if (m.companies[i].name === name) return m.companies[i];
  return null;
}
