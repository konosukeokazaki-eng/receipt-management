"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { analyzeReceipt, createReceipt } from "@/actions/receipt-actions";
import { getCurrentMonth } from "@/lib/utils";
import {
  Camera,
  Upload,
  RefreshCw,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import type { AccountItem, User } from "@/db/schema";

interface ReceiptFormProps {
  accountItems: AccountItem[];
  users: User[];
  defaultUserId?: string;
}

export function ReceiptForm({
  accountItems,
  users,
  defaultUserId,
}: ReceiptFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    settlementMonth: getCurrentMonth(),
    accountItemId: "",
    receiptDate: "",
    amount: "",
    storeName: "",
    purpose: "",
    hasInvoice: false,
    invoiceNumber: "",
    claimantUserId: defaultUserId || users[0]?.id || "",
  });

  const handleFileSelect = async (file: File) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    setError(null);
  };

  const handleAnalyze = async () => {
    if (!imageFile) return;
    setIsAnalyzing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", imageFile);
      const result = await analyzeReceipt(formData);

      if ("error" in result) {
        setError(result.error);
        return;
      }

      setForm((prev) => ({
        ...prev,
        receiptDate: result.receiptDate || prev.receiptDate,
        amount: result.amount ? String(result.amount) : prev.amount,
        storeName: result.storeName || prev.storeName,
        hasInvoice: result.hasInvoice,
        invoiceNumber: result.invoiceNumber || prev.invoiceNumber,
      }));
    } catch {
      setError("OCR解析に失敗しました。手動で入力するか、再解析してください。");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.accountItemId || !form.claimantUserId) {
      setError("必須項目を入力してください");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      let fileBase64: string | undefined;
      let fileMimeType: string | undefined;

      if (imageFile) {
        const buffer = await imageFile.arrayBuffer();
        fileBase64 = Buffer.from(buffer).toString("base64");
        fileMimeType = imageFile.type;
      }

      await createReceipt(
        {
          settlementMonth: form.settlementMonth,
          accountItemId: form.accountItemId,
          receiptDate: form.receiptDate || null,
          amount: parseInt(form.amount) || 0,
          storeName: form.storeName || null,
          purpose: form.purpose || null,
          companyId: null,
          hasInvoice: form.hasInvoice,
          invoiceNumber: form.invoiceNumber || null,
          claimantUserId: form.claimantUserId,
        },
        fileBase64,
        fileMimeType,
        imageFile?.name
      );

      setSuccess(true);
      setTimeout(() => router.push("/receipts"), 1500);
    } catch {
      setError("保存に失敗しました。もう一度お試しください。");
    } finally {
      setIsSaving(false);
    }
  };

  if (success) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-100">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">登録完了</h2>
        <p className="text-gray-500">領収書が正常に登録されました</p>
        <p className="text-sm text-gray-400 mt-2">
          領収書一覧から計上会社を設定してください
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 画像アップロードエリア */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          領収書画像
        </h2>

        {imagePreview ? (
          <div className="space-y-4">
            <img
              src={imagePreview}
              alt="領収書プレビュー"
              className="max-h-64 mx-auto rounded-lg object-contain border border-gray-200"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    解析中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    OCR解析
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setImagePreview(null);
                  setImageFile(null);
                }}
                className="py-2 px-4 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                画像を変更
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">
                クリックしてファイルを選択
              </p>
              <p className="text-xs text-gray-400 mt-1">
                JPG, PNG, PDF 対応
              </p>
            </div>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <Camera className="w-4 h-4" />
              カメラで撮影
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
            />
          </div>
        )}
      </div>

      {/* OCR結果・手動入力 */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          領収書情報
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                領収書日付
              </label>
              <input
                type="date"
                value={form.receiptDate}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, receiptDate: e.target.value }))
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                金額（税込）<span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={form.amount}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, amount: e.target.value }))
                }
                placeholder="0"
                min="0"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              店名
            </label>
            <input
              type="text"
              value={form.storeName}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, storeName: e.target.value }))
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="hasInvoice"
              checked={form.hasInvoice}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, hasInvoice: e.target.checked }))
              }
              className="w-4 h-4 text-blue-600 border-gray-300 rounded"
            />
            <label
              htmlFor="hasInvoice"
              className="text-sm font-medium text-gray-700"
            >
              インボイス番号あり
            </label>
          </div>

          {form.hasInvoice && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                インボイス番号
              </label>
              <input
                type="text"
                value={form.invoiceNumber}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    invoiceNumber: e.target.value,
                  }))
                }
                placeholder="T1234567890123"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}
        </div>
      </div>

      {/* 属性情報 */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          属性情報
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                精算月<span className="text-red-500">*</span>
              </label>
              <input
                type="month"
                value={form.settlementMonth}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    settlementMonth: e.target.value,
                  }))
                }
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                勘定科目<span className="text-red-500">*</span>
              </label>
              <select
                value={form.accountItemId}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    accountItemId: e.target.value,
                  }))
                }
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">選択してください</option>
                {accountItems.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              経費精算者<span className="text-red-500">*</span>
            </label>
            <select
              value={form.claimantUserId}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  claimantUserId: e.target.value,
                }))
              }
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">選択してください</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              他社様名 / 用途
            </label>
            <textarea
              value={form.purpose}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, purpose: e.target.value }))
              }
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* 計上会社は登録後に一覧から設定 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
        ※ 計上会社は登録後、領収書一覧から各領収書ごとに設定できます
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* 送信ボタン */}
      <button
        type="submit"
        disabled={isSaving}
        className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {isSaving ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            保存中...
          </>
        ) : (
          <>
            <Save className="w-5 h-5" />
            登録する
          </>
        )}
      </button>
    </form>
  );
}
