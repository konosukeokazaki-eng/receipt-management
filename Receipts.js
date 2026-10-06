// ============================================================
// Receipts.js - 行の読み書き、科目判定、入力時の再計算、確定
// ============================================================

function receiptSheet_() {
  var sh = getSS_().getSheetByName(SHEET_RECEIPTS);
  if (!sh) throw new Error('「領収書管理」シートがありません。メニューの「初期設定」を実行してください。');
  return sh;
}

// シートの1行（配列）を扱いやすい形にする
function rowToRec_(v) {
  return {
    no: String(v[COL.NO - 1] || ''), dateYmd: normDate_(v[COL.DATE - 1]), store: String(v[COL.STORE - 1] || '').trim(),
    amount: toNumber_(v[COL.AMOUNT - 1]), company: String(v[COL.COMPANY - 1] || '').trim(), purpose: String(v[COL.PURPOSE - 1] || '').trim(),
    month: normMonth_(v[COL.MONTH - 1]), account: String(v[COL.ACCOUNT - 1] || '').trim(), people: toNumber_(v[COL.PEOPLE - 1]),
    memo: String(v[COL.MEMO - 1] || ''), checked: v[COL.CHECK - 1] === true, user: String(v[COL.USER - 1] || '').trim(),
    hasInvoice: String(v[COL.INVOICE - 1]).trim() === '有', tnum: String(v[COL.TNUM - 1] || ''), rate: normRate_(v[COL.RATE - 1]),
    status: String(v[COL.STATUS - 1] || ''), fileId: String(v[COL.FILEID - 1] || ''), autoAccount: String(v[COL.AUTOACC - 1] || '').trim(),
    basis: String(v[COL.BASIS - 1] || ''), isFood: v[COL.FOOD - 1] === true
  };
}

// 科目・判定額・税区分・警告を計算し直す。
// reclassify が true のときは科目も判定し直す（人が直した科目は上書きしない）。
// hint: OCRの推定 {account, isFood}（ルールに当たらない店で使う）
function computeRec_(r, m, reclassify, hint) {
  var per = findTaxPeriod_(r.dateYmd, m.periods);
  var ratio = r.hasInvoice ? 100 : per.ratio;
  var manual = r.account && r.autoAccount && r.account !== r.autoAccount;

  if (reclassify) {
    var hit = matchRule_(r.store, m.rules);
    var base = '', under = '';
    if (hit) { r.isFood = hit.rule.food; base = hit.rule.account; under = hit.rule.under; r.basis = hit.basis; }
    else if (hint) { r.isFood = !!hint.isFood; base = hint.account || ''; under = hint.isFood ? hint.account : ''; r.basis = 'AI'; }
    else if (r.basis !== 'AI') { r.basis = ''; }
    if (hit || hint) {
      if (r.isFood && under !== '少額交際費' && under !== '会議費') under = '';
      var d = decideAccount_({ isFood: r.isFood, baseAccount: base, underAccount: under, amount: r.amount, hasInvoice: r.hasInvoice, rate: r.rate, ratio: ratio, people: r.people, threshold: m.threshold });
      r.under = under;
      if (!manual) r.account = d.account;
      r.autoAccount = d.account;
    }
  }
  r.judge = r.amount ? judgeAmount_(r.amount, r.hasInvoice, r.rate, ratio) : '';
  var t = taxInfo_({
    taxable: accountTaxable_(m, r.account), amount: r.amount, hasInvoice: r.hasInvoice, rate: r.rate, dateYmd: r.dateYmd, periods: m.periods,
    invoiceName10: String(m.cfg['インボイス有の税区分(10%)'] || ''), invoiceName8: String(m.cfg['インボイス有の税区分(8%)'] || ''), exemptName: String(m.cfg['対象外の税区分'] || '対象外')
  });
  r.taxCat = t.taxCat; r.taxAmount = t.taxAmount; r.taxMissing = t.missing && !!r.amount;
  r.warn = buildWarnings_(r);
  return r;
}

// 飲食の行で、人数や金額が変わったときの科目の出し直し（店の種類は変えない）
function refoodAccount_(r, m) {
  if (!r.isFood) return;
  var per = findTaxPeriod_(r.dateYmd, m.periods);
  var hit = matchRule_(r.store, m.rules);
  var under = hit && hit.rule.food ? hit.rule.under : ((r.autoAccount === '会議費' || r.autoAccount === '少額交際費') ? r.autoAccount : '');
  var d = decideAccount_({ isFood: true, underAccount: under, amount: r.amount, hasInvoice: r.hasInvoice, rate: r.rate, ratio: r.hasInvoice ? 100 : per.ratio, people: r.people, threshold: m.threshold });
  var manual = r.account && r.autoAccount && r.account !== r.autoAccount;
  if (!manual) r.account = d.account;
  r.autoAccount = d.account;
}

