"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteReceipt, assignCompanyToReceipt } from "@/actions/receipt-actions";
import {
  formatCurrency,
  formatDateJa,
  formatYearMonth,
} from "@/lib/utils";
import { Trash2, ExternalLink, Filter, ChevronDown, Loader2 } from "lucide-react";
import type { Company, AccountItem, User, Receipt } from "@/db/schema";

interface ReceiptWithRelations {
  receipt: Receipt;
  company: Company | null;
  accountItem: AccountItem | null;
  claimant: User | null;
}

interface ReceiptListProps {
  receipts: ReceiptWithRelations[];
  companies: Company[];
  accountItems: AccountItem[];
  users: User[];
  currentFilters: {
    month?: string;
    company?: string;
    account?: string;
    user?: string;
    status?: string;
  };
}

export function ReceiptList({
  receipts,
  companies,
  accountItems,
  users,
  currentFilters,
}: ReceiptListProps) {
  const router = useRouter();
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(currentFilters);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (filters.month) params.set("month", filters.month);
    if (filters.company) params.set("company", filters.company);
    if (filters.account) params.set("account", filters.account);
    if (filters.user) params.set("user", filters.user);
    if (filters.status) params.set("status", filters.status);
    router.push(`/receipts?${params.toString()}`);
  };

  const clearFilters = () => {
    setFilters({});
    router.push("/receipts");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("この領収書を削除してもよいですか？")) return;
    setDeletingId(id);
    try {
      await deleteReceipt(id);
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  };

  const handleCompanyChange = async (receiptId: string, companyId: string) => {
    if (!companyId) return;
    setAssigningId(receiptId);
    try {
      await assignCompanyToReceipt(receiptId, companyId);
      router.refresh();
    } catch {
      alert("計上会社の設定に失敗しました");
    } finally {
      setAssigningId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* フィルター */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between p-4 text-sm text-gray-700 hover:bg-gray-50"
        >
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            絞り込み
            {Object.values(currentFilters).some(Boolean) && (
              <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                フィルター中
              </span>
            )}
          </div>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${showFilters ? "rotate-180" : ""}`}
          />
        </button>

        {showFilters && (
          <div className="p-4 pt-0 border-t border-gray-50">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">精算月</label>
                <input
                  type="month"
                  value={filters.month || ""}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, month: e.target.value }))
                  }
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm text-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">会社</label>
                <select
                  value={filters.company || ""}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      company: e.target.value,
                    }))
                  }
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm text-gray-900"
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
                <label className="block text-xs text-gray-500 mb-1">勘定科目</label>
                <select
                  value={filters.account || ""}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      account: e.target.value,
                    }))
                  }
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm text-gray-900"
                >
                  <option value="">全科目</option>
                  {accountItems.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">精算者</label>
                <select
                  value={filters.user || ""}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, user: e.target.value }))
                  }
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm text-gray-900"
                >
                  <option value="">全員</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">ステータス</label>
                <select
                  value={filters.status || ""}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      status: e.target.value,
                    }))
                  }
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm text-gray-900"
                >
                  <option value="">全て</option>
                  <option value="unsettled">未精算</option>
                  <option value="settled">精算済</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={applyFilters}
                className="py-1.5 px-4 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
              >
                適用
              </button>
              <button
                onClick={clearFilters}
                className="py-1.5 px-4 border border-gray-300 text-gray-600 rounded text-sm hover:bg-gray-50"
              >
                クリア
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 件数 */}
      <div className="text-sm text-gray-500">
        {receipts.length}件
        {receipts.length > 0 && (
          <span className="ml-2">
            合計:{" "}
            {formatCurrency(
              receipts.reduce((sum, r) => sum + r.receipt.amount, 0)
            )}
          </span>
        )}
        {receipts.filter((r) => !r.receipt.companyId).length > 0 && (
          <span className="ml-3 text-orange-600 font-medium">
            ※ 計上会社未設定: {receipts.filter((r) => !r.receipt.companyId).length}件
          </span>
        )}
      </div>

      {/* テーブル */}
      {receipts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-400 text-sm">
          領収書データがありません
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">領収書No</th>
                  <th className="px-4 py-3 text-left font-medium">精算月</th>
                  <th className="px-4 py-3 text-left font-medium">日付</th>
                  <th className="px-4 py-3 text-left font-medium">店名</th>
                  <th className="px-4 py-3 text-right font-medium">金額</th>
                  <th className="px-4 py-3 text-left font-medium">勘定科目</th>
                  <th className="px-4 py-3 text-left font-medium">計上会社</th>
                  <th className="px-4 py-3 text-left font-medium">精算者</th>
                  <th className="px-4 py-3 text-center font-medium">INV</th>
                  <th className="px-4 py-3 text-center font-medium">ステータス</th>
                  <th className="px-4 py-3 text-center font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {receipts.map(({ receipt, company, accountItem, claimant }) => (
                  <tr
                    key={receipt.id}
                    className={`hover:bg-gray-50 transition-colors ${!receipt.companyId ? "bg-orange-50/40" : ""}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {receipt.receiptNo || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {formatYearMonth(receipt.settlementMonth)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDateJa(receipt.receiptDate)}
                    </td>
                    <td className="px-4 py-3 text-gray-800 max-w-32 truncate">
                      {receipt.storeName || "-"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatCurrency(receipt.amount)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {accountItem?.name || "-"}
                    </td>
                    {/* 計上会社: インライン選択 */}
                    <td className="px-4 py-3">
                      {assigningId === receipt.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                      ) : (
                        <select
                          value={receipt.companyId || ""}
                          onChange={(e) =>
                            handleCompanyChange(receipt.id, e.target.value)
                          }
                          className={`border rounded px-2 py-1 text-xs text-gray-900 min-w-24 ${
                            receipt.companyId
                              ? "border-gray-200 bg-white"
                              : "border-orange-300 bg-orange-50 text-orange-700"
                          }`}
                        >
                          <option value="">未設定</option>
                          {companies.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {claimant?.displayName || "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {receipt.hasInvoice ? (
                        <span className="text-green-600 text-xs font-medium">有</span>
                      ) : (
                        <span className="text-gray-400 text-xs">無</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
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
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {receipt.driveUrl && (
                          <a
                            href={receipt.driveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          onClick={() => handleDelete(receipt.id)}
                          disabled={deletingId === receipt.id}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
