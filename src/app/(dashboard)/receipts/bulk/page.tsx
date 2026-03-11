import { getAccountItems, getUsers } from "@/actions/master-actions";
import { BulkReceiptForm } from "@/components/bulk-receipt-form";

export default async function BulkReceiptPage() {
  const [accountItems, users] = await Promise.all([
    getAccountItems(),
    getUsers(),
  ]);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        領収書登録（一括）
      </h1>
      <BulkReceiptForm
        accountItems={accountItems}
        users={users}
      />
    </div>
  );
}
