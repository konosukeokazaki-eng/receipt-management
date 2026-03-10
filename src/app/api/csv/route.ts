import { auth } from "@/lib/auth";
import { db, receipts, companies, accountItems, users } from "@/db";
import { eq, and } from "drizzle-orm";
import { generateYayoiCsv, generateGeneralCsv } from "@/lib/csv-export";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const format = searchParams.get("format") || "general"; // 'yayoi' | 'general'
  const settlementMonth = searchParams.get("month");
  const companyId = searchParams.get("companyId");
  const status = searchParams.get("status"); // 'all' | 'settled' | 'unsettled'

  const conditions = [];
  if (settlementMonth) {
    conditions.push(eq(receipts.settlementMonth, settlementMonth));
  }
  if (companyId) {
    conditions.push(eq(receipts.companyId, companyId));
  }
  if (status && status !== "all") {
    conditions.push(eq(receipts.settlementStatus, status));
  }

  const rows = await db
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
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const csvData = rows.map((row) => ({
    receiptNo: row.receipt.receiptNo,
    settlementMonth: row.receipt.settlementMonth,
    receiptDate: row.receipt.receiptDate,
    storeName: row.receipt.storeName,
    purpose: row.receipt.purpose,
    amount: row.receipt.amount,
    hasInvoice: row.receipt.hasInvoice,
    accountItemName: row.accountItem?.name || "",
    yayoiAccountName: row.accountItem?.yayoiName || null,
    taxCategory: row.accountItem?.taxCategory || "taxable",
    companyName: row.company?.name || "",
    claimantName: row.claimant?.displayName || "",
    settlementStatus: row.receipt.settlementStatus,
    settlementDate: row.receipt.settlementDate,
    fileName: row.receipt.fileName,
  }));

  const csvContent =
    format === "yayoi"
      ? generateYayoiCsv(csvData)
      : generateGeneralCsv(csvData);

  const fileName =
    format === "yayoi"
      ? `yayoi_${settlementMonth || "all"}.csv`
      : `receipts_${settlementMonth || "all"}.csv`;

  return new Response(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
