"use client";

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

const COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316", "#6366F1", "#84CC16",
];

interface DashboardChartsProps {
  breakdown: { name: string; value: number }[];
  budgetVsActual: {
    name: string;
    budget: number;
    actual: number;
    pct: number;
  }[];
}

export function DashboardCharts({ breakdown, budgetVsActual }: DashboardChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 円グラフ: 勘定科目内訳 */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          勘定科目別内訳
        </h2>
        {breakdown.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={breakdown}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="value"
                label={({ name, percent }) =>
                  `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {breakdown.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
            今月の経費データがありません
          </div>
        )}
      </div>

      {/* 棒グラフ: 予算 vs 実績 */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          予算 vs 実績
        </h2>
        {budgetVsActual.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={budgetVsActual} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => `¥${(v / 10000).toFixed(0)}万`} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Legend />
              <Bar dataKey="budget" name="予算" fill="#E5E7EB" />
              <Bar dataKey="actual" name="実績" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
            予算設定データがありません
          </div>
        )}
      </div>

      {/* 進捗バー: 予算消化率 */}
      {budgetVsActual.length > 0 && (
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            予算消化率
          </h2>
          <div className="space-y-3">
            {budgetVsActual.map((item) => (
              <div key={item.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">{item.name}</span>
                  <span className="text-gray-500">
                    {formatCurrency(item.actual)} / {formatCurrency(item.budget)}
                    <span
                      className={`ml-2 font-medium ${
                        item.pct > 100
                          ? "text-red-600"
                          : item.pct > 80
                          ? "text-orange-500"
                          : "text-green-600"
                      }`}
                    >
                      {item.pct}%
                    </span>
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      item.pct > 100
                        ? "bg-red-500"
                        : item.pct > 80
                        ? "bg-orange-400"
                        : "bg-blue-500"
                    }`}
                    style={{ width: `${Math.min(item.pct, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
