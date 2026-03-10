/**
 * クラス名を結合するユーティリティ
 */
export function cn(...inputs: (string | boolean | null | undefined)[]): string {
  return inputs.filter(Boolean).join(" ");
}

/**
 * 金額を日本円フォーマットに変換
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
  }).format(amount);
}

/**
 * 日付文字列を日本語フォーマットに変換
 */
export function formatDateJa(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return dateStr;
  }
}

/**
 * 今月の YYYY-MM を返す
 */
export function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * YYYY-MM を日本語表示に変換
 */
export function formatYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  return `${year}年${parseInt(month)}月`;
}

/**
 * 予算消化率を計算
 */
export function calcBudgetRate(actual: number, budget: number): number {
  if (budget === 0) return 0;
  return Math.round((actual / budget) * 1000) / 10;
}
