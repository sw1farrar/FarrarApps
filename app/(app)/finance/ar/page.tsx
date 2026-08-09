import Link from "next/link";
import { getAccountsReceivableOverview } from "@/lib/data/balances";
import { formatCurrency } from "@/lib/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function FinanceArPage() {
  const { totals, byCustomer } = await getAccountsReceivableOverview();

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="shadow-none">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-xs">Open AR</CardDescription>
            <CardTitle className="text-xl tabular-nums">
              {formatCurrency(totals.openTotal)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="shadow-none">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-xs">Overdue</CardDescription>
            <CardTitle className="text-xl tabular-nums">
              {formatCurrency(totals.overdueTotal)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="shadow-none">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-xs">Open invoices</CardDescription>
            <CardTitle className="text-xl tabular-nums">
              {totals.openCount}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="shadow-none">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm">By customer</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium text-right">Open</th>
                  <th className="px-3 py-2 font-medium text-right">Current</th>
                  <th className="px-3 py-2 font-medium text-right">1–30</th>
                  <th className="px-3 py-2 font-medium text-right">31–60</th>
                  <th className="px-3 py-2 font-medium text-right">61+</th>
                  <th className="px-3 py-2 font-medium text-right">Invoices</th>
                </tr>
              </thead>
              <tbody>
                {byCustomer.length ? (
                  byCustomer.map((row) => (
                    <tr
                      key={row.customerId}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-3 py-2">
                        <Link
                          href={`/finance/ar/${row.customerId}`}
                          className="font-medium hover:underline"
                        >
                          {row.customerName}
                        </Link>
                        {row.company ? (
                          <p className="text-xs text-muted-foreground">
                            {row.company}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCurrency(row.openTotal)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {formatCurrency(row.aging.current)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {formatCurrency(row.aging.days30)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {formatCurrency(row.aging.days60)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {formatCurrency(row.aging.days90)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {row.openCount}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-6 text-center text-muted-foreground"
                    >
                      No open receivables.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
