import { getBudgetVsActual, getBudgets } from "@/actions/budget-actions";
import { getCompanies, getAccountItems } from "@/actions/master-actions";
import { BudgetManager } from "@/components/budget-manager";
import { getCurrentMonth } from "@/lib/utils";

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const currentMonth = params.month || getCurrentMonth();
  const companyId = params.company;

  const [companies, accountItems, budgetVsActual] = await Promise.all([
    getCompanies(),
    getAccountItems(),
    getBudgetVsActual(currentMonth, companyId),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">予算管理</h1>
      <BudgetManager
        companies={companies}
        accountItems={accountItems}
        budgetVsActual={budgetVsActual}
        currentMonth={currentMonth}
        currentCompanyId={companyId}
      />
    </div>
  );
}
