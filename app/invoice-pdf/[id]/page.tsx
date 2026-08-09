import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import type {
  CompanySettings,
  Customer,
  Invoice,
  InvoiceLineItem,
} from "@/lib/types/database";
import InvoicePdfClient from "@/components/invoices/invoice-pdf-client";

export default async function SharedInvoicePdfPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const { id } = await params;
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .single();

  if (!invoice) notFound();

  if (profile.role === "client") {
    const { data: member } = await supabase
      .from("customer_members")
      .select("id")
      .eq("user_id", profile.id)
      .eq("customer_id", invoice.customer_id)
      .maybeSingle();
    if (!member) {
      const { data: customer } = await supabase
        .from("customers")
        .select("id")
        .eq("portal_user_id", profile.id)
        .eq("id", invoice.customer_id)
        .maybeSingle();
      if (!customer) redirect("/portal");
    }
  }

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

  const typedCompany = (company as CompanySettings | null) ?? null;
  const typedInvoice = invoice as Invoice;
  const { loadInvoiceCardFee } = await import("@/lib/invoices/load-card-fee");
  const cardFee = await loadInvoiceCardFee(
    supabase,
    id,
    Number(typedInvoice.total),
    typedInvoice.paid_at
  );
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
      cardFee={cardFee}
    />
  );
}
