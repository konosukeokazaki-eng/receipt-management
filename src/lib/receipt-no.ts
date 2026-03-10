import { db, receiptSequences, companies } from "@/db";
import { eq, and } from "drizzle-orm";

/**
 * 領収書Noを採番する
 * 形式: {会社コード}-{会計年度}-{4桁連番}
 * 例: A-2025-0001
 */
export async function generateReceiptNo(
  companyId: string,
  settlementMonth: string // YYYY-MM
): Promise<string> {
  // 会社情報を取得
  const companyResult = await db
    .select({
      code: companies.code,
      fiscalYearEndMonth: companies.fiscalYearEndMonth,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (companyResult.length === 0) {
    throw new Error(`会社が見つかりません: ${companyId}`);
  }

  const company = companyResult[0];
  const fiscalYear = getFiscalYear(settlementMonth, company.fiscalYearEndMonth);

  // シーケンスをアトミックにインクリメント（PostgreSQLのUPDATE RETURNING を活用）
  const existing = await db
    .select()
    .from(receiptSequences)
    .where(
      and(
        eq(receiptSequences.companyId, companyId),
        eq(receiptSequences.fiscalYear, fiscalYear)
      )
    )
    .limit(1);

  let nextNumber: number;

  if (existing.length === 0) {
    // 初回: レコードを作成
    await db.insert(receiptSequences).values({
      companyId,
      fiscalYear,
      lastNumber: 1,
    });
    nextNumber = 1;
  } else {
    // インクリメント
    const updated = await db
      .update(receiptSequences)
      .set({ lastNumber: existing[0].lastNumber + 1 })
      .where(eq(receiptSequences.id, existing[0].id))
      .returning({ lastNumber: receiptSequences.lastNumber });
    nextNumber = updated[0].lastNumber;
  }

  const paddedNumber = String(nextNumber).padStart(4, "0");
  return `${company.code}-${fiscalYear}-${paddedNumber}`;
}

/**
 * 精算月と決算月から会計年度を計算する
 * 例: 決算月=3月の場合、2025年4月〜2026年3月 → 会計年度2025
 */
export function getFiscalYear(
  settlementMonth: string, // YYYY-MM
  fiscalYearEndMonth: number
): number {
  const [yearStr, monthStr] = settlementMonth.split("-");
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);

  // 決算月が12月の場合は暦年と同じ
  if (fiscalYearEndMonth === 12) {
    return year;
  }

  // 決算月の翌月が期首
  const fiscalStartMonth = fiscalYearEndMonth + 1 > 12
    ? 1
    : fiscalYearEndMonth + 1;

  if (month >= fiscalStartMonth) {
    return year;
  } else {
    return year - 1;
  }
}

/**
 * ファイル名に使用できない文字を除去・置換する
 */
export function sanitizeFileName(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, "_").trim();
}

/**
 * 領収書ファイル名を生成する
 * 形式: {領収書No}_{精算月YYYYMM}_{会社コード}_{店名}_{金額}円.jpg
 */
export function generateReceiptFileName(
  receiptNo: string,
  settlementMonth: string, // YYYY-MM
  companyCode: string,
  storeName: string,
  amount: number,
  extension: string = "jpg"
): string {
  const monthForFile = settlementMonth.replace("-", "");
  const safeName = sanitizeFileName(storeName || "不明");
  return `${receiptNo}_${monthForFile}_${companyCode}_${safeName}_${amount}円.${extension}`;
}
