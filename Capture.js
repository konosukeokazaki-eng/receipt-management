// ============================================================
// Capture.js - 撮影アプリからの保存、OCR（Gemini）、未処理フォルダの取り込み
// ============================================================

function nextNo_(sh, m) {
  var max = toNumber_(m.cfg['開始No']) - 1;
  if (sh.getLastRow() >= DATA_START_ROW) {
    sh.getRange(DATA_START_ROW, COL.NO, sh.getLastRow() - 1, 1).getValues().forEach(function (v) {
      var n = parseInt(String(v[0]).replace(/\D/g, ''), 10);
      if (n > max) max = n;
    });
  }
  var digits = toNumber_(m.cfg['Noの桁数']) || 4;
  var s = String(max + 1);
  while (s.length < digits) s = '0' + s;
  return s;
}

// 行を1つ追加して領収書Noを返す。採番が重ならないようロックする。
function appendReceiptRow_(fileId, link, user) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = receiptSheet_(), m = loadMasters_();
    var no = nextNo_(sh, m);
    var v = [];
    for (var i = 0; i < COL_COUNT; i++) v.push('');
    v[COL.NO - 1] = no; v[COL.USER - 1] = user || ''; v[COL.STATUS - 1] = ST_WAIT; v[COL.WARN - 1] = ST_WAIT;
    v[COL.LINK - 1] = link; v[COL.FILEID - 1] = fileId; v[COL.IMPORTED - 1] = new Date(); v[COL.CHECK - 1] = false; v[COL.FOOD - 1] = false;
    var row = sh.getLastRow() + 1;
    sh.getRange(row, COL.NO).setNumberFormat('@');
    sh.getRange(row, 1, 1, COL_COUNT).setValues([v]);
    SpreadsheetApp.flush();
    return no;
  } finally { lock.releaseLock(); }
}

// 撮影アプリから呼ぶ。画像を未処理フォルダに保存し、行を追加する。OCRは api_ocr で別に動かす。
function api_upload(payload) {
  requireUser_();
  if (!payload || !payload.data) throw new Error('画像がありません');
  var m = loadMasters_();
  var mime = payload.mime || 'image/jpeg';
  var ext = mime === 'image/png' ? 'png' : (mime === 'application/pdf' ? 'pdf' : 'jpg');
  var folder = DriveApp.getFolderById(String(m.cfg['未処理フォルダID']));
  var stamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd_HHmmss_SSS');
  var file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(payload.data), mime, '未処理_' + stamp + '.' + ext));
  var no = appendReceiptRow_(file.getId(), file.getUrl(), payload.user);
  file.setName(no + '_未処理.' + ext);
  return { no: no };
}

function api_ocr(no) {
  requireUser_();
  return ocrByNo_(String(no), null);
}

function findRowByNo_(sh, no) {
  if (sh.getLastRow() < DATA_START_ROW) return 0;
  var nos = sh.getRange(DATA_START_ROW, COL.NO, sh.getLastRow() - 1, 1).getValues();
  for (var i = nos.length - 1; i >= 0; i--) if (String(nos[i][0]) === no) return DATA_START_ROW + i;
  return 0;
}

