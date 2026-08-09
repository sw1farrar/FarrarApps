import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import type {
  Customer,
  Invoice,
  InvoiceLineItem,
  Project,
} from "@/lib/types/database";

export default async function EditFinanceInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: invoice },
    { data: lines },
    { data: customers },
    { data: projects },
  ] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        "id, customer_id, project_id, invoice_number, issue_date, due_date, notes, tax"
      )
      .eq("id", id)
      .single(),
    supabase
      .from("invoice_line_items")
      .select("description, quantity, rate")
      .eq("invoice_id", id)
      .order("sort_order"),
    supabase
      .from("customers")
      .select("id, name, company, email")
      .order("name"),
    supabase.from("projects").select("id, name, customer_id").order("name"),
  ]);

  if (!invoice) notFound();

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-muted-foreground">
          <Link href={`/finance/invoices/${id}`} className="hover:underline">
            {invoice.invoice_number}
          </Link>{" "}
          / Edit
        </p>
        <h2 className="text-lg font-semibold tracking-tight">Edit invoice</h2>
        <p className="text-sm text-muted-foreground">
          Draft invoices can be revised before sending.
        </p>
      </div>
      <InvoiceForm
        customers={(customers ?? []) as Customer[]}
        projects={(projects ?? []) as Project[]}
        invoice={invoice as Invoice}
        lines={(lines ?? []) as InvoiceLineItem[]}
      />
    </div>
  );
}
