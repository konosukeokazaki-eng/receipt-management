import { auth } from "@/lib/auth";
import { getMonthlyTotal } from "@/actions/receipt-actions";
import { getBudgetVsActual, getAccountItemBreakdown } from "@/actions/budget-actions";
import { db, receipts } from "@/db";
import { eq, and } from "drizzle-orm";
import { getCurrentMonth, formatCurrency, formatYearMonth } from "@/lib/utils";
import { getFiscalYear } from "@/lib/receipt-no";
import { DashboardCharts } from "@/components/dashboard-charts";

export default async function DashboardPage() {
  const session = await auth();
  const currentMonth = getCurrentMonth();
  // 3月決算ベースで現在の会計年度を算出（ダッシュボード表示用）
  const currentFiscalYear = getFiscalYear(currentMonth, 3);

  // 今月の経費合計（会社別）
  const monthlyTotals = await getMonthlyTotal(currentMonth);

  // 予算消化状況（当会計年度）
  const budgetVsActual = await getBudgetVsActual(currentFiscalYear);

  // 未精算件数
  const unsettledCount = await db
    .select({ count: receipts.id })
    .from(receipts)
    .where(
      and(
        eq(receipts.settlementMonth, currentMonth),
        eq(receipts.settlementStatus, "unsettled")
      )
    );

  // 勘定科目別内訳
  const breakdown = await getAccountItemBreakdown(currentMonth);

  const totalAmount = monthlyTotals.reduce(
    (sum, t) => sum + (Number(t.total) || 0),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
        <div className="text-sm text-gray-500">{formatYearMonth(currentMonth)}</div>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="text-sm text-gray-500 mb-1">今月の経費合計</div>
          <div className="text-3xl font-bold text-gray-900">
            {formatCurrency(totalAmount)}
          </div>
          <div className="text-xs text-gray-400 mt-1">全社合計</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="text-sm text-gray-500 mb-1">未精算件数</div>
          <div className="text-3xl font-bold text-orange-600">
            {unsettledCount.length}
            <span className="text-lg font-normal text-gray-500 ml-1">件</span>
          </div>
          <div className="text-xs text-gray-400 mt-1">今月分</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="text-sm text-gray-500 mb-2">会社別合計</div>
          {monthlyTotals.length > 0 ? (
            <div className="space-y-1">
              {monthlyTotals.map((t) => (
                <div key={t.companyId} className="flex justify-between text-sm">
                  <span className="text-gray-600">{t.companyName}</span>
                  <span className="font-medium">
                    {formatCurrency(Number(t.total) || 0)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-400">今月の登録データなし</div>
          )}
        </div>
      </div>

      {/* グラフ（Client Component） */}
      <DashboardCharts
        breakdown={breakdown.map((b) => ({
          name: b.accountName || "不明",
          value: Number(b.total) || 0,
        }))}
        budgetVsActual={budgetVsActual.map((b) => ({
          name: b.account_name,
          budget: Number(b.budget),
          actual: Number(b.actual),
          pct: Number(b.pct),
        }))}
      />
    </div>
  );
}
