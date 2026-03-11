"use server";

import { auth } from "@/lib/auth";
import { db, receipts, users, companies, accountItems } from "@/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { analyzeReceiptImage, type OcrResult } from "@/lib/gemini";
import { uploadReceiptToDrive } from "@/lib/google-drive";
import {
  generateReceiptNo,
  generateReceiptFileName,
  getFiscalYear,
} from "@/lib/receipt-no";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ─────────────────────────────────────────────
// OCR解析
// ─────────────────────────────────────────────
export async function analyzeReceipt(
  formData: FormData
): Promise<OcrResult | { error: string }> {
  try {
    const session = await auth();
    if (!session?.user) return { error: "認証が必要です" };

    const file = formData.get("file") as File;
    if (!file) return { error: "ファイルが必要です" };

    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const mimeType = file.type || "image/jpeg";

    return await analyzeReceiptImage(base64, mimeType);
  } catch (err) {
    console.error("OCR error:", err);
    return { error: "OCR解析に失敗しました" };
  }
}

// ─────────────────────────────────────────────
// 領収書登録
// ─────────────────────────────────────────────
const CreateReceiptSchema = z.object({
  settlementMonth: z.string().regex(/^\d{4}-\d{2}$/),
  accountItemId: z.string().uuid(),
  receiptDate: z.string().optional().nullable(),
  amount: z.number().int().positive(),
  storeName: z.string().optional().nullable(),
  purpose: z.string().optional().nullable(),
  companyId: z.string().uuid().optional().nullable(),
  hasInvoice: z.boolean(),
  invoiceNumber: z.string().optional().nullable(),
  claimantUserId: z.string().uuid(),
});

export async function createReceipt(
  data: z.infer<typeof CreateReceiptSchema>,
  fileBase64?: string,
  fileMimeType?: string,
  originalFileName?: string
) {
  const session = await auth();
  if (!session?.user) throw new Error("認証が必要です");

  const validated = CreateReceiptSchema.parse(data);

  // 登録ユーザーのIDを取得
  const currentUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, session.user.email!))
    .limit(1);

  if (currentUser.length === 0) throw new Error("ユーザーが見つかりません");

  let receiptNo: string | undefined;
  let driveFileId: string | undefined;
  let driveUrl: string | undefined;
  let fileName: string | undefined;

  // 会社が設定されている場合のみ採番・Drive保存
  if (validated.companyId) {
    const company = await db
      .select()
      .from(companies)
      .where(eq(companies.id, validated.companyId))
      .limit(1);

    if (company.length > 0) {
      // 領収書No採番
      receiptNo = await generateReceiptNo(
        validated.companyId,
        validated.settlementMonth
      );

      // ファイル名生成
      const ext = originalFileName
        ? originalFileName.split(".").pop() || "jpg"
        : "jpg";
      fileName = generateReceiptFileName(
        receiptNo,
        validated.settlementMonth,
        company[0].code,
        validated.storeName || "不明",
        validated.amount,
        ext
      );

      // Google Driveへアップロード
      if (fileBase64 && company[0].driveParentFolderId) {
        try {
          const fiscalYear = getFiscalYear(
            validated.settlementMonth,
            company[0].fiscalYearEndMonth
          );
          const uploadResult = await uploadReceiptToDrive({
            fileName,
            fileBuffer: Buffer.from(fileBase64, "base64"),
            mimeType: fileMimeType || "image/jpeg",
            companyName: company[0].name,
            fiscalYear: String(fiscalYear),
            settlementMonth: validated.settlementMonth,
            driveParentFolderId: company[0].driveParentFolderId,
          });
          driveFileId = uploadResult.fileId;
          driveUrl = uploadResult.webViewLink;
        } catch (error) {
          console.error("Drive upload failed:", error);
        }
      }
    }
  }

  // DBに保存（null の代わりに undefined を使用してDrizzle型エラーを回避）
  const insertValues: Parameters<typeof db.insert>[0] extends any ? any : never = {
    receiptNo: receiptNo ?? undefined,
    settlementMonth: validated.settlementMonth,
    accountItemId: validated.accountItemId,
    receiptDate: validated.receiptDate ?? undefined,
    amount: validated.amount,
    storeName: validated.storeName ?? undefined,
    purpose: validated.purpose ?? undefined,
    companyId: validated.companyId ?? undefined,
    fileName: fileName ?? undefined,
    driveFileId: driveFileId ?? undefined,
    driveUrl: driveUrl ?? undefined,
    hasInvoice: validated.hasInvoice,
    invoiceNumber: validated.invoiceNumber ?? undefined,
    claimantUserId: validated.claimantUserId,
    settlementStatus: "unsettled",
    createdBy: currentUser[0].id,
  };

  const [receipt] = await db
    .insert(receipts)
    .values(insertValues)
    .returning();

  revalidatePath("/");
  revalidatePath("/receipts");
  return receipt;
}

