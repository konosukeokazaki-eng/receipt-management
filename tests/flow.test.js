// GASのサービスを簡易な模擬に置き換えて、取り込み→入力→確定→CSVの流れを通す。
const assert = require('assert'), fs = require('fs'), vm = require('vm'), path = require('path');

function makeSheet(name) {
  const d = [];
  const cell = (r, c) => (d[r - 1] && d[r - 1][c - 1] !== undefined ? d[r - 1][c - 1] : '');
  const set = (r, c, v) => { while (d.length < r) d.push([]); d[r - 1][c - 1] = v; };
  const fmt = () => rangeApi;
  let rangeApi;
  const sh = {
    _d: d, getName: () => name,
    getLastRow: () => { for (let i = d.length; i > 0; i--) if ((d[i - 1] || []).some(v => v !== '' && v !== undefined && v !== false)) return i; return 0; },
    getLastColumn: () => d.reduce((m, r) => Math.max(m, r.length), 0),
    getMaxRows: () => 1000,
    appendRow: (row) => { const r = sh.getLastRow() + 1; row.forEach((v, i) => set(r, i + 1, v)); },
    getRange: (r, c, nr, nc) => {
      if (typeof r === 'string') r = 2, c = 1;
      nr = nr || 1; nc = nc || 1;
      const api = {
        getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => cell(r + i, c + j))),
        getValue: () => cell(r, c),
        setValues: (v) => { assert.strictEqual(v.length, nr, 'row count'); v.forEach((row, i) => { assert.strictEqual(row.length, nc, 'col count'); row.forEach((x, j) => set(r + i, c + j, x)); }); return api; },
        setValue: (v) => { set(r, c, v); return api; },
        getRow: () => r, getLastRow: () => r + nr - 1, getColumn: () => c, getLastColumn: () => c + nc - 1, getSheet: () => sh,
      };
      ['setNumberFormat', 'setFontWeight', 'setBackground', 'setFontColor', 'setDataValidation', 'insertCheckboxes'].forEach(k => api[k] = () => api);
      return api;
    },
  };
  ['setFrozenRows', 'setFrozenColumns', 'setConditionalFormatRules', 'setColumnWidth', 'hideColumns'].forEach(k => sh[k] = () => sh);
  return sh;
}
const sheets = {};
const ss = { getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = makeSheet(n)), getSheets: () => Object.values(sheets), deleteSheet: s => delete sheets[s.getName()], getUrl: () => 'https://sheet' };
const chain = () => new Proxy(function () {}, { get: (_, k) => (k === 'build' ? () => ({}) : chain()), apply: () => chain() });

const files = {}, folders = {};
function makeFolder(id, name) {
  const f = { id, name, children: {}, getId: () => id, getName: () => name,
    getFoldersByName: (n) => { const hit = Object.values(f.children).filter(x => x.name === n); let i = 0; return { hasNext: () => i < hit.length, next: () => hit[i++] }; },
    createFolder: (n) => { const c = makeFolder('fld_' + Object.keys(folders).length, n); f.children[c.id] = c; return c; },
    createFile: (blob) => makeFile('file_' + Object.keys(files).length, blob.name, f),
    getFiles: () => { const l = Object.values(files).filter(x => x.parent === f); let i = 0; return { hasNext: () => i < l.length, next: () => l[i++] }; } };
  folders[id] = f; return f;
}
function makeFile(id, name, parent) {
  const f = { id, name, parent, getId: () => id, getName: () => f.name, setName: (n) => { f.name = n; return f; }, moveTo: (p) => { f.parent = p; return f; },
    getUrl: () => 'https://file/' + id, getMimeType: () => 'image/jpeg', getBlob: () => ({ getContentType: () => 'image/jpeg', getBytes: () => [1, 2, 3] }) };
  files[id] = f; return f;
}
makeFolder('13AIMe4Fe2vRVXlMYD3jbTq0B2Di09wtI', '未処理');
const tora = makeFolder('1lPfRrCYVST1vZMppSmE652WKLjxgRvCD', '虎石克'), kondo = makeFolder('1MH6MfemruvA_px2XNLaZ7exB6bAFaVYt', '近藤光');
const toraCmind = tora.createFolder('C-mind');

