import { getReportsBundle } from "@/lib/data/reports";
import {
  ReportsClient,
  type ReportKey,
} from "@/components/reports/reports-client";

export default async function FinanceReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; report?: string }>;
}) {
  const params = await searchParams;
  const report = (
    ["pl", "ar", "expenses", "income"].includes(params.report || "")
      ? params.report
      : "pl"
  ) as ReportKey;

  const data = await getReportsBundle(params.from, params.to);

  return (
    <div className="space-y-4">
      <ReportsClient
        report={report}
        from={data.from}
        to={data.to}
        income={data.income}
        expenses={data.expenses}
        profit={data.profit}
        transfers={data.transfers}
        transferCount={data.transferCount}
        incomeCount={data.incomeCount}
        expenseCount={data.expenseCount}
        expensesByCategory={data.expensesByCategory}
        incomeByClient={data.incomeByCustomer}
        incomeByCategory={data.incomeByCategory}
        byDay={data.byDay}
        arRows={data.ar.byCustomer}
        arTotals={data.ar.totals}
        arInvoices={data.ar.invoices}
        plRows={data.plRows}
        transferRows={data.transferRows}
      />
    </div>
  );
}
