import { getCompanies } from "@/actions/master-actions";
import { CsvExport } from "@/components/csv-export";
import { getCurrentMonth } from "@/lib/utils";

export default async function CsvPage() {
  const companies = await getCompanies();

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">CSV出力</h1>
      <CsvExport companies={companies} defaultMonth={getCurrentMonth()} />
    </div>
  );
}
