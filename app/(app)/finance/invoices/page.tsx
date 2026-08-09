import { createClient } from "@/lib/supabase/server";
import { listSavedViews } from "@/lib/data/saved-views";
import type { InvoiceStatus, SavedView } from "@/lib/types/database";
import {
  InvoicesTableClient,
  type InvoiceListRow,
} from "@/components/invoices/invoices-table-client";
import { InvoiceFormDialog } from "@/components/invoices/invoice-form-dialog";
import { ListFilters } from "@/components/filters/list-filters";
import { SavedViewsBar } from "@/components/filters/saved-views-bar";

export default async function FinanceInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const status = params.status?.trim() ?? "";
  const supabase = await createClient();
  let query = supabase
    .from("invoices")
    .select(
      "id, invoice_number, status, issue_date, due_date, total, customers(id, name)"
    )
    .order("issue_date", { ascending: false });

  if (status) query = query.eq("status", status as InvoiceStatus);
  if (q) {
    const pattern = `%${q.replace(/[%_,]/g, "")}%`;
    query = query.ilike("invoice_number", pattern);
  }

  const [{ data }, savedViews] = await Promise.all([
    query,
    listSavedViews("invoices"),
  ]);

  const invoices = (data ?? []) as unknown as InvoiceListRow[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-3">
        <InvoiceFormDialog />
      </div>

      <div className="space-y-2">
        <ListFilters
          placeholder="Search invoices"
          statusOptions={[
            { value: "draft", label: "Draft" },
            { value: "sent", label: "Sent" },
            { value: "paid", label: "Paid" },
            { value: "overdue", label: "Overdue" },
          ]}
        />
        <SavedViewsBar entity="invoices" views={savedViews as SavedView[]} />
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-16 text-center">
          <p className="text-sm font-medium">No invoices yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create an invoice from a customer or project.
          </p>
          <div className="mt-4 flex justify-center">
            <InvoiceFormDialog />
          </div>
        </div>
      ) : (
        <InvoicesTableClient invoices={invoices} />
      )}
    </div>
  );
}
