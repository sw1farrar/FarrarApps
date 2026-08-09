import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listSavedViews } from "@/lib/data/saved-views";
import type {
  SavedView,
  Transaction,
  TransactionType,
} from "@/lib/types/database";
import { TransactionFormDialog } from "@/components/transactions/transaction-form-dialog";
import { ListFilters } from "@/components/filters/list-filters";
import { SavedViewsBar } from "@/components/filters/saved-views-bar";
import { TransactionsInvoiceLinks } from "@/components/transactions/transactions-invoice-links";

export default async function FinanceTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    accountId?: string;
    from?: string;
    to?: string;
    unreconciled?: string;
  }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const status = params.status?.trim() ?? "";
  const accountId = params.accountId?.trim() ?? "";
  const from = params.from?.trim() ?? "";
  const to = params.to?.trim() ?? "";
  const unreconciledOnly = params.unreconciled === "1";
  const supabase = await createClient();

  let transactionQuery = supabase
    .from("transactions")
    .select(
      "id, account_id, transfer_account_id, category_id, customer_id, project_id, invoice_id, type, amount, date, description, reference, receipt_path, reconciled_at, reconciled_by, created_by, created_at, updated_at, accounts!transactions_account_id_fkey(id, name), transfer_accounts:accounts!transactions_transfer_account_id_fkey(id, name), categories(id, name, type), customers(id, name), invoices(id, invoice_number)"
    )
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (
    status === "income" ||
    status === "expense" ||
    status === "transfer"
  ) {
    transactionQuery = transactionQuery.eq(
      "type",
      status as TransactionType
    );
  }
  if (accountId) {
    transactionQuery = transactionQuery.or(
      `account_id.eq.${accountId},transfer_account_id.eq.${accountId}`
    );
  }
  if (from) transactionQuery = transactionQuery.gte("date", from);
  if (to) transactionQuery = transactionQuery.lte("date", to);
  if (unreconciledOnly) {
    transactionQuery = transactionQuery.is("reconciled_at", null);
  }
  if (q) {
    const pattern = `%${q.replace(/[%_,]/g, "")}%`;
    transactionQuery = transactionQuery.or(
      `description.ilike.${pattern},reference.ilike.${pattern}`
    );
  }

  const [{ data: transactions }, savedViews, { data: accounts }] =
    await Promise.all([
      transactionQuery,
      listSavedViews("transactions"),
      supabase
        .from("accounts")
        .select("id, name")
        .eq("is_active", true)
        .order("name"),
    ]);
  const typedTransactions = (transactions ?? []) as unknown as Transaction[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-3">
        <TransactionFormDialog lazyLoad />
      </div>

      <div className="space-y-2">
        <ListFilters
          placeholder="Search descriptions or references"
          statusOptions={[
            { value: "income", label: "Payment received" },
            { value: "expense", label: "Expense" },
            { value: "transfer", label: "Transfer" },
          ]}
        />
        <form
          className="flex flex-wrap items-end gap-2"
          action="/finance/transactions"
        >
          {q ? <input type="hidden" name="q" value={q} /> : null}
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <label className="space-y-1 text-xs text-muted-foreground">
            Account
            <select
              name="accountId"
              defaultValue={accountId}
              className="flex h-8 w-44 rounded-md border border-input bg-background px-2 text-sm text-foreground"
            >
              <option value="">All accounts</option>
              {(accounts ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            From
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="flex h-8 rounded-md border border-input bg-background px-2 text-sm"
            />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            To
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="flex h-8 rounded-md border border-input bg-background px-2 text-sm"
            />
          </label>
          <label className="flex h-8 items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="unreconciled"
              value="1"
              defaultChecked={unreconciledOnly}
              className="size-3.5"
            />
            Unreconciled only
          </label>
          <button
            type="submit"
            className="inline-flex h-8 items-center rounded-md border border-border px-3 text-sm hover:bg-muted"
          >
            Apply
          </button>
          {(accountId || from || to || unreconciledOnly) && (
            <Link
              href={
                q || status
                  ? `/finance/transactions?${new URLSearchParams({
                      ...(q ? { q } : {}),
                      ...(status ? { status } : {}),
                    }).toString()}`
                  : "/finance/transactions"
              }
              className="text-sm text-muted-foreground hover:underline"
            >
              Clear extra filters
            </Link>
          )}
        </form>
        <SavedViewsBar
          entity="transactions"
          views={savedViews as SavedView[]}
        />
      </div>

      {typedTransactions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">No transactions match.</p>
        </div>
      ) : (
        <TransactionsInvoiceLinks transactions={typedTransactions} />
      )}
    </div>
  );
}
