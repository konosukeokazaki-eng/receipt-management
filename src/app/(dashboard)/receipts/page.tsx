import { getReceipts } from "@/actions/receipt-actions";
import { getCompanies, getAccountItems, getUsers } from "@/actions/master-actions";
import { ReceiptList } from "@/components/receipt-list";
import Link from "next/link";
import { PlusCircle, Layers } from "lucide-react";

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const [receipts, companies, accountItems, users] = await Promise.all([
    getReceipts({
      settlementMonth: params.month,
      companyId: params.company,
      accountItemId: params.account,
      claimantUserId: params.user,
      settlementStatus: params.status,
    }),
    getCompanies(),
    getAccountItems(),
    getUsers(),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">領収書一覧</h1>
        <div className="flex gap-2">
          <Link
            href="/receipts/bulk"
            className="flex items-center gap-1.5 py-2 px-3 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
          >
            <Layers className="w-4 h-4" />
            一括登録
          </Link>
          <Link
            href="/receipts/new"
            className="flex items-center gap-1.5 py-2 px-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <PlusCircle className="w-4 h-4" />
            新規登録
          </Link>
        </div>
      </div>

      <ReceiptList
        receipts={receipts}
        companies={companies}
        accountItems={accountItems}
        users={users}
        currentFilters={{
          month: params.month,
          company: params.company,
          account: params.account,
          user: params.user,
          status: params.status,
        }}
      />
    </div>
  );
}