// ─────────────────────────────────────────────
// 会社を後から割り当て（採番も行う）
// ─────────────────────────────────────────────
export async function assignCompanyToReceipt(
  receiptId: string,
  companyId: string
) {
  const session = await auth();
  if (!session?.user) throw new Error("認証が必要です");

  // 対象領収書を取得
  const [receipt] = await db
    .select()
    .from(receipts)
    .where(eq(receipts.id, receiptId))
    .limit(1);

  if (!receipt) throw new Error("領収書が見つかりません");

  // 会社情報を取得
  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (!company) throw new Error("会社が見つかりません");

  // 領収書No採番
  const receiptNo = await generateReceiptNo(
    companyId,
    receipt.settlementMonth
  );

  // ファイル名生成
  const ext = receipt.fileName
    ? receipt.fileName.split(".").pop() || "jpg"
    : "jpg";
  const fileName = generateReceiptFileName(
    receiptNo,
    receipt.settlementMonth,
    company.code,
    receipt.storeName || "不明",
    receipt.amount,
    ext
  );

  // 更新
  const [updated] = await db
    .update(receipts)
    .set({ companyId, receiptNo, fileName, updatedAt: new Date() })
    .where(eq(receipts.id, receiptId))
    .returning();

  revalidatePath("/receipts");
  return updated;
}

// ─────────────────────────────────────────────
// 領収書一覧取得
// ─────────────────────────────────────────────
export async function getReceipts(filters?: {
  settlementMonth?: string;
  companyId?: string;
  accountItemId?: string;
  claimantUserId?: string;
  settlementStatus?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("認証が必要です");

  const conditions = [];

  if (filters?.settlementMonth) {
    conditions.push(eq(receipts.settlementMonth, filters.settlementMonth));
  }
  if (filters?.companyId) {
    conditions.push(eq(receipts.companyId, filters.companyId));
  }
  if (filters?.accountItemId) {
    conditions.push(eq(receipts.accountItemId, filters.accountItemId));
  }
  if (filters?.claimantUserId) {
    conditions.push(eq(receipts.claimantUserId, filters.claimantUserId));
  }
  if (filters?.settlementStatus) {
    conditions.push(
      eq(receipts.settlementStatus, filters.settlementStatus)
    );
  }

  const result = await db
    .select({
      receipt: receipts,
      company: companies,
      accountItem: accountItems,
      claimant: users,
    })
    .from(receipts)
    .leftJoin(companies, eq(receipts.companyId, companies.id))
    .leftJoin(accountItems, eq(receipts.accountItemId, accountItems.id))
    .leftJoin(users, eq(receipts.claimantUserId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(receipts.createdAt));

  return result;
}

// ─────────────────────────────────────────────
// 領収書更新
// ─────────────────────────────────────────────
export async function updateReceipt(
  id: string,
  data: Partial<z.infer<typeof CreateReceiptSchema>>
) {
  const session = await auth();
  if (!session?.user) throw new Error("認証が必要です");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [updated] = await db
    .update(receipts)
    .set({ ...(data as any), updatedAt: new Date() })
    .where(eq(receipts.id, id))
    .returning();

  revalidatePath("/receipts");
  revalidatePath(`/receipts/${id}`);
  return updated;
}

// ─────────────────────────────────────────────
// 精算ステータス更新
// ─────────────────────────────────────────────
export async function updateSettlementStatus(
  ids: string[],
  status: "settled" | "unsettled",
  settlementDate?: string
) {
  const session = await auth();
  if (!session?.user) throw new Error("認証が必要です");

  for (const id of ids) {
    await db
      .update(receipts)
      .set({
        settlementStatus: status,
        settlementDate:
          status === "settled"
            ? settlementDate || new Date().toISOString().split("T")[0]
            : null,
        updatedAt: new Date(),
      })
      .where(eq(receipts.id, id));
  }

  revalidatePath("/settlement");
  revalidatePath("/receipts");
}

// ─────────────────────────────────────────────
// 領収書削除
// ─────────────────────────────────────────────
export async function deleteReceipt(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("認証が必要です");

  await db.delete(receipts).where(eq(receipts.id, id));

  revalidatePath("/receipts");
}

// ─────────────────────────────────────────────
// 今月の経費合計（会社別）
// ─────────────────────────────────────────────
export async function getMonthlyTotal(yearMonth: string) {
  const session = await auth();
  if (!session?.user) throw new Error("認証が必要です");

  const result = await db
    .select({
      companyId: receipts.companyId,
      companyName: companies.name,
      total: sql<number>`sum(${receipts.amount})`,
    })
    .from(receipts)
    .leftJoin(companies, eq(receipts.companyId, companies.id))
    .where(eq(receipts.settlementMonth, yearMonth))
    .groupBy(receipts.companyId, companies.name);

  return result;
}