let ocrQueue = [], alerts = [];
const ctx = {
  console, JSON, Math, Date, String, Number, Object, Array, parseInt, isFinite, isNaN, encodeURIComponent, RegExp, Error,
  SpreadsheetApp: { getActiveSpreadsheet: () => ss, getUi: () => ({ alert: (m) => alerts.push(m), createMenu: chain }), flush: () => {}, newDataValidation: chain, newConditionalFormatRule: chain, getActiveSheet: () => sheets['領収書管理'] },
  DriveApp: { getFolderById: (id) => { if (!folders[id]) throw new Error('no folder ' + id); return folders[id]; }, getFileById: (id) => { if (!files[id]) throw new Error('no file ' + id); return files[id]; } },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }), getDocumentLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k === 'GEMINI_API_KEY' ? 'key' : null) }) },
  Session: { getActiveUser: () => ({ getEmail: () => 'a@cmind-co.jp' }) },
  Logger: { log: () => {} },
  Utilities: {
    base64Decode: (s) => Buffer.from(s, 'base64'), base64Encode: (b) => Buffer.from(b).toString('base64'), formatDate: () => '20261006_000000_000',
    newBlob: (data, mime, name) => { const b = { name, data: data || '', setDataFromString: (s) => { b.data = s; return b; }, getBytes: () => Buffer.from(b.data) }; return b; },
    zip: (blobs, name) => ({ name, blobs, getBytes: () => Buffer.from(blobs.map(b => b.name).join('|')) }),
  },
  UrlFetchApp: { fetch: (url) => { ctx._lastUrl = url; const o = ocrQueue.shift(); return { getResponseCode: () => (o ? 200 : 500), getContentText: () => (o ? JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(o) }] } }] }) : 'err') }; } },
  HtmlService: {}, ScriptApp: { getService: () => ({ getUrl: () => 'https://app' }) },
};
vm.createContext(ctx);
['Logic.js', 'Main.js', 'Auth.js', 'Master.js', 'Schema.js', 'Receipts.js', 'Capture.js', 'Admin.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f }));
const run = (code) => vm.runInContext(code, ctx);
const C = run('COL'), rs = () => sheets['領収書管理'];
const get = (row, k) => rs()._d[row - 1][C[k] - 1];
const edit = (row, k, v) => { rs().getRange(row, C[k]).setValue(v); run('MASTERS_CACHE_ = null'); ctx.onEdit({ range: rs().getRange(row, C[k]) }); };

run('setupSheets_()');
assert.deepStrictEqual(rs()._d[0].length, 26);
// 会社マスタ: C-mindは4月始まり・第12期が2026年開始、LEADは期首月なし
sheets['会社マスタ']._d[2][2] = 4; sheets['会社マスタ']._d[2][3] = 12; sheets['会社マスタ']._d[2][4] = 2026;
assert.strictEqual(sheets['会社マスタ']._d[2][0], 'C-mind');
const lead = sheets['会社マスタ']._d.find(r => r[0] === 'LEAD'); lead[2] = lead[3] = lead[4] = '';
assert.strictEqual(sheets['利用者マスタ']._d[2][2], '1MH6MfemruvA_px2XNLaZ7exB6bAFaVYt');
sheets['利用者マスタ']._d[1][1] = '代表'; sheets['設定']._d.find(r => r[0] === '開始No')[1] = 657;
run('MASTERS_CACHE_ = null');

// 1) 飲食・インボイス有・人数なし・11,000円 → 判定額10,000円 → 会議費（AIの推定）
ocrQueue.push({ date: '2026-10-05', store: '喫茶アオイ', amount: 11000, invoice_number: 'T1234567890123', people: null, tax_rate: '10', is_food: true, account: '会議費' });
let up = ctx.api_upload({ data: Buffer.from('x').toString('base64'), mime: 'image/jpeg', user: '虎石' });
assert.strictEqual(up.no, '0657');
assert.strictEqual(get(2, 'STATUS'), 'OCR待ち');
let o = ctx.api_ocr('0657');
assert.ok(o.ok && ctx._lastUrl.includes('gemini-3.6-flash'));
assert.strictEqual(get(2, 'ACCOUNT'), '会議費'); assert.strictEqual(get(2, 'JUDGE'), 10000); assert.strictEqual(get(2, 'INVOICE'), '有');
assert.strictEqual(get(2, 'TAXCAT'), '課税対応仕入10%'); assert.strictEqual(get(2, 'BASIS'), 'AI'); assert.strictEqual(get(2, 'FOOD'), true);
assert.strictEqual(get(2, 'WARN'), '計上会社未入力、用途未入力、精算月未入力、人数未記録');
assert.strictEqual(files['file_0'].name, '0657_未処理.jpg');

// 2) 居酒屋・インボイス無・10月・33,000円・人数なし → 交際費（仮）、人数3で少額交際費、人数2で交際費
ocrQueue.push({ date: '2026-10-02', store: '居酒屋とり吉', amount: 33000, invoice_number: null, people: null, tax_rate: 'mixed', is_food: true, account: '少額交際費' });
up = ctx.api_upload({ data: 'eA==', user: '近藤' }); ctx.api_ocr(up.no);
assert.strictEqual(up.no, '0658'); assert.strictEqual(get(3, 'BASIS'), 'ルール');
assert.strictEqual(get(3, 'ACCOUNT'), '交際費'); assert.strictEqual(get(3, 'JUDGE'), 30900); assert.strictEqual(get(3, 'TAXCAT'), '課対仕入内10%区分70%');
assert.strictEqual(get(3, 'MEMO'), '8%と10%が混在');
edit(3, 'PEOPLE', 4); assert.strictEqual(get(3, 'ACCOUNT'), '少額交際費');   // 7,725円/人
edit(3, 'PEOPLE', 3); assert.strictEqual(get(3, 'ACCOUNT'), '交際費');       // 10,300円/人
edit(3, 'PEOPLE', 4);
// 人が科目を直したら、その後の再計算で上書きしない
edit(3, 'ACCOUNT', '福利厚生費'); edit(3, 'PEOPLE', 5); assert.strictEqual(get(3, 'ACCOUNT'), '福利厚生費');
edit(3, 'ACCOUNT', '少額交際費');

// 3) タクシー（ルール）、租税公課は対象外
ocrQueue.push({ date: '2026-09-30', store: '日本交通タクシー', amount: 2200, invoice_number: null, people: null, tax_rate: '10', is_food: false, account: '消耗品費' });
up = ctx.api_upload({ data: 'eA==', user: '虎石' }); ctx.api_ocr(up.no);
assert.strictEqual(get(4, 'ACCOUNT'), '旅費交通費'); assert.strictEqual(get(4, 'TAXCAT'), '課対仕入内10%区分80%'); assert.strictEqual(get(4, 'WARN').includes('人数'), false);
// 4) OCR失敗
up = ctx.api_upload({ data: 'eA==', user: '虎石' }); o = ctx.api_ocr(up.no);
assert.strictEqual(o.ok, false); assert.strictEqual(get(5, 'STATUS'), 'OCR失敗');

// 入力して確定。精算月は 2026-10 と入れても 2026/10 に揃う
edit(2, 'COMPANY', 'C-mind'); edit(2, 'PURPOSE', 'A社 山田様'); edit(2, 'MONTH', '2026-10');
assert.strictEqual(get(2, 'MONTH'), '2026/10'); assert.strictEqual(get(2, 'WARN'), '人数未記録');
edit(3, 'COMPANY', 'LEAD'); edit(3, 'PURPOSE', 'B社'); edit(3, 'MONTH', '2026/10');
edit(4, 'COMPANY', 'C-mind'); edit(4, 'PURPOSE', '移動');   // 精算月なし → 確定できない
[2, 3, 4, 5].forEach(r => rs().getRange(r, C.CHECK).setValue(true));
run('MASTERS_CACHE_ = null');
let res = run('confirmChecked_()');
assert.strictEqual(res.done, 2); assert.strictEqual(res.blocked.length, 2); assert.deepStrictEqual(Array.from(res.noPeriod), ['LEAD']);
assert.strictEqual(get(2, 'STATUS'), '確定'); assert.strictEqual(get(4, 'STATUS'), '未確定'); assert.strictEqual(get(2, 'PURPOSE'), 'A社 山田様');
assert.strictEqual(files['file_0'].name, '0657_20261005_喫茶アオイ_11000.jpg');
assert.strictEqual(files['file_0'].parent.name, '第12期'); assert.ok(Object.values(toraCmind.children).includes(files['file_0'].parent));
assert.strictEqual(files['file_1'].parent.name, 'LEAD'); assert.ok(Object.values(kondo.children).includes(files['file_1'].parent));   // 近藤のフォルダに会社フォルダを作成
assert.strictEqual(files['file_2'].name, '0659_未処理.jpg');
// 学習: 店名が科目ルールに記録され、次の同じ店は「履歴」で会議費、計上会社も初期値に入る
const learned = sheets['科目ルール']._d.filter(r => r[4] === '学習');
assert.deepStrictEqual(learned.map(r => [r[0], r[1], r[2], r[3]]), [['喫茶アオイ', '', true, '会議費'], ['居酒屋とり吉', '', true, '少額交際費']]);
ocrQueue.push({ date: '2026-10-06', store: '喫茶アオイ', amount: 1500, invoice_number: 'T1234567890123', people: 2, tax_rate: '10', is_food: false, account: '消耗品費' });
up = ctx.api_upload({ data: 'eA==', user: '虎石' }); ctx.api_ocr(up.no);
assert.strictEqual(get(6, 'ACCOUNT'), '会議費'); assert.strictEqual(get(6, 'BASIS'), '履歴'); assert.strictEqual(get(6, 'COMPANY'), 'C-mind'); assert.strictEqual(get(6, 'PURPOSE'), '');
// 飲食以外に直して確定 → 学習が飲食以外に変わる
edit(4, 'MONTH', '2026/10'); edit(4, 'ACCOUNT', '車両費'); run('MASTERS_CACHE_ = null');
res = run('confirmChecked_()'); assert.strictEqual(res.done, 1);
assert.strictEqual(files['file_2'].parent.name, '第12期');   // 2026/09/30 は4月始まりの同じ期
assert.deepStrictEqual(sheets['科目ルール']._d.filter(r => r[0] === '日本交通タクシー').map(r => [r[1], r[2], r[4]]), [['車両費', false, '学習']]);

// CSV: 確定済みだけ、会社別
run('MASTERS_CACHE_ = null');
const csv = ctx.api_exportCsv('2026/10');
assert.strictEqual(csv.skipped, 0); assert.strictEqual(csv.name, '領収書CSV_202610.zip');
assert.deepStrictEqual(JSON.parse(JSON.stringify(csv.summary)), [{ company: 'C-mind', count: 2, total: 13200 }, { company: 'LEAD', count: 1, total: 33000 }]);
const z = Buffer.from(csv.data, 'base64').toString(); assert.strictEqual(z, 'C-mind_202610.csv|LEAD_202610.csv');
assert.strictEqual(ctx.api_exportCsv('2026/11').empty, true);
// 管理アプリ用データ
const data = ctx.api_getData();
assert.strictEqual(data.rows.length, 5); assert.deepStrictEqual(JSON.parse(JSON.stringify(data.rows[0])).slice(0, 8), ['0657', '2026/10/05', '2026/10', 'C-mind', '虎石', '会議費', 11000, '確定']);
// 未処理フォルダに直接入れたファイルの取り込み
makeFile('direct1', 'scan.jpg', folders['13AIMe4Fe2vRVXlMYD3jbTq0B2Di09wtI']);
ocrQueue.push({ date: '2026-10-01', store: '文具店', amount: 550, invoice_number: null, people: null, tax_rate: '10', is_food: false, account: '消耗品費' });
ctx.menuImportFolder();
assert.strictEqual(get(7, 'NO'), '0662'); assert.strictEqual(get(7, 'ACCOUNT'), '消耗品費'); assert.ok(alerts.pop().includes('新しく取り込んだファイル: 1件'));
console.log('flow tests passed');
