"use server";

import { auth } from "@/lib/auth";
import { db, budgets, receipts, companies, accountItems } from "@/db";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ─────────────────────────────────────────────
// 予算設定
// ─────────────────────────────────────────────
const BudgetSchema = z.object({
  companyId: z.string().uuid(),
  accountItemId: z.string().uuid(),
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
  amount: z.number().int().min(0),
});

export async function upsertBudget(data: z.infer<typeof BudgetSchema>) {
  const session = await auth();
  if (!session?.user) throw new Error("認証が必要です");

  const validated = BudgetSchema.parse(data);

  // upsert (insert or update)
  const [budget] = await db
    .insert(budgets)
    .values({
      ...validated,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [budgets.companyId, budgets.accountItemId, budgets.yearMonth],
      set: {
        amount: validated.amount,
        updatedAt: new Date(),
      },
    })
    .returning();

  revalidatePath("/budgets");
  return budget;
}

// ─────────────────────────────────────────────
// 予算実績集計
// ─────────────────────────────────────────────
export async function getBudgetVsActual(yearMonth: string, companyId?: string) {
  const session = await auth();
  if (!session?.user) throw new Error("認証が必要です");

  const budgetConditions = [eq(budgets.yearMonth, yearMonth)];
  if (companyId) {
    budgetConditions.push(eq(budgets.companyId, companyId));
  }

  const result = await db.execute(sql`
    SELECT
      c.id AS company_id,
      c.name AS company_name,
      a.id AS account_item_id,
      a.name AS account_name,
      COALESCE(b.amount, 0) AS budget,
      COALESCE(SUM(r.amount), 0) AS actual,
      CASE
        WHEN COALESCE(b.amount, 0) = 0 THEN 0
        ELSE ROUND(COALESCE(SUM(r.amount), 0) * 100.0 / b.amount, 1)
      END AS pct
    FROM budgets b
    JOIN companies c ON c.id = b.company_id
    JOIN account_items a ON a.id = b.account_item_id
    LEFT JOIN receipts r
      ON r.company_id = b.company_id
      AND r.account_item_id = b.account_item_id
      AND r.settlement_month = b.year_month
    WHERE b.year_month = ${yearMonth}
    ${companyId ? sql`AND b.company_id = ${companyId}` : sql``}
    GROUP BY c.id, c.name, a.id, a.name, b.amount
    ORDER BY c.name, a.name
  `);

  return result.rows as {
    company_id: string;
    company_name: string;
    account_item_id: string;
    account_name: string;
    budget: number;
    actual: number;
    pct: number;
  }[];
}

// ─────────────────────────────────────────────
// 勘定科目別内訳（グラフ用）
// ─────────────────────────────────────────────
export async function getAccountItemBreakdown(
  yearMonth: string,
  companyId?: string
) {
  const session = await auth();
  if (!session?.user) throw new Error("認証が必要です");

  const conditions = [eq(receipts.settlementMonth, yearMonth)];
  if (companyId) {
    conditions.push(eq(receipts.companyId, companyId));
  }

  const result = await db
    .select({
      accountItemId: receipts.accountItemId,
      accountName: accountItems.name,
      total: sql<number>`sum(${receipts.amount})`,
    })
    .from(receipts)
    .leftJoin(accountItems, eq(receipts.accountItemId, accountItems.id))
    .where(and(...conditions))
    .groupBy(receipts.accountItemId, accountItems.name);

  return result;
}

// ─────────────────────────────────────────────
// 予算一覧取得
// ─────────────────────────────────────────────
export async function getBudgets(yearMonth: string, companyId?: string) {
  const session = await auth();
  if (!session?.user) throw new Error("認証が必要です");

  const conditions = [eq(budgets.yearMonth, yearMonth)];
  if (companyId) {
    conditions.push(eq(budgets.companyId, companyId));
  }

  return db
    .select({
      budget: budgets,
      company: companies,
      accountItem: accountItems,
    })
    .from(budgets)
    .leftJoin(companies, eq(budgets.companyId, companies.id))
    .leftJoin(accountItems, eq(budgets.accountItemId, accountItems.id))
    .where(and(...conditions))
    .orderBy(companies.name, accountItems.sortOrder);
}
