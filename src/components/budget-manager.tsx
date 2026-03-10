"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { upsertBudget } from "@/actions/budget-actions";
import { formatCurrency, formatYearMonth } from "@/lib/utils";
import { Save } from "lucide-react";
import type { Company, AccountItem } from "@/db/schema";

interface BudgetRow {
  company_id: string;
  company_name: string;
  account_item_id: string;
  account_name: string;
  budget: number;
  actual: number;
  pct: number;
}

interface BudgetManagerProps {
  companies: Company[];
  accountItems: AccountItem[];
  budgetVsActual: BudgetRow[];
  currentMonth: string;
  currentCompanyId?: string;
}

export function BudgetManager({
  companies,
  accountItems,
  budgetVsActual,
  currentMonth,
  currentCompanyId,
}: BudgetManagerProps) {
  const router = useRouter();
  const [month, setMonth] = useState(currentMonth);
  const [companyId, setCompanyId] = useState(currentCompanyId || "");
  const [editingBudgets, setEditingBudgets] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const applyFilters = () => {
    const params = new URLSearchParams();
    params.set("month", month);
    if (companyId) params.set("company", companyId);
    router.push(`/budgets?${params.toString()}`);
  };

  const getBudgetKey = (companyId: string, accountItemId: string) =>
    `${companyId}_${accountItemId}`;

  const handleBudgetChange = (
    companyId: string,
    accountItemId: string,
    value: string
  ) => {
    const key = getBudgetKey(companyId, accountItemId);
    setEditingBudgets((prev) => ({ ...prev, [key]: value }));
  };

  const saveAllBudgets = async () => {
    if (Object.keys(editingBudgets).length === 0) return;

    setIsSaving(true);
    try {
      for (const [key, value] of Object.entries(editingBudgets)) {
        const [cId, aId] = key.split("_");
        const amount = parseInt(value) || 0;
        await upsertBudget({
          companyId: cId,
          accountItemId: aId,
          yearMonth: month,
          amount,
        });
      }
      setEditingBudgets({});
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  };

  // グループ化（会社別）
  const grouped = budgetVsActual.reduce<Record<string, BudgetRow[]>>(
    (acc, row) => {
      if (!acc[row.company_id]) acc[row.company_id] = [];
      acc[row.company_id].push(row);
      return acc;
    },
    {}
  );

  // 予算未設定の科目を追加
  const displayCompanies = companyId
    ? companies.filter((c) => c.id === companyId)
    : companies;

  return (
    <div className="space-y-4">
      {/* フィルター */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">対象月</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="border border-gray-200 rounded px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">会社</label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="border border-gray-200 rounded px-2 py-1.5 text-sm"
            >
              <option value="">全社</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={applyFilters}
            className="py-1.5 px-4 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
          >
            表示
          </button>
        </div>
      </div>

      {Object.keys(editingBudgets).length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={saveAllBudgets}
            disabled={isSaving}
            className="flex items-center gap-2 py-2 px-4 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? "保存中..." : "変更を保存"}
          </button>
        </div>
      )}

      {/* 予算表 */}
      {displayCompanies.map((company) => {
        const rows = grouped[company.id] || [];
        const existingAccountIds = new Set(rows.map((r) => r.account_item_id));

        // 全勘定科目について行を生成
        const allRows = [
          ...rows,
          ...accountItems
            .filter((a) => !existingAccountIds.has(a.id))
            .map((a) => ({
              company_id: company.id,
              company_name: company.name,
              account_item_id: a.id,
              account_name: a.name,
              budget: 0,
              actual: 0,
              pct: 0,
            })),
        ].sort((a, b) => a.account_name.localeCompare(b.account_name));

        const totalBudget = allRows.reduce((s, r) => s + r.budget, 0);
        const totalActual = allRows.reduce((s, r) => s + r.actual, 0);

        return (
          <div
            key={company.id}
            className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
          >
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">
                {company.name}
                <span className="ml-3 text-sm font-normal text-gray-500">
                  {formatYearMonth(month)}
                </span>
              </h2>
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">勘定科目</th>
                  <th className="px-4 py-2 text-right font-medium">予算額</th>
                  <th className="px-4 py-2 text-right font-medium">実績</th>
                  <th className="px-4 py-2 text-right font-medium">消化率</th>
                  <th className="px-4 py-2 w-48">進捗</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {allRows.map((row) => {
                  const key = getBudgetKey(row.company_id, row.account_item_id);
                  const editingValue = editingBudgets[key];
                  const displayBudget =
                    editingValue !== undefined
                      ? parseInt(editingValue) || 0
                      : row.budget;
                  const pct =
                    displayBudget > 0
                      ? Math.round((row.actual / displayBudget) * 1000) / 10
                      : 0;

                  return (
                    <tr key={row.account_item_id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-700">
                        {row.account_name}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <input
                          type="number"
                          value={editingValue !== undefined ? editingValue : row.budget || ""}
                          onChange={(e) =>
                            handleBudgetChange(
                              row.company_id,
                              row.account_item_id,
                              e.target.value
                            )
                          }
                          placeholder="0"
                          min="0"
                          className="w-32 border border-gray-200 rounded px-2 py-1 text-sm text-right"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                        {formatCurrency(row.actual)}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-medium ${
                          pct > 100
                            ? "text-red-600"
                            : pct > 80
                            ? "text-orange-500"
                            : "text-green-600"
                        }`}
                      >
                        {displayBudget > 0 ? `${pct}%` : "-"}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              pct > 100
                                ? "bg-red-500"
                                : pct > 80
                                ? "bg-orange-400"
                                : "bg-blue-500"
                            }`}
                            style={{
                              width: `${Math.min(pct, 100)}%`,
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50 text-sm font-semibold">
                <tr>
                  <td className="px-4 py-2.5 text-gray-700">合計</td>
                  <td className="px-4 py-2.5 text-right text-gray-900">
                    {formatCurrency(totalBudget)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-900">
                    {formatCurrency(totalActual)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-500">
                    {totalBudget > 0
                      ? `${Math.round((totalActual / totalBudget) * 1000) / 10}%`
                      : "-"}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        );
      })}
    </div>
  );
}
