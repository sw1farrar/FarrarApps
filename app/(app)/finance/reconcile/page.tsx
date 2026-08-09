import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listReconciliations } from "@/lib/data/reconciliations";
import { formatCurrency, formatDate, titleCase } from "@/lib/format";
import type { Account } from "@/lib/types/database";
import { StartReconcileForm } from "@/components/finance/start-reconcile-form";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function FinanceReconcilePage({
  searchParams,
}: {
  searchParams: Promise<{ accountId?: string }>;
}) {
  const { accountId } = await searchParams;
  const supabase = await createClient();
  const [list, { data: accounts }] = await Promise.all([
    listReconciliations(),
    supabase
      .from("accounts")
      .select("id, name, type, opening_balance, is_active, created_at, updated_at")
      .eq("is_active", true)
      .order("name"),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Start a reconciliation</h3>
        <StartReconcileForm
          accounts={(accounts ?? []) as Account[]}
          defaultAccountId={accountId}
        />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">History</h3>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No reconciliations yet.
          </p>
        ) : (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Statement date</TableHead>
                  <TableHead className="text-right">Statement bal.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((rec) => (
                  <TableRow key={rec.id}>
                    <TableCell>
                      <Link
                        href={`/finance/reconcile/${rec.id}`}
                        className="font-medium hover:underline"
                      >
                        {rec.accounts?.name || "Account"}
                      </Link>
                    </TableCell>
                    <TableCell>{formatDate(rec.statement_date)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(Number(rec.statement_balance))}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {titleCase(rec.status.replace("_", " "))}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(rec.created_at.slice(0, 10))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
