import { auth } from "@/lib/auth";
import { getCompanies, getAccountItems, getUsers } from "@/actions/master-actions";
import { ReceiptForm } from "@/components/receipt-form";

export default async function NewReceiptPage() {
  const [companies, accountItems, users] = await Promise.all([
    getCompanies(),
    getAccountItems(),
    getUsers(),
  ]);

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        領収書登録（単票）
      </h1>
      <ReceiptForm
        companies={companies}
        accountItems={accountItems}
        users={users}
      />
    </div>
  );
}
