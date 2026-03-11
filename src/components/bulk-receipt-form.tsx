"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { analyzeReceipt, createReceipt } from "@/actions/receipt-actions";
import { getCurrentMonth, formatCurrency } from "@/lib/utils";
import {
  Upload,
  Trash2,
  RefreshCw,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  ImageIcon,
} from "lucide-react";
import type { AccountItem, User } from "@/db/schema";

interface QueueItem {
  id: string;
  file: File;
  preview: string;
  status: "pending" | "analyzing" | "ready" | "saving" | "done" | "error";
  error?: string;
  // OCR結果
  receiptDate?: string;
  storeName?: string;
  amount?: string;
  hasInvoice?: boolean;
  invoiceNumber?: string;
  // 個別上書き
  accountItemId?: string;
  claimantUserId?: string;
  purpose?: string;
}

interface BulkReceiptFormProps {
  accountItems: AccountItem[];
  users: User[];
}

export function BulkReceiptForm({
  accountItems,
  users,
}: BulkReceiptFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isSavingAll, setIsSavingAll] = useState(false);

  // 共通設定
  const [commonSettings, setCommonSettings] = useState({
    settlementMonth: getCurrentMonth(),
    claimantUserId: users[0]?.id || "",
    accountItemId: "",
  });

  const handleFilesSelect = (files: FileList) => {
    const newItems: QueueItem[] = Array.from(files).map((file) => {
      const preview = URL.createObjectURL(file);
      return {
        id: crypto.randomUUID(),
        file,
        preview,
        status: "pending",
      };
    });
    setQueue((prev) => [...prev, ...newItems]);
  };

  const analyzeItem = async (itemId: string) => {
    const item = queue.find((i) => i.id === itemId);
    if (!item) return;

    setQueue((prev) =>
      prev.map((i) =>
        i.id === itemId ? { ...i, status: "analyzing" } : i
      )
    );

    try {
      const formData = new FormData();
      formData.append("file", item.file);
      const result = await analyzeReceipt(formData);

      if ("error" in result) {
        setQueue((prev) =>
          prev.map((i) =>
            i.id === itemId
              ? { ...i, status: "error", error: result.error }
              : i
          )
        );
        return;
      }

      setQueue((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? {
                ...i,
                status: "ready",
                receiptDate: result.receiptDate || "",
                storeName: result.storeName || "",
                amount: result.amount ? String(result.amount) : "",
                hasInvoice: result.hasInvoice,
                invoiceNumber: result.invoiceNumber || "",
              }
            : i
        )
      );
    } catch {
      setQueue((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? { ...i, status: "error", error: "OCR解析に失敗しました" }
            : i
        )
      );
    }
  };

  const analyzeAll = async () => {
    const pendingItems = queue.filter((i) => i.status === "pending");
    for (const item of pendingItems) {
      await analyzeItem(item.id);
    }
  };

  const removeItem = (itemId: string) => {
    setQueue((prev) => prev.filter((i) => i.id !== itemId));
  };

  const updateItem = (itemId: string, updates: Partial<QueueItem>) => {
    setQueue((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, ...updates } : i))
    );
  };

  const saveAll = async () => {
    const readyItems = queue.filter((i) => i.status === "ready");
    if (readyItems.length === 0) return;

    setIsSavingAll(true);

    for (const item of readyItems) {
      setQueue((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, status: "saving" } : i
        )
      );

      try {
        const buffer = await item.file.arrayBuffer();
        const fileBase64 = Buffer.from(buffer).toString("base64");

        await createReceipt(
          {
            settlementMonth: commonSettings.settlementMonth,
            accountItemId:
              item.accountItemId || commonSettings.accountItemId || "",
            receiptDate: item.receiptDate || null,
            amount: parseInt(item.amount || "0") || 0,
            storeName: item.storeName || null,
            purpose: item.purpose || null,
            companyId: null,
            hasInvoice: item.hasInvoice || false,
            invoiceNumber: item.invoiceNumber || null,
            claimantUserId:
              item.claimantUserId || commonSettings.claimantUserId,
          },
          fileBase64,
          item.file.type,
          item.file.name
        );

        setQueue((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, status: "done" } : i
          )
        );
      } catch {
        setQueue((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, status: "error", error: "保存に失敗しました" }
              : i
          )
        );
      }
    }

    setIsSavingAll(false);
  };

  const statusBadge = (status: QueueItem["status"]) => {
    const map = {
      pending: { label: "解析待ち", className: "bg-gray-100 text-gray-600" },
      analyzing: { label: "解析中...", className: "bg-blue-100 text-blue-600" },
      ready: { label: "確認待ち", className: "bg-yellow-100 text-yellow-700" },
      saving: { label: "保存中...", className: "bg-blue-100 text-blue-600" },
      done: { label: "完了", className: "bg-green-100 text-green-700" },
      error: { label: "エラー", className: "bg-red-100 text-red-600" },
    };
    const s = map[status];
    return (
      <span
        className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.className}`}
      >
        {s.label}
      </span>
    );
  };

  const pendingCount = queue.filter((i) => i.status === "pending").length;
  const readyCount = queue.filter((i) => i.status === "ready").length;
  const doneCount = queue.filter((i) => i.status === "done").length;

  return (
    <div className="space-y-6">
      {/* 共通設定 */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-base font-semibold text-gray-900 mb-4">共通設定</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              精算月
            </label>
            <input
              type="month"
              value={commonSettings.settlementMonth}
              onChange={(e) =>
                setCommonSettings((prev) => ({
                  ...prev,
                  settlementMonth: e.target.value,
                }))
              }
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              勘定科目（共通）
            </label>
            <select
              value={commonSettings.accountItemId}
              onChange={(e) =>
                setCommonSettings((prev) => ({
                  ...prev,
                  accountItemId: e.target.value,
                }))
              }
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900"
            >
              <option value="">個別に設定</option>
              {accountItems.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              精算者
            </label>
            <select
              value={commonSettings.claimantUserId}
              onChange={(e) =>
                setCommonSettings((prev) => ({
                  ...prev,
                  claimantUserId: e.target.value,
                }))
              }
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-blue-600 mt-3">
          ※ 計上会社は登録後、領収書一覧から各領収書ごとに設定できます
        </p>
      </div>

      {/* ファイル追加 */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors bg-white"
      >
        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-600">
          クリックして複数ファイルを選択
        </p>
        <p className="text-xs text-gray-400 mt-1">JPG, PNG 対応</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFilesSelect(e.target.files);
          }}
        />
      </div>

      {/* キュー一覧 */}
      {queue.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex gap-4 text-sm text-gray-500">
              <span>合計: {queue.length}件</span>
              {pendingCount > 0 && <span>解析待ち: {pendingCount}件</span>}
              {readyCount > 0 && <span className="text-yellow-600">確認待ち: {readyCount}件</span>}
              {doneCount > 0 && <span className="text-green-600">完了: {doneCount}件</span>}
            </div>
            <div className="flex gap-2">
              {pendingCount > 0 && (
                <button
                  type="button"
                  onClick={analyzeAll}
                  className="flex items-center gap-1.5 py-1.5 px-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  全件解析
                </button>
              )}
              {readyCount > 0 && (
                <button
                  type="button"
                  onClick={saveAll}
                  disabled={isSavingAll}
                  className="flex items-center gap-1.5 py-1.5 px-3 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {isSavingAll ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  一括保存
                </button>
              )}
            </div>
          </div>

          <div className="divide-y divide-gray-50">
            {queue.map((item) => (
              <div key={item.id} className="p-4 flex gap-4">
                {/* サムネイル */}
                <div className="w-20 h-20 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={item.preview}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* 情報 */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {statusBadge(item.status)}
                      <span className="text-xs text-gray-500 truncate">
                        {item.file.name}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {(item.status === "pending" ||
                        item.status === "error") && (
                        <button
                          type="button"
                          onClick={() => analyzeItem(item.id)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {item.status === "error" && (
                    <p className="text-xs text-red-600">{item.error}</p>
                  )}

                  {(item.status === "ready" || item.status === "done") && (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500">日付</label>
                        <input
                          type="date"
                          value={item.receiptDate || ""}
                          onChange={(e) =>
                            updateItem(item.id, {
                              receiptDate: e.target.value,
                            })
                          }
                          disabled={item.status === "done"}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500">店名</label>
                        <input
                          type="text"
                          value={item.storeName || ""}
                          onChange={(e) =>
                            updateItem(item.id, { storeName: e.target.value })
                          }
                          disabled={item.status === "done"}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500">金額</label>
                        <input
                          type="number"
                          value={item.amount || ""}
                          onChange={(e) =>
                            updateItem(item.id, { amount: e.target.value })
                          }
                          disabled={item.status === "done"}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-gray-900"
                        />
                      </div>
                    </div>
                  )}

                  {item.status === "done" && (
                    <div className="flex items-center gap-1 text-green-600 text-xs">
                      <CheckCircle className="w-3.5 h-3.5" />
                      登録完了
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {doneCount > 0 && doneCount === queue.length && (
        <button
          type="button"
          onClick={() => router.push("/receipts")}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
        >
          一覧に戻る（計上会社を設定する）
        </button>
      )}
    </div>
  );
}
