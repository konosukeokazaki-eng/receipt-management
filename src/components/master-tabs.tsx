"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createCompany,
  updateCompany,
  deleteCompany,
  createAccountItem,
  updateAccountItem,
  deleteAccountItem,
  updateUserBank,
  updateUserDisplayName,
} from "@/actions/master-actions";
import { Building2, BookOpen, Users, Plus, Pencil, Trash2, X, Check } from "lucide-react";
import type { Company, AccountItem, User } from "@/db/schema";

interface MasterTabsProps {
  companies: Company[];
  accountItems: AccountItem[];
  users: User[];
}

type Tab = "companies" | "accountItems" | "users";

export function MasterTabs({ companies, accountItems, users }: MasterTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("companies");

  return (
    <div className="space-y-4">
      {/* タブ */}
      <div className="flex border-b border-gray-200">
        {(
          [
            { id: "companies", label: "会社", icon: Building2 },
            { id: "accountItems", label: "勘定科目", icon: BookOpen },
            { id: "users", label: "ユーザー", icon: Users },
          ] as { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[]
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === "companies" && (
        <CompanyMaster companies={companies} />
      )}
      {activeTab === "accountItems" && (
        <AccountItemMaster accountItems={accountItems} />
      )}
      {activeTab === "users" && <UserMaster users={users} />}
    </div>
  );
}

// ─────────────────────────────────────────────
// 会社マスター
// ─────────────────────────────────────────────
function CompanyMaster({ companies }: { companies: Company[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    code: "",
    fiscalYearEndMonth: 12,
    driveParentFolderId: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!form.name || !form.code) return;
    setIsSubmitting(true);
    try {
      await createCompany({
        name: form.name,
        code: form.code,
        fiscalYearEndMonth: form.fiscalYearEndMonth,
        driveParentFolderId: form.driveParentFolderId || null,
      });
      setForm({ name: "", code: "", fiscalYearEndMonth: 12, driveParentFolderId: "" });
      setShowForm(false);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("この会社を削除しますか？")) return;
    await deleteCompany(id);
    router.refresh();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700">
          会社一覧 ({companies.length}件)
        </span>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 py-1.5 px-3 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
        >
          <Plus className="w-3.5 h-3.5" />
          追加
        </button>
      </div>

      {showForm && (
        <div className="p-4 bg-blue-50 border-b border-blue-100">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">会社名<span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">会社コード<span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                maxLength={5}
                placeholder="A"
                className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">決算月</label>
              <select
                value={form.fiscalYearEndMonth}
                onChange={(e) => setForm((p) => ({ ...p, fiscalYearEndMonth: parseInt(e.target.value) }))}
                className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>{m}月</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Drive フォルダID</label>
              <input
                type="text"
                value={form.driveParentFolderId}
                onChange={(e) => setForm((p) => ({ ...p, driveParentFolderId: e.target.value }))}
                className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm font-mono text-xs"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleCreate}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 py-1.5 px-3 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              保存
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="flex items-center gap-1.5 py-1.5 px-3 border border-gray-300 text-gray-600 rounded text-xs hover:bg-gray-50"
            >
              <X className="w-3.5 h-3.5" />
              キャンセル
            </button>
          </div>
        </div>
      )}

      <table className="w-full text-sm">
        <thead className="text-xs text-gray-500 bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left font-medium">会社名</th>
            <th className="px-4 py-2 text-left font-medium">コード</th>
            <th className="px-4 py-2 text-center font-medium">決算月</th>
            <th className="px-4 py-2 text-left font-medium">Drive フォルダID</th>
            <th className="px-4 py-2 text-center font-medium">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {companies.map((c) => (
            <tr key={c.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-800">{c.name}</td>
              <td className="px-4 py-3 font-mono text-gray-600">{c.code}</td>
              <td className="px-4 py-3 text-center text-gray-600">{c.fiscalYearEndMonth}月</td>
              <td className="px-4 py-3 font-mono text-xs text-gray-400 max-w-32 truncate">
                {c.driveParentFolderId || "-"}
              </td>
              <td className="px-4 py-3 text-center">
                <button
                  onClick={() => handleDelete(c.id)}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────
// 勘定科目マスター
// ─────────────────────────────────────────────
function AccountItemMaster({ accountItems }: { accountItems: AccountItem[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    yayoiName: "",
    taxCategory: "taxable" as "taxable" | "exempt",
    sortOrder: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!form.name) return;
    setIsSubmitting(true);
    try {
      await createAccountItem({
        name: form.name,
        yayoiName: form.yayoiName || null,
        taxCategory: form.taxCategory,
        sortOrder: form.sortOrder,
        isActive: true,
      });
      setForm({ name: "", yayoiName: "", taxCategory: "taxable", sortOrder: 0 });
      setShowForm(false);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("この勘定科目を無効にしますか？")) return;
    await deleteAccountItem(id);
    router.refresh();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700">
          勘定科目一覧 ({accountItems.length}件)
        </span>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 py-1.5 px-3 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
        >
          <Plus className="w-3.5 h-3.5" />
          追加
        </button>
      </div>

      {showForm && (
        <div className="p-4 bg-blue-50 border-b border-blue-100">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">科目名<span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">弥生科目名</label>
              <input
                type="text"
                value={form.yayoiName}
                onChange={(e) => setForm((p) => ({ ...p, yayoiName: e.target.value }))}
                placeholder="弥生会計での科目名"
                className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">税区分</label>
              <select
                value={form.taxCategory}
                onChange={(e) => setForm((p) => ({ ...p, taxCategory: e.target.value as "taxable" | "exempt" }))}
                className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
              >
                <option value="taxable">課税</option>
                <option value="exempt">対象外</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">表示順</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((p) => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))}
                className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleCreate}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 py-1.5 px-3 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              保存
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="flex items-center gap-1.5 py-1.5 px-3 border border-gray-300 text-gray-600 rounded text-xs hover:bg-gray-50"
            >
              <X className="w-3.5 h-3.5" />
              キャンセル
            </button>
          </div>
        </div>
      )}

      <table className="w-full text-sm">
        <thead className="text-xs text-gray-500 bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left font-medium">科目名</th>
            <th className="px-4 py-2 text-left font-medium">弥生科目名</th>
            <th className="px-4 py-2 text-center font-medium">税区分</th>
            <th className="px-4 py-2 text-center font-medium">表示順</th>
            <th className="px-4 py-2 text-center font-medium">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {accountItems.map((a) => (
            <tr key={a.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-800">{a.name}</td>
              <td className="px-4 py-3 text-gray-500">{a.yayoiName || "-"}</td>
              <td className="px-4 py-3 text-center">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    a.taxCategory === "taxable"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {a.taxCategory === "taxable" ? "課税" : "対象外"}
                </span>
              </td>
              <td className="px-4 py-3 text-center text-gray-600">{a.sortOrder}</td>
              <td className="px-4 py-3 text-center">
                <button
                  onClick={() => handleDelete(a.id)}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────
// ユーザーマスター
// ─────────────────────────────────────────────
function UserMaster({ users }: { users: User[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    displayName: "",
    bankName: "",
    bankBranch: "",
    accountNumber: "",
    accountHolder: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const startEdit = (user: User) => {
    setEditingId(user.id);
    setEditForm({
      displayName: user.displayName,
      bankName: user.bankName || "",
      bankBranch: user.bankBranch || "",
      accountNumber: user.accountNumber || "",
      accountHolder: user.accountHolder || "",
    });
  };

  const handleSave = async (userId: string) => {
    setIsSubmitting(true);
    try {
      await updateUserDisplayName(userId, editForm.displayName);
      await updateUserBank(userId, {
        bankName: editForm.bankName || null,
        bankBranch: editForm.bankBranch || null,
        accountNumber: editForm.accountNumber || null,
        accountHolder: editForm.accountHolder || null,
      });
      setEditingId(null);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="p-4 border-b border-gray-100">
        <span className="text-sm font-medium text-gray-700">
          ユーザー一覧 ({users.length}件)
        </span>
        <p className="text-xs text-gray-400 mt-1">
          ※ ユーザーはGoogleログイン時に自動登録されます
        </p>
      </div>

      <div className="divide-y divide-gray-50">
        {users.map((user) => (
          <div key={user.id} className="p-4">
            {editingId === user.id ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">表示名</label>
                    <input
                      type="text"
                      value={editForm.displayName}
                      onChange={(e) => setEditForm((p) => ({ ...p, displayName: e.target.value }))}
                      className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">銀行名</label>
                    <input
                      type="text"
                      value={editForm.bankName}
                      onChange={(e) => setEditForm((p) => ({ ...p, bankName: e.target.value }))}
                      className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">支店名</label>
                    <input
                      type="text"
                      value={editForm.bankBranch}
                      onChange={(e) => setEditForm((p) => ({ ...p, bankBranch: e.target.value }))}
                      className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">口座番号</label>
                    <input
                      type="text"
                      value={editForm.accountNumber}
                      onChange={(e) => setEditForm((p) => ({ ...p, accountNumber: e.target.value }))}
                      className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">口座名義</label>
                    <input
                      type="text"
                      value={editForm.accountHolder}
                      onChange={(e) => setEditForm((p) => ({ ...p, accountHolder: e.target.value }))}
                      className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSave(user.id)}
                    disabled={isSubmitting}
                    className="flex items-center gap-1.5 py-1.5 px-3 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    保存
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="flex items-center gap-1.5 py-1.5 px-3 border border-gray-300 text-gray-600 rounded text-xs"
                  >
                    <X className="w-3.5 h-3.5" />
                    キャンセル
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-800">{user.displayName}</div>
                  <div className="text-xs text-gray-400">{user.email}</div>
                  {user.bankName && (
                    <div className="text-xs text-gray-500 mt-1">
                      {user.bankName} {user.bankBranch && `${user.bankBranch}支店`}{" "}
                      {user.accountNumber && `口座: ${user.accountNumber}`}{" "}
                      {user.accountHolder && `（${user.accountHolder}）`}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => startEdit(user)}
                  className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