// 1枚をOCRして行を埋める。history を渡すと使い回す。
function ocrByNo_(no, history) {
  var sh = receiptSheet_(), m = loadMasters_();
  var row = findRowByNo_(sh, no);
  if (!row) throw new Error('No.' + no + ' が見つかりません');
  var fileId = String(sh.getRange(row, COL.FILEID).getValue());
  var o, error = '';
  try { o = callGemini_(DriveApp.getFileById(fileId).getBlob(), m); }
  catch (err) { error = err.message; Logger.log('OCR失敗 No.' + no + ': ' + error); }

  // OCR中に行が動いていないか、書く直前に探し直す
  row = findRowByNo_(sh, no);
  if (!row) throw new Error('No.' + no + ' が見つかりません');
  var r = rowToRec_(sh.getRange(row, 1, 1, COL_COUNT).getValues()[0]);
  if (r.status === ST_DONE) return { no: no, ok: true };
  if (!o) {
    sh.getRange(row, COL.STATUS).setValue(ST_FAIL);
    sh.getRange(row, COL.WARN).setValue('OCR失敗：' + error.substring(0, 80));
    return { no: no, ok: false, error: error };
  }
  r.status = ST_OPEN;
  r.dateYmd = normDate_(o.date); r.store = String(o.store || '').trim(); r.amount = toNumber_(o.amount);
  r.tnum = /^T\d{13}$/.test(String(o.invoice_number || '').replace(/[\s-]/g, '')) ? String(o.invoice_number).replace(/[\s-]/g, '') : '';
  r.hasInvoice = !!r.tnum;
  r.people = toNumber_(o.people) > 0 ? Math.floor(toNumber_(o.people)) : 0;
  r.rate = String(o.tax_rate) === '8' ? 8 : 10;
  r.account = ''; r.autoAccount = '';
  var guess = String(o.account || '').trim();
  var known = m.accounts.some(function (a) { return a.name === guess; });
  computeRec_(r, m, true, { account: known ? guess : '', isFood: o.is_food === true });
  applyHistory_(r, history || buildHistory_(sh));
  if (String(o.tax_rate) === 'mixed' && !r.memo) r.memo = '8%と10%が混在';
  r.warn = buildWarnings_(r);

  var date = r.dateYmd ? new Date(parseInt(r.dateYmd.substring(0, 4), 10), parseInt(r.dateYmd.substring(5, 7), 10) - 1, parseInt(r.dateYmd.substring(8, 10), 10)) : '';
  // No から 飲食 までを1回で書く（確定チェックと利用者は元の値を保つ）
  var out = sh.getRange(row, 1, 1, COL_COUNT).getValues()[0];
  out[COL.DATE - 1] = date; out[COL.STORE - 1] = r.store; out[COL.AMOUNT - 1] = r.amount || '';
  out[COL.COMPANY - 1] = r.company; out[COL.PURPOSE - 1] = r.purpose; out[COL.ACCOUNT - 1] = r.account;
  out[COL.PEOPLE - 1] = r.people || ''; out[COL.MEMO - 1] = r.memo; out[COL.WARN - 1] = r.warn;
  out[COL.INVOICE - 1] = r.hasInvoice ? '有' : '無'; out[COL.TNUM - 1] = r.tnum; out[COL.RATE - 1] = r.rate + '%';
  out[COL.TAXCAT - 1] = r.taxCat; out[COL.JUDGE - 1] = r.judge; out[COL.STATUS - 1] = ST_OPEN;
  out[COL.AUTOACC - 1] = r.autoAccount; out[COL.BASIS - 1] = r.basis; out[COL.FOOD - 1] = r.isFood === true;
  sh.getRange(row, 1, 1, COL_COUNT).setValues([out]);
  return { no: no, ok: true, store: r.store, amount: r.amount, warn: r.warn };
}

function callGemini_(blob, m) {
  var key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) throw new Error('スクリプトプロパティ GEMINI_API_KEY が未設定です');
  var model = String(m.cfg['OCRモデル'] || '').trim();
  var accounts = m.accounts.map(function (a) { return a.name; }).join('、');
  var prompt = 'この領収書・レシートの画像から次の項目を読み取り、JSONだけを返してください。読み取れない項目は null にし、推測で埋めないでください。\n'
    + '- date: 領収書の日付（YYYY-MM-DD）\n'
    + '- store: 店名・発行者名\n'
    + '- amount: 支払った合計金額（税込、数値）\n'
    + '- invoice_number: 適格請求書の登録番号（Tで始まる14文字。印字がなければ null）\n'
    + '- people: 領収書に印字された人数・客数（数値。印字がなければ null）\n'
    + '- tax_rate: 適用税率。10%だけなら "10"、8%だけなら "8"、両方あれば "mixed"\n'
    + '- is_food: 飲食店での飲食の領収書なら true、それ以外は false\n'
    + '- account: 勘定科目の候補。次の中から1つ: ' + accounts + '。飲食の場合は「会議費」か「少額交際費」（酒類が中心の店は少額交際費）';
  var body = {
    contents: [{ parts: [{ inline_data: { mime_type: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) } }, { text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0 }
  };
  var res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
    method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': key }, payload: JSON.stringify(body), muteHttpExceptions: true
  });
  var code = res.getResponseCode(), text = res.getContentText();
  if (code !== 200) throw new Error('Gemini API ' + code + ': ' + text.substring(0, 200));
  var json = JSON.parse(text);
  var parts = (((json.candidates || [])[0] || {}).content || {}).parts || [];
  var out = parts.map(function (p) { return p.text || ''; }).join('');
  var mt = out.match(/\{[\s\S]*\}/);
  if (!mt) throw new Error('読み取り結果を解釈できませんでした');
  return JSON.parse(mt[0]);
}

