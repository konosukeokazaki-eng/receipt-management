"use server";

import { auth } from "@/lib/auth";
import { db, companies, accountItems, users } from "@/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ─────────────────────────────────────────────
// 会社マスター
// ─────────────────────────────────────────────
export async function getCompanies() {
  const session = await auth();
  if (!session?.user) throw new Error("認証が必要です");
  return db.select().from(companies).orderBy(companies.name);
}

const CompanySchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(5),
  fiscalYearEndMonth: z.number().int().min(1).max(12),
  driveParentFolderId: z.string().optional().nullable(),
});

export async function createCompany(data: z.infer<typeof CompanySchema>) {
  const session = await auth();
  if (!session?.user) throw new Error("認証が必要です");

  const validated = CompanySchema.parse(data);
  const [company] = await db.insert(companies).values(validated).returning();
  revalidatePath("/master");
  return company;
}

export async function updateCompany(
  id: string,
  data: Partial<z.infer<typeof CompanySchema>>
) {
  const session = await auth();
  if (!session?.user) throw new Error("認証が必要です");

  const [company] = await db
    .update(companies)
    .set(data)
    .where(eq(companies.id, id))
    .returning();
  revalidatePath("/master");
  return company;
}

export async function deleteCompany(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("認証が必要です");

  await db.delete(companies).where(eq(companies.id, id));
  revalidatePath("/master");
}

// ─────────────────────────────────────────────
// 勘定科目マスター
// ─────────────────────────────────────────────
export async function getAccountItems() {
  const session = await auth();
  if (!session?.user) throw new Error("認証が必要です");
  return db
    .select()
    .from(accountItems)
    .where(eq(accountItems.isActive, true))
    .orderBy(accountItems.sortOrder, accountItems.name);
}

const AccountItemSchema = z.object({
  name: z.string().min(1),
  yayoiName: z.string().optional().nullable(),
  taxCategory: z.enum(["taxable", "exempt"]),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export async function createAccountItem(
  data: z.infer<typeof AccountItemSchema>
) {
  const session = await auth();
  if (!session?.user) throw new Error("認証が必要です");

  const validated = AccountItemSchema.parse(data);
  const [item] = await db.insert(accountItems).values(validated).returning();
  revalidatePath("/master");
  return item;
}

export async function updateAccountItem(
  id: string,
  data: Partial<z.infer<typeof AccountItemSchema>>
) {
  const session = await auth();
  if (!session?.user) throw new Error("認証が必要です");

  const [item] = await db
    .update(accountItems)
    .set(data)
    .where(eq(accountItems.id, id))
    .returning();
  revalidatePath("/master");
  return item;
}

export async function deleteAccountItem(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("認証が必要です");

  await db
    .update(accountItems)
    .set({ isActive: false })
    .where(eq(accountItems.id, id));
  revalidatePath("/master");
}

// ─────────────────────────────────────────────
// ユーザーマスター
// ─────────────────────────────────────────────
export async function getUsers() {
  const session = await auth();
  if (!session?.user) throw new Error("認証が必要です");
  return db
    .select()
    .from(users)
    .where(eq(users.isActive, true))
    .orderBy(users.displayName);
}

const UserBankSchema = z.object({
  bankName: z.string().optional().nullable(),
  bankBranch: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
  accountHolder: z.string().optional().nullable(),
});

export async function updateUserBank(
  id: string,
  data: z.infer<typeof UserBankSchema>
) {
  const session = await auth();
  if (!session?.user) throw new Error("認証が必要です");

  const [user] = await db
    .update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  revalidatePath("/master");
  return user;
}

export async function updateUserDisplayName(id: string, displayName: string) {
  const session = await auth();
  if (!session?.user) throw new Error("認証が必要です");

  const [user] = await db
    .update(users)
    .set({ displayName, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  revalidatePath("/master");
  return user;
}

export async function toggleUserActive(id: string, isActive: boolean) {
  const session = await auth();
  if (!session?.user) throw new Error("認証が必要です");

  await db
    .update(users)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(users.id, id));
  revalidatePath("/master");
}
