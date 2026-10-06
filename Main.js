// ============================================================
// Main.js - 定数、メニュー、doGet
// このスクリプトはスプレッドシートに紐づけて使う（コンテナバインド）。
// ============================================================

var VERSION = '1.0.0';

var SHEET_RECEIPTS = '領収書管理';
var SHEET_RULES    = '科目ルール';
var SHEET_CONFIG   = '設定';
var SHEET_COMPANY  = '会社マスタ';
var SHEET_USERS    = '利用者マスタ';
var SHEET_ACCOUNTS = '科目マスタ';
var SHEET_TAX      = '税区分マスタ';
var SHEET_ADMINS   = '_管理者';
var SHEET_AUDIT    = '_監査ログ';

// 「領収書管理」の列（1始まり）。並びを変えるときはここと Schema.js の見出しを一緒に直す。
var COL = {
  NO: 1, DATE: 2, STORE: 3, AMOUNT: 4, COMPANY: 5, PURPOSE: 6, MONTH: 7, ACCOUNT: 8, PEOPLE: 9, MEMO: 10,
  CHECK: 11, WARN: 12, USER: 13, INVOICE: 14, TNUM: 15, RATE: 16, TAXCAT: 17, JUDGE: 18, STATUS: 19,
  LINK: 20, FILEID: 21, AUTOACC: 22, BASIS: 23, FOOD: 24, IMPORTED: 25, CONFIRMED: 26
};
var COL_COUNT = 26;
var DATA_START_ROW = 2;

var ST_WAIT = 'OCR待ち', ST_FAIL = 'OCR失敗', ST_OPEN = '未確定', ST_DONE = '確定';

function getSS_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('スプレッドシートが見つかりません。スクリプトプロパティ SPREADSHEET_ID を設定してください。');
  return SpreadsheetApp.openById(id);
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('領収書管理')
    .addItem('確定する（チェックした行）', 'menuConfirm')
    .addItem('確定を取り消す（選択した行）', 'menuUnconfirm')
    .addSeparator()
    .addItem('未処理フォルダを取り込む', 'menuImportFolder')
    .addItem('OCRをやり直す（選択した行）', 'menuRetryOcr')
    .addItem('科目を判定し直す（選択した行）', 'menuReclassify')
    .addSeparator()
    .addItem('アプリのURLを表示', 'menuShowUrls')
    .addItem('初期設定（シートを作成）', 'menuSetup')
    .addToUi();
}

function include(name) { return HtmlService.createHtmlOutputFromFile(name).getContent(); }

function doGet(e) {
  var user = currentEmail_();
  if (!isAllowed_(user)) {
    return HtmlService.createHtmlOutput('<div style="font-family:sans-serif;text-align:center;padding:60px 20px"><p style="font-size:18px;font-weight:bold">アクセス権限がありません</p><p style="color:#666">' + escapeHtml_(user) + '</p></div>').setTitle('アクセス拒否');
  }
  var page = (e && e.parameter && e.parameter.page) || 'admin';
  var t = HtmlService.createTemplateFromFile(page === 'camera' ? 'camera' : 'admin');
  t.appVersion = VERSION;
  t.currentUser = user;
  t.selfUrl = ScriptApp.getService().getUrl();
  t.initial = JSON.stringify(page === 'camera' ? { users: loadMasters_().users.map(function (u) { return u.name; }) } : {});
  return t.evaluate()
    .setTitle(page === 'camera' ? '領収書撮影' : '領収書管理')
    .addMetaTag('viewport', 'width=device-width,initial-scale=1');
}

function escapeHtml_(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
}

function menuShowUrls() {
  var url = ScriptApp.getService().getUrl();
  var msg = url ? '管理アプリ:\n' + url + '\n\n撮影アプリ:\n' + url + '?page=camera' : 'ウェブアプリがまだデプロイされていません。Apps Scriptの「デプロイ」から公開してください。';
  SpreadsheetApp.getUi().alert(msg);
}
