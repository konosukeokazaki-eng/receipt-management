// ============================================================
// Admin.js - 管理アプリ用のデータ取得とCSV出力
// ============================================================

// 管理アプリが最初に1回だけ呼ぶ。集計は画面側で行う。
function api_getData() {
  requireUser_();
  var sh = receiptSheet_(), m = loadMasters_();
  var rows = [];
  if (sh.getLastRow() >= DATA_START_ROW) {
    sh.getRange(DATA_START_ROW, 1, sh.getLastRow() - 1, COL_COUNT).getValues().forEach(function (v) {
      var r = rowToRec_(v);
      if (!r.no) return;
      rows.push([r.no, r.dateYmd, r.month, r.company, r.user, r.account, r.amount, r.status, r.autoAccount, r.basis, String(v[COL.WARN - 1] || '') !== '' ? 1 : 0]);
    });
  }
  return {
    rows: rows,
    companies: m.companies.map(function (c) { return { name: c.name, startMonth: parseInt(c.startMonth, 10) || 0, baseTerm: parseInt(c.baseTerm, 10) || 0, baseStartYear: parseInt(c.baseStartYear, 10) || 0, budget: c.budget }; }),
    users: m.users.map(function (u) { return u.name; }),
    slackTo: String(m.cfg['Slack文面の宛名'] || ''),
    sheetUrl: getSS_().getUrl()
  };
}

// 精算月を指定して、会社別の弥生インポート用CSVをZIPにして返す。確定済みの行だけが対象。
function api_exportCsv(month) {
  requireUser_();
  var ym = normMonth_(month);
  if (!ym) throw new Error('精算月を選んでください');
  var sh = receiptSheet_(), m = loadMasters_();
  var subs = {};
  m.users.forEach(function (u) { subs[u.name] = u.sub; });
  var grouped = {}, counts = {}, totals = {}, skipped = 0, problems = [];
  if (sh.getLastRow() >= DATA_START_ROW) {
    sh.getRange(DATA_START_ROW, 1, sh.getLastRow() - 1, COL_COUNT).getValues().forEach(function (v) {
      var r = rowToRec_(v);
      if (!r.no || r.month !== ym) return;
      if (r.status !== ST_DONE) { skipped++; return; }
      computeRec_(r, m, false, null);
      if (r.taxMissing) problems.push('No.' + r.no + '：税区分名が未設定');
      var line = csvLine_(yayoiRow_(r, { creditAccount: String(m.cfg['貸方勘定科目'] || ''), creditTax: String(m.cfg['貸方税区分'] || ''), creditSub: subs[r.user] || '' }));
      (grouped[r.company] = grouped[r.company] || []).push(line);
      counts[r.company] = (counts[r.company] || 0) + 1;
      totals[r.company] = (totals[r.company] || 0) + r.amount;
    });
  }
  var names = Object.keys(grouped);
  if (!names.length) return { empty: true, skipped: skipped };
  var tag = ym.replace('/', '');
  var blobs = names.map(function (c) {
    return Utilities.newBlob('', 'text/csv', sanitizeFileName_(c) + '_' + tag + '.csv').setDataFromString(grouped[c].join('\r\n') + '\r\n', 'Shift_JIS');
  });
  var zip = Utilities.zip(blobs, '領収書CSV_' + tag + '.zip');
  writeAuditLog_('csv', ym, names.map(function (c) { return c + '=' + counts[c]; }).join(' '));
  return {
    name: '領収書CSV_' + tag + '.zip', data: Utilities.base64Encode(zip.getBytes()), skipped: skipped, problems: problems,
    summary: names.map(function (c) { return { company: c, count: counts[c], total: totals[c] }; })
  };
}
