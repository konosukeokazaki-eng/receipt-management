"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  CreditCard,
  PieChart,
  Download,
  Settings,
  PlusCircle,
  Layers,
  LogOut,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "ダッシュボード" },
  { href: "/receipts", icon: Receipt, label: "領収書一覧" },
  { href: "/receipts/new", icon: PlusCircle, label: "領収書登録（単票）" },
  { href: "/receipts/bulk", icon: Layers, label: "領収書登録（一括）" },
  { href: "/settlement", icon: CreditCard, label: "精算管理" },
  { href: "/budgets", icon: PieChart, label: "予算管理" },
  { href: "/csv", icon: Download, label: "CSV出力" },
  { href: "/master", icon: Settings, label: "マスター設定" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🧾</span>
          <div>
            <div className="text-sm font-bold leading-tight">経費精算</div>
            <div className="text-xs text-gray-400">予算管理システム</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg mb-1 text-sm transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-700"
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-2 border-t border-gray-700">
        <form action="/api/auth/signout" method="POST">
          <button
            type="submit"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-700 w-full transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>ログアウト</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
