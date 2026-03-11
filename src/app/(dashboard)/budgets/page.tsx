import { getBudgetVsActual } from "@/actions/budget-actions";
import { getCompanies, getAccountItems } from "@/actions/master-actions";
import { BudgetManager } from "@/components/budget-manager";
import { getFiscalYear } from "@/lib/receipt-no";
import { getCurrentMonth } from "@/lib/utils";

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const currentMonth = getCurrentMonth();

  // デフォルトは3月決算（日本で最も一般的）で現在の会計年度を算出
  const defaultFiscalYear = getFiscalYear(currentMonth, 3);
  const fiscalYear = params.year ? parseInt(params.year) : defaultFiscalYear;
  const companyId = params.company;

  const [companies, accountItems, budgetVsActual] = await Promise.all([
    getCompanies(),
    getAccountItems(),
    getBudgetVsActual(fiscalYear, companyId),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">予算管理</h1>
      <BudgetManager
        companies={companies}
        accountItems={accountItems}
        budgetVsActual={budgetVsActual}
        currentFiscalYear={fiscalYear}
        currentCompanyId={companyId}
      />
    </div>
  );
}