// 自動で決まる列だけを書き戻す（人が入力する列には触らない）
var DERIVED_COLS = ['MONTH', 'ACCOUNT', 'WARN', 'TAXCAT', 'JUDGE', 'AUTOACC', 'BASIS', 'FOOD'];
function writeDerived_(sh, startRow, recs) {
  var map = { MONTH: 'month', ACCOUNT: 'account', WARN: 'warn', TAXCAT: 'taxCat', JUDGE: 'judge', AUTOACC: 'autoAccount', BASIS: 'basis', FOOD: 'isFood' };
  DERIVED_COLS.forEach(function (k) {
    sh.getRange(startRow, COL[k], recs.length, 1).setValues(recs.map(function (r) { return [r[map[k]] === undefined ? '' : r[map[k]]]; }));
  });
}

// 入力のたびに動く（シンプルトリガー）。編集した行の警告・税区分・判定額・科目を更新する。
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    var sh = e.range.getSheet();
    if (sh.getName() !== SHEET_RECEIPTS) return;
    var r1 = Math.max(e.range.getRow(), DATA_START_ROW), r2 = Math.min(e.range.getLastRow(), sh.getLastRow());
    if (r2 < r1 || r2 - r1 > 500) return;
    var c1 = e.range.getColumn(), c2 = e.range.getLastColumn();
    var touches = function (c) { return c >= c1 && c <= c2; };
    if (c1 === COL.CHECK && c2 === COL.CHECK) return;
    var m = loadMasters_();
    var vals = sh.getRange(r1, 1, r2 - r1 + 1, COL_COUNT).getValues();
    var storeChanged = touches(COL.STORE);
    var foodInputs = [COL.AMOUNT, COL.PEOPLE, COL.INVOICE, COL.RATE, COL.DATE, COL.FOOD].some(touches);
    var recs = vals.map(function (v) {
      var r = rowToRec_(v);
      if (!r.no || r.status === ST_WAIT) { r.skip = true; return r; }
      if (r.status === ST_DONE) { r.keep = true; }
      else if (storeChanged) computeRec_(r, m, true, null);
      else { if (foodInputs) refoodAccount_(r, m); computeRec_(r, m, false, null); }
      return r;
    });
    recs.forEach(function (r, i) {
      if (r.skip || r.keep) {
        var v = vals[i];
        r.month = r.keep ? normMonth_(v[COL.MONTH - 1]) : v[COL.MONTH - 1];
        r.account = v[COL.ACCOUNT - 1]; r.warn = v[COL.WARN - 1]; r.taxCat = v[COL.TAXCAT - 1]; r.judge = v[COL.JUDGE - 1];
        r.autoAccount = v[COL.AUTOACC - 1]; r.basis = v[COL.BASIS - 1]; r.isFood = v[COL.FOOD - 1];
      }
    });
    writeDerived_(sh, r1, recs);
  } catch (err) { Logger.log('onEdit エラー: ' + err.message); }
}

// ---------- 取り込み時の初期値 ----------

// 確定済みの行から、店ごとの計上会社と用途を集める
function buildHistory_(sh) {
  var h = {};
  if (sh.getLastRow() < DATA_START_ROW) return h;
  sh.getRange(DATA_START_ROW, 1, sh.getLastRow() - 1, COL_COUNT).getValues().forEach(function (v) {
    if (v[COL.STATUS - 1] !== ST_DONE) return;
    var k = normText_(v[COL.STORE - 1]);
    if (!k) return;
    var o = h[k] || (h[k] = { companies: {}, purpose: '' });
    if (v[COL.COMPANY - 1]) o.companies[v[COL.COMPANY - 1]] = true;
    if (v[COL.PURPOSE - 1]) o.purpose = String(v[COL.PURPOSE - 1]);
  });
  return h;
}

// 過去に同じ店がいつも同じ会社なら、計上会社を初期値として入れる。用途は飲食以外だけ。
function applyHistory_(r, history) {
  var o = history[normText_(r.store)];
  if (!o) return;
  var cs = Object.keys(o.companies);
  if (!r.company && cs.length === 1) r.company = cs[0];
  if (!r.purpose && !r.isFood && o.purpose) r.purpose = o.purpose;
}

