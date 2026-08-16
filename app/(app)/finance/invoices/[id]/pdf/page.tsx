import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  CompanySettings,
  Customer,
  Invoice,
  InvoiceLineItem,
} from "@/lib/types/database";
import InvoicePdfClient from "@/components/invoices/invoice-pdf-client";

export default async function FinanceInvoicePdfPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id, customer_id, invoice_number, status, issue_date, due_date, notes, subtotal, tax, total, paid_at"
    )
    .eq("id", id)
    .single();

  if (!invoice) notFound();

  const [{ data: lines }, { data: customer }, { data: company }] =
    await Promise.all([
      supabase
        .from("invoice_line_items")
        .select("id, description, quantity, rate, amount")
        .eq("invoice_id", id)
        .order("sort_order"),
      supabase
        .from("customers")
        .select("id, name, company, email, address, city, state, zip")
        .eq("id", invoice.customer_id)
        .single(),
      supabase
        .from("company_settings")
        .select("name, address, logo_path, invoice_terms")
        .limit(1)
        .maybeSingle(),
    ]);

  const typedCompany = (company as CompanySettings | null) ?? null;
  const typedInvoice = invoice as Invoice;
  const { data: logo } = typedCompany?.logo_path
    ? await supabase.storage
        .from("logos")
        .createSignedUrl(typedCompany.logo_path, 60 * 10)
    : { data: null };

  return (
    <InvoicePdfClient
      invoice={typedInvoice}
      lines={(lines ?? []) as InvoiceLineItem[]}
      customer={(customer as Customer) ?? null}
      company={typedCompany}
      initialLogoSrc={logo?.signedUrl ?? undefined}
    />
  );
}
