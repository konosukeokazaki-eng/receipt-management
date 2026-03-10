"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateSettlementStatus } from "@/actions/receipt-actions";
import { formatCurrency, formatDateJa, formatYearMonth, getCurrentMonth } from "@/lib/utils";
import { CheckCircle, XCircle, ChevronDown, ChevronRight } from "lucide-react";
import type { Company, User, Receipt, AccountItem } from "@/db/schema";

interface ReceiptWithRelations {
  receipt: Receipt;
  company: Company | null;
  accountItem: AccountItem | null;
  claimant: User | null;
}

interface SettlementListProps {
  receipts: ReceiptWithRelations[];
  companies: Company[];
  users: User[];
  currentFilters: {
    month?: string;
    company?: string;
    status?: string;
  };
}

export function SettlementList({
  receipts,
  companies,
  users,
  currentFilters,
}: SettlementListProps) {
  const router = useRouter();
  const [filters, setFilters] = useState({
    month: currentFilters.month || getCurrentMonth(),
    company: currentFilters.company || "",
    status: currentFilters.status || "",
  });
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [isUpdating, setIsUpdating] = useState(false);
  const [settlementDate, setSettlementDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (filters.month) params.set("month", filters.month);
    if (filters.company) params.set("company", filters.company);
    if (filters.status) params.set("status", filters.status);
    router.push(`/settlement?${params.toString()}`);
  };

  // 精算者 × 会社でグルーピング
  const grouped = receipts.reduce<
    Record<
      string,
      {
        userId: string;
        userName: string;
        companyId: string;
        companyName: string;
        bankInfo?: string;
        items: ReceiptWithRelations[];
      }
    >
  >((acc, row) => {
    const userId = row.receipt.claimantUserId;
    const companyId = row.receipt.companyId;
    const key = `${userId}_${companyId}`;

    if (!acc[key]) {
      const user = users.find((u) => u.id === userId);
      const bankInfo = user?.bankName
        ? `${user.bankName} ${user.bankBranch || ""} ${user.accountNumber || ""} ${user.accountHolder || ""}`
        : undefined;

      acc[key] = {
        userId,
        userName: row.claimant?.displayName || userId,
        companyId,
        companyName: row.company?.name || companyId,
        bankInfo,
        items: [],
      };
    }
    acc[key].items.push(row);
    return acc;
  }, {});

  const handleSettle = async (
    ids: string[],
    status: "settled" | "unsettled"
  ) => {
    setIsUpdating(true);
    try {
      await updateSettlementStatus(
        ids,
        status,
        status === "settled" ? settlementDate : undefined
      );
      router.refresh();
    } finally {
      setIsUpdating(false);
    }
  };

  const toggleExpand = (key: string) => {
    setExpandedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* フィルター */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">精算月</label>
            <input
              type="month"
              value={filters.month}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, month: e.target.value }))
              }
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">会社</label>
            <select
              value={filters.company}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, company: e.target.value }))
              }
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
            >
              <option value="">全社</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">ステータス</label>
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, status: e.target.value }))
              }
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
            >
              <option value="">全て</option>
              <option value="unsettled">未精算</option>
              <option value="settled">精算済</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={applyFilters}
              className="w-full py-1.5 px-4 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
            >
              適用
            </button>
          </div>
        </div>
      </div>

      {/* 振込日設定 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-4">
        <label className="text-sm text-blue-800 font-medium whitespace-nowrap">
          振込日:
        </label>
        <input
          type="date"
          value={settlementDate}
          onChange={(e) => setSettlementDate(e.target.value)}
          className="border border-blue-300 rounded px-2 py-1 text-sm bg-white"
        />
        <p className="text-xs text-blue-600">
          「振込済にする」ボタン押下時に記録される日付
        </p>
      </div>

      {/* グループ一覧 */}
      {Object.entries(grouped).length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-400 text-sm">
          対象データがありません
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([key, group]) => {
            const isExpanded = expandedUsers.has(key);
            const totalAmount = group.items.reduce(
              (sum, r) => sum + r.receipt.amount,
              0
            );
            const allSettled = group.items.every(
              (r) => r.receipt.settlementStatus === "settled"
            );
            const unsettledItems = group.items.filter(
              (r) => r.receipt.settlementStatus === "unsettled"
            );

            return (
              <div
                key={key}
                className="bg-white rounded-xl shadow-sm border border-gray-100"
              >
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleExpand(key)}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                    <div>
                      <div className="font-medium text-gray-900">
                        {group.userName}
                        <span className="ml-2 text-sm text-gray-500">
                          {group.companyName}
                        </span>
                      </div>
                      {group.bankInfo && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          {group.bankInfo}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-bold text-lg text-gray-900">
                        {formatCurrency(totalAmount)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {group.items.length}件
                      </div>
                    </div>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      {!allSettled && unsettledItems.length > 0 && (
                        <button
                          onClick={() =>
                            handleSettle(
                              unsettledItems.map((r) => r.receipt.id),
                              "settled"
                            )
                          }
                          disabled={isUpdating}
                          className="flex items-center gap-1.5 py-1.5 px-3 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          振込済にする
                        </button>
                      )}
                      {allSettled && (
                        <button
                          onClick={() =>
                            handleSettle(
                              group.items.map((r) => r.receipt.id),
                              "unsettled"
                            )
                          }
                          disabled={isUpdating}
                          className="flex items-center gap-1.5 py-1.5 px-3 border border-gray-300 text-gray-600 rounded-lg text-xs hover:bg-gray-50 disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          未振込に戻す
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-50">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-gray-500">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium">日付</th>
                          <th className="px-4 py-2 text-left font-medium">店名</th>
                          <th className="px-4 py-2 text-left font-medium">勘定科目</th>
                          <th className="px-4 py-2 text-right font-medium">金額</th>
                          <th className="px-4 py-2 text-center font-medium">ステータス</th>
                          <th className="px-4 py-2 text-center font-medium">振込日</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {group.items.map(({ receipt, accountItem }) => (
                          <tr key={receipt.id}>
                            <td className="px-4 py-2 text-gray-600">
                              {formatDateJa(receipt.receiptDate)}
                            </td>
                            <td className="px-4 py-2 text-gray-700">
                              {receipt.storeName || "-"}
                            </td>
                            <td className="px-4 py-2 text-gray-600">
                              {accountItem?.name || "-"}
                            </td>
                            <td className="px-4 py-2 text-right font-medium text-gray-900">
                              {formatCurrency(receipt.amount)}
                            </td>
                            <td className="px-4 py-2 text-center">
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  receipt.settlementStatus === "settled"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-orange-100 text-orange-700"
                                }`}
                              >
                                {receipt.settlementStatus === "settled"
                                  ? "精算済"
                                  : "未精算"}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-center text-gray-500">
                              {formatDateJa(receipt.settlementDate)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
