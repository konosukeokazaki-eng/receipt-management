// ============================================================
// Schema.js - 初期設定（シートの作成、見出し、入力規則）
// 何度実行してもよい。既にあるシートのデータは消さない。
// ============================================================

var RECEIPT_HEADERS = ['No', '領収書日付', '店名', '金額', '計上会社', '用途（他社様名）', '精算月', '勘定科目', '人数', 'メモ',
  '確定', '警告', '利用者', 'インボイス', '登録番号', '税率', '税区分', '判定額', '状態',
  '画像', 'ファイルID', '自動判定の科目', '判定の根拠', '飲食', '取込日時', '確定日時'];

// 会社名、DriveのフォルダID、期首月、基準期（第1期）、第1期の開始年
var DEFAULT_COMPANIES = [
  ['シーマインドグループ', '1h5CxOrfoLdpJFr4l-8nlBZofQWt27EWy', 1, 1, 2021],
  ['C-mind', '1FVpFB5hkH8-Nkfks0WSJUKRZKvKsLG3G', 3, 1, 2011],
  ['シーマインドキャリア', '1nSwyxz7-Bz-3vx1E2ScxaXFE93Xrbs3v', 3, 1, 2012],
  ['キャンバスエッジ', '1Id6ddY8hRsXI94py1uoWyfINpW3s1lyV', 4, 1, 2023],
  ['LEAD', '1v5-Pcor1HYoc9T3xBAndIi5REX6AhJV9', 5, 1, 2014],
  ['シーマインドエステート', '1Exn2hT0IR2fWuelrnUpj6-_vKtz9oz5_', 8, 1, 2014],
  ['フラットエナジー', '1EtVkSWH4Qgq9mraaKcc3NrzLw2X8AzKZ', 9, 1, 2016],
  ['ライフサポート', '1XUmJPDjgy4sMjwIzeZNoUQ3gK5PYGO5I', 6, 1, 2017]
];
var DEFAULT_ACCOUNTS = [['交際費', '課税'], ['旅費交通費', '課税'], ['会議費', '課税'], ['車両費', '課税'], ['少額交際費', '課税'],
  ['福利厚生費', '課税'], ['消耗品費', '課税'], ['租税公課', '対象外'], ['通信費', '課税'], ['新聞図書費', '課税']];
var DEFAULT_TAX = [
  ['2023/10/01', '2026/09/30', 80, '課対仕入内10%区分80%', ''],
  ['2026/10/01', '2028/09/30', 70, '課対仕入内10%区分70%', ''],
  ['2028/10/01', '2030/09/30', 50, '', ''],
  ['2030/10/01', '2031/09/30', 30, '', '']
];
var DEFAULT_RULES = [
  ['タクシー', '旅費交通費', false, '', '手動', 0, ''],
  ['交通', '旅費交通費', false, '', '手動', 0, ''],
  ['パーキング', '車両費', false, '', '手動', 0, ''],
  ['駐車場', '車両費', false, '', '手動', 0, ''],
  ['居酒屋', '', true, '少額交際費', '手動', 0, ''],
  ['BAR', '', true, '少額交際費', '手動', 0, ''],
  ['カフェ', '', true, '会議費', '手動', 0, ''],
  ['珈琲', '', true, '会議費', '手動', 0, '']
];

function menuSetup() {
  setupSheets_();
  SpreadsheetApp.getUi().alert('初期設定が終わりました。\n「会社マスタ」の期首月と、「利用者マスタ」の補助科目を入力してください。');
}

function ensureSheet_(ss, name, headers, defaults) {
  var sh = ss.getSheetByName(name);
  var created = false;
  if (!sh) { sh = ss.insertSheet(name); created = true; }
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#eef1f5');
    sh.setFrozenRows(1);
    if (defaults && defaults.length) sh.getRange(2, 1, defaults.length, defaults[0].length).setValues(defaults);
    created = true;
  }
  return { sheet: sh, created: created };
}

