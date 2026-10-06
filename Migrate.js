// ============================================================
// Migrate.js - 旧スプレッドシート「領収書管理」の行を新しいシートへ写す
// 旧シートは読むだけで、書き換えない。同じNoの行は二重に入れない。
// ============================================================

var OLD_COMPANY_NAMES = { 'キャリア': 'シーマインドキャリア', 'エステート': 'シーマインドエステート' };

// 見出しの文字から列を探す。見つからなければ旧シートの既定の並びを使う（0始まり）。
var OLD_COLUMNS = [
  { key: 'no', words: ['領収書No', 'No', 'NO', '№'], fallback: 0 },
  { key: 'month', words: ['精算月'], fallback: 1 },
  { key: 'account', words: ['勘定科目', '科目'], fallback: 2 },
  { key: 'date', words: ['領収書日付', '日付'], fallback: 3 },
  { key: 'amount', words: ['金額'], fallback: 5 },
  { key: 'store', words: ['店名'], fallback: 6 },
  { key: 'purpose', words: ['用途', '他社'], fallback: 7 },
  { key: 'company', words: ['計上会社'], fallback: 8 },
  { key: 'invoice', words: ['インボイス'], fallback: 10 },
  { key: 'user', words: ['利用者', '精算者', '立替'], fallback: 12 }
];

function menuMigrate() {
  requireUser_();
  var ui = SpreadsheetApp.getUi();
  var m = loadMasters_();
  var id = String(m.cfg['旧スプレッドシートID'] || '').trim();
  if (!id) { ui.alert('設定シートの「旧スプレッドシートID」が空です。'); return; }
  var res = migrateOld_(id);
  var msg = '旧シートから ' + res.added + ' 件を写しました（すでにあるNo: ' + res.dup + ' 件、空の行: ' + res.empty + ' 件）。\n科目ルールに ' + res.learned + ' 店を記録しました。';
  if (res.unknownCompanies.length) msg += '\n\n会社マスタにない計上会社がありました（そのまま写しています）:\n' + res.unknownCompanies.join('、');
  if (res.unknownUsers.length) msg += '\n\n利用者マスタにない利用者がありました:\n' + res.unknownUsers.join('、');
  msg += '\n\n見出しの対応: ' + res.mapping;
  ui.alert(msg);
}

function migrateOld_(oldId) {
  var m = loadMasters_();
  var old = SpreadsheetApp.openById(oldId).getSheetByName(SHEET_RECEIPTS);
  if (!old) throw new Error('旧スプレッドシートに「領収書管理」シートがありません');
  var all = old.getRange(1, 1, old.getLastRow(), Math.min(old.getLastColumn(), 15)).getValues();
  // 見出しの行（「店名」を含む行）を先頭5行から探す
  var h = -1;
  for (var i = 0; i < Math.min(5, all.length) && h < 0; i++) {
    if (all[i].some(function (c) { return String(c).indexOf('店名') >= 0; })) h = i;
  }
  if (h < 0) throw new Error('旧シートの見出し（店名の列）が見つかりません');
  var idx = {}, mapping = [];
  OLD_COLUMNS.forEach(function (c) {
    var found = -1;
    for (var w = 0; w < c.words.length && found < 0; w++) {
      for (var j = 0; j < all[h].length && found < 0; j++) {
        var t = String(all[h][j]).replace(/\s/g, '');
        if (t && (t === c.words[w] || t.indexOf(c.words[w]) >= 0) && !Object.keys(idx).some(function (k) { return idx[k] === j; })) found = j;
      }
    }
    idx[c.key] = found >= 0 ? found : c.fallback;
    mapping.push(c.key + '=' + columnLetter_(idx[c.key] + 1) + (found >= 0 ? '' : '(既定)'));
  });

  var sh = receiptSheet_();
  var have = {};
  if (sh.getLastRow() >= DATA_START_ROW) {
    sh.getRange(DATA_START_ROW, COL.NO, sh.getLastRow() - 1, 1).getValues().forEach(function (v) { if (v[0] !== '') have[String(v[0])] = true; });
  }
  var res = { added: 0, dup: 0, empty: 0, learned: 0, unknownCompanies: [], unknownUsers: [], mapping: mapping.join(' ') };
  var out = [], recs = [], uc = {}, uu = {};
  var foodAccounts = { '交際費': 1, '少額交際費': 1, '会議費': 1 };
  for (var r = h + 1; r < all.length; r++) {
    var v = all[r];
    var no = String(v[idx.no] === '' || v[idx.no] == null ? '' : v[idx.no]).trim();
    var store = String(v[idx.store] || '').trim(), amount = toNumber_(v[idx.amount]);
    if (!no || (!store && !amount)) { res.empty++; continue; }
    if (have[no]) { res.dup++; continue; }
    have[no] = true;
    var company = String(v[idx.company] || '').trim();
    company = OLD_COMPANY_NAMES[company] || company;
    var user = String(v[idx.user] || '').trim();
    var account = String(v[idx.account] || '').trim();
    var inv = String(v[idx.invoice] || '');
    if (company && !findCompany_(m, company)) uc[company] = true;
    if (user && !findUser_(m, user)) uu[user] = true;
    var d = v[idx.date], dateYmd = normDate_(d);
    var row = [];
    for (var k = 0; k < COL_COUNT; k++) row.push('');
    row[COL.NO - 1] = no;
    row[COL.DATE - 1] = dateYmd ? new Date(parseInt(dateYmd.substring(0, 4), 10), parseInt(dateYmd.substring(5, 7), 10) - 1, parseInt(dateYmd.substring(8, 10), 10)) : '';
    row[COL.STORE - 1] = store; row[COL.AMOUNT - 1] = amount || ''; row[COL.COMPANY - 1] = company;
    row[COL.PURPOSE - 1] = String(v[idx.purpose] || '').trim(); row[COL.MONTH - 1] = normMonth_(v[idx.month]);
    row[COL.ACCOUNT - 1] = account; row[COL.CHECK - 1] = true; row[COL.USER - 1] = user;
    row[COL.INVOICE - 1] = inv.indexOf('有') >= 0 ? '有' : (inv.indexOf('無') >= 0 ? '無' : '');
    row[COL.STATUS - 1] = ST_DONE; row[COL.BASIS - 1] = '移行'; row[COL.FOOD - 1] = !!foodAccounts[account]; row[COL.IMPORTED - 1] = new Date();
    out.push(row);
    recs.push({ store: store, account: account, isFood: !!foodAccounts[account] });
  }
  if (out.length) {
    var start = sh.getLastRow() + 1;
    sh.getRange(start, COL.NO, out.length, 1).setNumberFormat('@');
    sh.getRange(start, COL.MONTH, out.length, 1).setNumberFormat('@');
    // 会社マスタ・利用者マスタにない名前も写せるよう、入力規則に合わない値は列ごとに書く
    sh.getRange(start, 1, out.length, COL_COUNT).clearDataValidations();
    sh.getRange(start, 1, out.length, COL_COUNT).setValues(out);
    sh.getRange(start, COL.CHECK, out.length, 1).insertCheckboxes();
    sh.getRange(start, COL.FOOD, out.length, 1).insertCheckboxes();
  }
  var before = loadMasters_().rules.length;
  learnRules_(recs);
  res.learned = loadMasters_().rules.length - before;
  res.added = out.length;
  res.unknownCompanies = Object.keys(uc); res.unknownUsers = Object.keys(uu);
  writeAuditLog_('migrate', res.added + '件', res.mapping);
  return res;
}
