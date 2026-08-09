import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Customer, Project } from "@/lib/types/database";
import { InvoiceForm } from "@/components/invoices/invoice-form";

export default async function NewFinanceInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; projectId?: string }>;
}) {
  const { customerId, projectId } = await searchParams;
  const supabase = await createClient();
  const [{ data: customers }, { data: projects }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, company, email")
      .order("name"),
    supabase.from("projects").select("id, name, customer_id").order("name"),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-muted-foreground">
          <Link href="/finance/invoices" className="hover:underline">
            Invoices
          </Link>{" "}
          / New
        </p>
        <h2 className="text-lg font-semibold tracking-tight">New invoice</h2>
      </div>
      <InvoiceForm
        customers={(customers ?? []) as Customer[]}
        projects={(projects ?? []) as Project[]}
        defaultCustomerId={customerId}
        defaultProjectId={projectId}
      />
    </div>
  );
}