// ---------- メニュー ----------

// 未処理フォルダに直接入れたファイル（撮影アプリを通さなかったもの）を取り込み、OCR待ちの行もまとめて処理する。
function menuImportFolder() {
  requireUser_();
  var started = Date.now();
  var sh = receiptSheet_(), m = loadMasters_();
  var known = {};
  if (sh.getLastRow() >= DATA_START_ROW) {
    sh.getRange(DATA_START_ROW, COL.FILEID, sh.getLastRow() - 1, 1).getValues().forEach(function (v) { if (v[0]) known[v[0]] = true; });
  }
  var added = 0;
  var it = DriveApp.getFolderById(String(m.cfg['未処理フォルダID'])).getFiles();
  while (it.hasNext()) {
    var f = it.next();
    if (known[f.getId()]) continue;
    if (!/^(image\/|application\/pdf)/.test(f.getMimeType())) continue;
    appendReceiptRow_(f.getId(), f.getUrl(), '');
    added++;
  }
  var res = ocrPending_(started, [ST_WAIT]);
  SpreadsheetApp.getUi().alert('新しく取り込んだファイル: ' + added + '件\nOCRした行: ' + res.done + '件（失敗 ' + res.failed + '件）' + (res.timeout ? '\n\n時間切れのため途中で止めました。もう一度実行してください。' : ''));
}

function ocrPending_(started, statuses) {
  var sh = receiptSheet_();
  var res = { done: 0, failed: 0, timeout: false };
  if (sh.getLastRow() < DATA_START_ROW) return res;
  var vals = sh.getRange(DATA_START_ROW, 1, sh.getLastRow() - 1, COL_COUNT).getValues();
  var history = buildHistory_(sh);
  for (var i = 0; i < vals.length; i++) {
    if (statuses.indexOf(vals[i][COL.STATUS - 1]) < 0 || !vals[i][COL.NO - 1]) continue;
    if (Date.now() - started > 270000) { res.timeout = true; break; }
    var o = ocrByNo_(String(vals[i][COL.NO - 1]), history);
    if (o.ok) res.done++; else res.failed++;
  }
  return res;
}

function menuRetryOcr() {
  requireUser_();
  var started = Date.now(), sh = receiptSheet_(), done = 0, failed = 0;
  var history = buildHistory_(sh);
  var nos = selectedRows_(sh).map(function (row) { return sh.getRange(row, 1, 1, COL_COUNT).getValues()[0]; })
    .filter(function (v) { return v[COL.NO - 1] && v[COL.STATUS - 1] !== ST_DONE && v[COL.FILEID - 1]; })
    .map(function (v) { return String(v[COL.NO - 1]); });
  for (var i = 0; i < nos.length && Date.now() - started < 270000; i++) {
    if (ocrByNo_(nos[i], history).ok) done++; else failed++;
  }
  SpreadsheetApp.getUi().alert('OCRをやり直しました: ' + done + '件（失敗 ' + failed + '件）\n入力済みの計上会社・用途・精算月は残し、読み取り項目と科目を上書きしています。');
}
