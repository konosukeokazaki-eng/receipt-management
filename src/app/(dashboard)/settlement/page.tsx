import { getReceipts } from "@/actions/receipt-actions";
import { getCompanies, getUsers } from "@/actions/master-actions";
import { SettlementList } from "@/components/settlement-list";

export default async function SettlementPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const [receipts, companies, users] = await Promise.all([
    getReceipts({
      settlementMonth: params.month,
      companyId: params.company,
      settlementStatus: params.status,
    }),
    getCompanies(),
    getUsers(),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">精算管理</h1>
      <SettlementList
        receipts={receipts}
        companies={companies}
        users={users}
        currentFilters={{
          month: params.month,
          company: params.company,
          status: params.status,
        }}
      />
    </div>
  );
}
