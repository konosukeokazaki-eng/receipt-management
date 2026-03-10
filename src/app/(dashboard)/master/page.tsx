import { getCompanies, getAccountItems, getUsers } from "@/actions/master-actions";
import { MasterTabs } from "@/components/master-tabs";

export default async function MasterPage() {
  const [companies, accountItems, users] = await Promise.all([
    getCompanies(),
    getAccountItems(),
    getUsers(),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">マスター設定</h1>
      <MasterTabs
        companies={companies}
        accountItems={accountItems}
        users={users}
      />
    </div>
  );
}
