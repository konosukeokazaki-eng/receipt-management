// ============================================================
// Auth.js - 利用者の確認と監査ログ（workflow-bot と同じ考え方）
// ============================================================

function normalizeEmail_(s) {
  if (s == null) return '';
  return String(s).replace(/[\u0000-  ​-‍　﻿]/g, '').toLowerCase();
}

function currentEmail_() {
  try { return Session.getActiveUser().getEmail() || ''; } catch (e) { return ''; }
}

// 「_管理者」に登録された人だけ使える。シートが空のあいだは、同じドメインの全員が使える。
function isAllowed_(email) {
  var e = normalizeEmail_(email);
  var sheet = getSS_().getSheetByName(SHEET_ADMINS);
  if (!sheet || sheet.getLastRow() < 2) return true;
  if (!e) return false;
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < data.length; i++) if (normalizeEmail_(data[i][0]) === e) return true;
  return false;
}

function requireUser_() {
  var email = currentEmail_();
  if (!isAllowed_(email)) throw new Error('権限がありません');
  return email;
}

function writeAuditLog_(action, target, detail) {
  try {
    var ss = getSS_();
    var sheet = ss.getSheetByName(SHEET_AUDIT);
    if (!sheet) { sheet = ss.insertSheet(SHEET_AUDIT); sheet.appendRow(['タイムスタンプ', '実行者', 'アクション', '対象', '詳細']); }
    sheet.appendRow([new Date(), currentEmail_(), action, String(target || ''), String(detail || '').substring(0, 500)]);
  } catch (err) { Logger.log('writeAuditLog_ エラー: ' + err.message); }
}