// ---------- 確定 ----------

function selectedRows_(sh) {
  var rows = {};
  sh.getActiveRangeList().getRanges().forEach(function (rg) {
    for (var r = Math.max(rg.getRow(), DATA_START_ROW); r <= Math.min(rg.getLastRow(), sh.getLastRow()); r++) rows[r] = true;
  });
  return Object.keys(rows).map(Number).sort(function (a, b) { return a - b; });
}

function menuConfirm() {
  requireUser_();
  var ui = SpreadsheetApp.getUi();
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(5000)) { ui.alert('ほかの処理が動いています。少し待ってからもう一度実行してください。'); return; }
  try {
    var res = confirmChecked_();
    var msg = res.done + '件を確定しました。';
    if (res.blocked.length) msg += '\n\n確定できなかった行（不足している項目）:\n' + res.blocked.slice(0, 20).join('\n');
    if (res.failed.length) msg += '\n\nファイルを移動できなかった行:\n' + res.failed.slice(0, 20).join('\n');
    if (res.noPeriod.length) msg += '\n\n期首月が未設定のため、会社フォルダの直下に保管しました: ' + res.noPeriod.join('、');
    if (res.timeout) msg += '\n\n時間切れのため途中で止めました。もう一度実行すると続きから処理します。';
    ui.alert(msg);
  } finally { lock.releaseLock(); }
}

function confirmChecked_() {
  var started = Date.now();
  var sh = receiptSheet_(), m = loadMasters_();
  var res = { done: 0, blocked: [], failed: [], noPeriod: [], timeout: false };
  if (sh.getLastRow() < DATA_START_ROW) return res;
  var vals = sh.getRange(DATA_START_ROW, 1, sh.getLastRow() - 1, COL_COUNT).getValues();
  var folderCache = {}, noPeriod = {}, learned = [], dirty = false;
  var put = function (v, r) {
    v[COL.MONTH - 1] = r.month; v[COL.ACCOUNT - 1] = r.account; v[COL.WARN - 1] = r.warn; v[COL.TAXCAT - 1] = r.taxCat;
    v[COL.JUDGE - 1] = r.judge; v[COL.AUTOACC - 1] = r.autoAccount; v[COL.BASIS - 1] = r.basis; v[COL.FOOD - 1] = r.isFood;
    dirty = true;
  };
  try {
    for (var i = 0; i < vals.length; i++) {
      var r = rowToRec_(vals[i]);
      if (!r.checked || r.status === ST_DONE || !r.no) continue;
      if (Date.now() - started > 270000) { res.timeout = true; break; }
      if (r.status === ST_WAIT) { res.blocked.push('No.' + r.no + '：OCRが終わっていません'); continue; }
      computeRec_(r, m, false, null);
      var block = blockReasons_(r);
      if (block.length) { res.blocked.push('No.' + r.no + '：' + block.join('、')); put(vals[i], r); continue; }
      var link = vals[i][COL.LINK - 1];
      try {
        if (r.fileId) {
          var company = findCompany_(m, r.company);
          var fp = fiscalPeriod_(r.dateYmd, company && company.startMonth, company && company.baseTerm, company && company.baseStartYear);
          if (!fp) noPeriod[r.company] = true;
          var folder = targetFolder_(m, r.user, r.company, fp, folderCache);
          var file = DriveApp.getFileById(r.fileId);
          var ext = (file.getName().match(/\.([A-Za-z0-9]+)$/) || [null, 'jpg'])[1];
          file.setName(buildFileName_(r.no, r.dateYmd, r.store, r.amount, ext));
          file.moveTo(folder);
          link = file.getUrl();
        }
      } catch (err) {
        res.failed.push('No.' + r.no + '：' + err.message);
        continue;
      }
      put(vals[i], r);
      vals[i][COL.STATUS - 1] = ST_DONE; vals[i][COL.LINK - 1] = link; vals[i][COL.CONFIRMED - 1] = new Date();
      learned.push(r);
      res.done++;
    }
  } finally {
    // ファイルを動かした分は必ずシートに反映する（自動の列だけを書き戻す）
    if (dirty) {
      ['MONTH', 'ACCOUNT', 'WARN', 'TAXCAT', 'JUDGE', 'AUTOACC', 'BASIS', 'FOOD', 'STATUS', 'LINK', 'CONFIRMED'].forEach(function (k) {
        sh.getRange(DATA_START_ROW, COL[k], vals.length, 1).setValues(vals.map(function (v) { return [v[COL[k] - 1]]; }));
      });
    }
  }
  res.noPeriod = Object.keys(noPeriod);
  learnRules_(learned);
  writeAuditLog_('confirm', res.done + '件', 'blocked=' + res.blocked.length + ' failed=' + res.failed.length);
  return res;
}

