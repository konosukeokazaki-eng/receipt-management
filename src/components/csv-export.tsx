"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import type { Company } from "@/db/schema";

interface CsvExportProps {
  companies: Company[];
  defaultMonth: string;
}

export function CsvExport({ companies, defaultMonth }: CsvExportProps) {
  const [form, setForm] = useState({
    format: "general" as "general" | "yayoi",
    month: defaultMonth,
    companyId: "",
    status: "all" as "all" | "settled" | "unsettled",
  });

  const handleDownload = () => {
    const params = new URLSearchParams();
    params.set("format", form.format);
    if (form.month) params.set("month", form.month);
    if (form.companyId) params.set("companyId", form.companyId);
    if (form.status !== "all") params.set("status", form.status);

    window.location.href = `/api/csv?${params.toString()}`;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
      {/* 出力形式 */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">出力形式</h2>
        <div className="space-y-2">
          <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
            <input
              type="radio"
              name="format"
              value="general"
              checked={form.format === "general"}
              onChange={() => setForm((prev) => ({ ...prev, format: "general" }))}
              className="mt-0.5"
            />
            <div>
              <div className="text-sm font-medium text-gray-800">汎用CSV</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Excel等で開ける標準形式（UTF-8 BOM付き）
              </div>
            </div>
          </label>
          <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
            <input
              type="radio"
              name="format"
              value="yayoi"
              checked={form.format === "yayoi"}
              onChange={() => setForm((prev) => ({ ...prev, format: "yayoi" }))}
              className="mt-0.5"
            />
            <div>
              <div className="text-sm font-medium text-gray-800">
                弥生会計インポート形式
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                弥生会計インストール版 仕訳日記帳インポート対応
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* フィルター条件 */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">出力条件</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">精算月</label>
            <input
              type="month"
              value={form.month}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, month: e.target.value }))
              }
              className="w-full border border-gray-200 rounded px-2 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">会社</label>
            <select
              value={form.companyId}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, companyId: e.target.value }))
              }
              className="w-full border border-gray-200 rounded px-2 py-2 text-sm"
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
            <label className="block text-xs text-gray-500 mb-1">
              精算ステータス
            </label>
            <select
              value={form.status}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  status: e.target.value as "all" | "settled" | "unsettled",
                }))
              }
              className="w-full border border-gray-200 rounded px-2 py-2 text-sm"
            >
              <option value="all">全て</option>
              <option value="unsettled">未精算のみ</option>
              <option value="settled">精算済のみ</option>
            </select>
          </div>
        </div>
      </div>

      {/* 弥生形式の注意事項 */}
      {form.format === "yayoi" && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1">
          <p className="font-medium">弥生会計インポート時の注意事項</p>
          <ul className="list-disc list-inside space-y-0.5 text-amber-700">
            <li>勘定科目名は弥生会計の科目名と完全一致が必要です</li>
            <li>マスター設定で「弥生科目名」を正確に設定してください</li>
            <li>
              インボイスなし経費は「課税仕入10%(80%)」として出力されます
              （2026年9月まで）
            </li>
          </ul>
        </div>
      )}

      <button
        onClick={handleDownload}
        className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
      >
        <Download className="w-5 h-5" />
        CSVをダウンロード
      </button>
    </div>
  );
}
