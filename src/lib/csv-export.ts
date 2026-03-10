import { format } from "date-fns";
import { ja } from "date-fns/locale";

export interface ReceiptForCsv {
  receiptNo: string | null;
  settlementMonth: string;
  receiptDate: string | null;
  storeName: string | null;
  purpose: string | null;
  amount: number;
  hasInvoice: boolean;
  accountItemName: string;
  yayoiAccountName: string | null;
  taxCategory: string;
  companyName: string;
  claimantName: string;
  settlementStatus: string;
  settlementDate: string | null;
  fileName: string | null;
}

/**
 * 日付文字列を YYYY/MM/DD 形式に変換
 */
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    return format(date, "yyyy/MM/dd");
  } catch {
    return dateStr;
  }
}

/**
 * 曜日を取得
 */
function getDayOfWeek(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    return format(date, "E", { locale: ja });
  } catch {
    return "";
  }
}

/**
 * インボイス有無と税区分から弥生会計の税区分を取得
 */
function getYayoiTaxCategory(hasInvoice: boolean, taxCategory: string): string {
  if (taxCategory === "exempt") return "";

  // 2026年10月以降は80%→50%に変わる（経過措置）
  // ここでは簡略化して固定値を使用
  if (hasInvoice) {
    return "課税仕入10%";
  } else {
    // インボイスなし（経過措置）
    // 2026年9月まで: 80%控除
    return "課税仕入10%(80%)";
  }
}

/**
 * CSV行をエスケープ
 */
function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  if (str.includes('"') || str.includes(",") || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * 弥生会計インポート形式のCSVを生成
 */
export function generateYayoiCsv(receipts: ReceiptForCsv[]): string {
  const header = [
    "識別フラグ",
    "伝票No",
    "決算",
    "取引日",
    "借方勘定科目",
    "借方補助科目",
    "借方部門",
    "借方税区分",
    "借方金額",
    "借方税額",
    "貸方勘定科目",
    "貸方補助科目",
    "貸方部門",
    "貸方税区分",
    "貸方金額",
    "貸方税額",
    "摘要",
    "番号",
    "期日",
    "タイプ",
    "生成元",
    "仕訳メモ",
    "付箋1",
    "付箋2",
    "EX-VBFフラグ",
  ];

  const rows = receipts.map((r) => {
    const accountName = r.yayoiAccountName || r.accountItemName;
    const taxCategory = getYayoiTaxCategory(r.hasInvoice, r.taxCategory);
    const amount = r.amount;
    const description = [r.storeName, r.purpose].filter(Boolean).join(" ");

    return [
      "2", // 識別フラグ
      r.receiptNo || "",
      "", // 決算
      formatDate(r.receiptDate), // 取引日
      accountName, // 借方勘定科目
      "", // 借方補助科目
      "", // 借方部門
      taxCategory, // 借方税区分
      amount, // 借方金額
      "", // 借方税額（弥生が自動計算）
      r.settlementStatus === "settled" ? "普通預金" : "未払金", // 貸方勘定科目
      "", // 貸方補助科目
      "", // 貸方部門
      "", // 貸方税区分
      amount, // 貸方金額
      "", // 貸方税額
      description, // 摘要
      "", // 番号
      "", // 期日
      "", // タイプ
      "", // 生成元
      "", // 仕訳メモ
      "", // 付箋1
      "", // 付箋2
      "", // EX-VBFフラグ
    ].map(escapeCsv).join(",");
  });

  const lines = [header.map(escapeCsv).join(","), ...rows];
  // UTF-8 BOM付き
  return "\uFEFF" + lines.join("\r\n");
}

/**
 * 汎用CSVを生成
 */
export function generateGeneralCsv(receipts: ReceiptForCsv[]): string {
  const header = [
    "領収書No",
    "精算月",
    "領収書日付",
    "曜日",
    "勘定科目",
    "店名",
    "他社様名/用途",
    "金額",
    "インボイス有無",
    "税区分",
    "計上会社",
    "経費精算者",
    "振込ステータス",
    "振込日",
    "ファイル名",
  ];

  const rows = receipts.map((r) => {
    return [
      r.receiptNo || "",
      r.settlementMonth,
      formatDate(r.receiptDate),
      getDayOfWeek(r.receiptDate),
      r.accountItemName,
      r.storeName || "",
      r.purpose || "",
      r.amount,
      r.hasInvoice ? "有" : "無",
      r.taxCategory === "taxable" ? "課税" : "対象外",
      r.companyName,
      r.claimantName,
      r.settlementStatus === "settled" ? "精算済" : "未精算",
      formatDate(r.settlementDate),
      r.fileName || "",
    ].map(escapeCsv).join(",");
  });

  const lines = [header.map(escapeCsv).join(","), ...rows];
  // UTF-8 BOM付き
  return "\uFEFF" + lines.join("\r\n");
}