function setupSheets_() {
  var ss = getSS_();
  var rec = ensureSheet_(ss, SHEET_RECEIPTS, RECEIPT_HEADERS, null);
  ensureSheet_(ss, SHEET_RULES, ['店名・キーワード', '勘定科目', '飲食', '基準以下の科目', '種別', '件数', '更新日'], DEFAULT_RULES);
  ensureSheet_(ss, SHEET_CONFIG, ['項目', '値', '説明'], CONFIG_DEFAULTS);
  ensureSheet_(ss, SHEET_COMPANY, ['会社名', 'フォルダID', '期首月', '基準期（第N期）', '基準期の開始年', '年間予算'], DEFAULT_COMPANIES.map(function (c) { return [c[0], c[1], c[2], c[3], c[4], '']; }));
  ensureSheet_(ss, SHEET_USERS, ['利用者', '弥生の補助科目'], [['虎石', ''], ['近藤', '']]);
  ensureSheet_(ss, SHEET_ACCOUNTS, ['勘定科目', '消費税'], DEFAULT_ACCOUNTS);
  var tax = ensureSheet_(ss, SHEET_TAX, ['開始日', '終了日', '控除割合(%)', '税区分名(10%)', '税区分名(8%)'], DEFAULT_TAX);
  if (tax.created) tax.sheet.getRange('A2:B').setNumberFormat('@');
  ensureSheet_(ss, SHEET_ADMINS, ['メールアドレス', '登録日', '権限'], null);
  ensureSheet_(ss, SHEET_AUDIT, ['タイムスタンプ', '実行者', 'アクション', '対象', '詳細'], null);
  formatReceiptSheet_(ss, rec.sheet);
  var first = ss.getSheetByName('シート1');
  if (first && first.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(first);
  MASTERS_CACHE_ = null;
}

// 「領収書管理」の見た目と入力規則。人が入れる列は黄色、自動の列はグレー。
function formatReceiptSheet_(ss, sh) {
  var rows = Math.max(sh.getMaxRows() - 1, 1);
  sh.setFrozenRows(1);
  sh.setFrozenColumns(COL.AMOUNT);
  sh.getRange(1, 1, 1, COL_COUNT).setBackground('#dfe3e8').setFontWeight('bold');
  [COL.COMPANY, COL.PURPOSE, COL.MONTH, COL.PEOPLE, COL.MEMO, COL.CHECK].forEach(function (c) { sh.getRange(1, c).setBackground('#ffe9a8'); });
  sh.getRange(DATA_START_ROW, COL.NO, rows, 1).setNumberFormat('@');
  sh.getRange(DATA_START_ROW, COL.DATE, rows, 1).setNumberFormat('yyyy/mm/dd');
  sh.getRange(DATA_START_ROW, COL.AMOUNT, rows, 1).setNumberFormat('#,##0');
  sh.getRange(DATA_START_ROW, COL.JUDGE, rows, 1).setNumberFormat('#,##0');
  sh.getRange(DATA_START_ROW, COL.MONTH, rows, 1).setNumberFormat('@');
  sh.getRange(DATA_START_ROW, COL.TNUM, rows, 1).setNumberFormat('@');
  sh.getRange(DATA_START_ROW, COL.FILEID, rows, 1).setNumberFormat('@');
  sh.getRange(DATA_START_ROW, COL.WARN, rows, 1).setFontColor('#b3261e');

  var list = function (sheetName) {
    return SpreadsheetApp.newDataValidation().requireValueInRange(ss.getSheetByName(sheetName).getRange('A2:A'), true).setAllowInvalid(false).build();
  };
  sh.getRange(DATA_START_ROW, COL.COMPANY, rows, 1).setDataValidation(list(SHEET_COMPANY));
  sh.getRange(DATA_START_ROW, COL.ACCOUNT, rows, 1).setDataValidation(list(SHEET_ACCOUNTS));
  sh.getRange(DATA_START_ROW, COL.USER, rows, 1).setDataValidation(list(SHEET_USERS));
  sh.getRange(DATA_START_ROW, COL.INVOICE, rows, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['有', '無'], true).setAllowInvalid(false).build());
  sh.getRange(DATA_START_ROW, COL.RATE, rows, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['10%', '8%'], true).setAllowInvalid(false).build());
  sh.getRange(DATA_START_ROW, COL.CHECK, rows, 1).insertCheckboxes();
  sh.getRange(DATA_START_ROW, COL.FOOD, rows, 1).insertCheckboxes();

  // 確定した行はグレー、警告のある行は薄い赤
  var all = sh.getRange(DATA_START_ROW, 1, rows, COL_COUNT);
  var st = '$' + columnLetter_(COL.STATUS) + '2', wn = '$' + columnLetter_(COL.WARN) + '2';
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=' + st + '="' + ST_DONE + '"').setBackground('#eeeeee').setFontColor('#777777').setRanges([all]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=AND(' + st + '<>"",' + wn + '<>"")').setBackground('#fdecea').setRanges([all]).build()
  ]);
  sh.setColumnWidth(COL.STORE, 200); sh.setColumnWidth(COL.PURPOSE, 220); sh.setColumnWidth(COL.WARN, 220); sh.setColumnWidth(COL.MEMO, 160);
  sh.hideColumns(COL.FILEID);
}

function columnLetter_(n) {
  var s = '';
  while (n > 0) { var r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