// 保管先のフォルダ: 利用者のフォルダ / 会社 / 期。会社と期のフォルダはなければ作る。
function targetFolder_(m, userName, companyName, fp, cache) {
  var key = userName + '|' + companyName + '|' + (fp ? fp.label : '');
  if (cache[key]) return cache[key];
  var u = findUser_(m, userName);
  var rootId = (u && u.folderId) || String(m.cfg['保管フォルダID'] || '');
  if (!rootId) throw new Error('利用者「' + userName + '」の保管フォルダIDが利用者マスタにありません');
  var ck = userName + '|' + companyName;
  var cf = cache[ck];
  if (!cf) {
    var root = DriveApp.getFolderById(rootId);
    var it = root.getFoldersByName(companyName);
    cf = cache[ck] = it.hasNext() ? it.next() : root.createFolder(companyName);
  }
  var target = cf;
  if (fp) {
    var it2 = cf.getFoldersByName(fp.label);
    target = it2.hasNext() ? it2.next() : cf.createFolder(fp.label);
  }
  cache[key] = target;
  return target;
}

// 確定した科目を店名ごとに「科目ルール」へ記録する（種別=学習）。次回の判定で最優先になる。
function learnRules_(recs) {
  if (!recs.length) return;
  var sh = getSS_().getSheetByName(SHEET_RULES);
  var m = loadMasters_();
  var index = {};
  m.rules.forEach(function (rule) { if (rule.type === '学習') index[normText_(rule.keyword)] = rule; });
  var appended = [];
  recs.forEach(function (r) {
    var k = normText_(r.store);
    if (!k || !r.account) return;
    var food = (r.account === '交際費' || r.account === '少額交際費') ? true : (r.account === '会議費' ? r.isFood === true : false);
    var ex = index[k];
    var under = food ? ((r.account === '少額交際費' || r.account === '会議費') ? r.account : (ex ? ex.under : (r.under || ''))) : '';
    var account = food ? '' : r.account;
    if (ex) {
      ex.count = (ex.count || 0) + 1; ex.account = account; ex.food = food; ex.under = under;
      if (ex.row) sh.getRange(ex.row, 2, 1, 6).setValues([[account, food, under, '学習', ex.count, new Date()]]);
    } else {
      var rule = { keyword: r.store, account: account, food: food, under: under, type: '学習', count: 1 };
      index[k] = rule; appended.push(rule);
    }
  });
  if (appended.length) {
    var start = sh.getLastRow() + 1;
    sh.getRange(start, 1, appended.length, 7).setValues(appended.map(function (a) { return [a.keyword, a.account, a.food, a.under, '学習', a.count, new Date()]; }));
  }
  MASTERS_CACHE_ = null;
}

function menuUnconfirm() {
  requireUser_();
  var sh = receiptSheet_();
  if (sh.getName() !== SpreadsheetApp.getActiveSheet().getName()) { SpreadsheetApp.getUi().alert('「領収書管理」シートで行を選んでから実行してください。'); return; }
  var n = 0;
  selectedRows_(sh).forEach(function (row) {
    if (sh.getRange(row, COL.STATUS).getValue() !== ST_DONE) return;
    sh.getRange(row, COL.STATUS).setValue(ST_OPEN);
    sh.getRange(row, COL.CHECK).setValue(false);
    sh.getRange(row, COL.CONFIRMED).setValue('');
    n++;
  });
  writeAuditLog_('unconfirm', n + '件', '');
  SpreadsheetApp.getUi().alert(n + '件の確定を取り消しました。ファイルは保管先に残っています。もう一度確定すると、名前と保管先が更新されます。');
}

function menuReclassify() {
  requireUser_();
  var sh = receiptSheet_(), m = loadMasters_(), n = 0;
  selectedRows_(sh).forEach(function (row) {
    var r = rowToRec_(sh.getRange(row, 1, 1, COL_COUNT).getValues()[0]);
    if (!r.no || r.status === ST_DONE || r.status === ST_WAIT) return;
    r.autoAccount = r.account;
    computeRec_(r, m, true, null);
    writeDerived_(sh, row, [r]);
    n++;
  });
  SpreadsheetApp.getUi().alert(n + '件の科目を判定し直しました。');
}
