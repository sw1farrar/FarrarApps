import Link from "next/link";
import { notFound } from "next/navigation";
import { getReconciliation } from "@/lib/data/reconciliations";
import { formatDate } from "@/lib/format";
import { ReconcileWorkspace } from "@/components/finance/reconcile-workspace";

export default async function FinanceReconcileDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getReconciliation(id);
  if (!detail.ok) notFound();

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-muted-foreground">
          <Link href="/finance/reconcile" className="hover:underline">
            Reconcile
          </Link>{" "}
          / {detail.account.name}
        </p>
        <h2 className="text-lg font-semibold tracking-tight">
          {detail.account.name}
        </h2>
        <p className="text-sm text-muted-foreground">
          Statement date {formatDate(detail.reconciliation.statement_date)}
        </p>
      </div>

      <ReconcileWorkspace
        reconciliation={detail.reconciliation}
        account={detail.account}
        candidates={detail.candidates}
        initialSelectedIds={detail.selectedIds}
        initialDifference={detail.difference}
      />
    </div>
  );
}
