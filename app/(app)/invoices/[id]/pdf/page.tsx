import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  CompanySettings,
  Customer,
  Invoice,
  InvoiceLineItem,
} from "@/lib/types/database";
import InvoicePdfClient from "./pdf-client";

export default async function InvoicePdfPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .single();

  if (!invoice) notFound();

  const [{ data: lines }, { data: customer }, { data: company }] =
    await Promise.all([
      supabase
        .from("invoice_line_items")
        .select("*")
        .eq("invoice_id", id)
        .order("sort_order"),
      supabase
        .from("customers")
        .select("*")
        .eq("id", invoice.customer_id)
        .single(),
      supabase.from("company_settings").select("*").limit(1).maybeSingle(),
    ]);

  return (
    <InvoicePdfClient
      invoice={invoice as Invoice}
      lines={(lines ?? []) as InvoiceLineItem[]}
      customer={(customer as Customer) ?? null}
      company={(company as CompanySettings) ?? null}
    />
  );
}
