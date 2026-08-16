import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate, titleCase } from "@/lib/format";
import type {
  Account,
  CompanySettings,
  Customer,
  Invoice,
  InvoiceLineItem,
} from "@/lib/types/database";
import { InvoiceActions } from "@/components/invoices/invoice-actions";
import { InvoiceHowPaidCard } from "@/components/invoices/invoice-how-paid-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function FinanceInvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const openEmail = sp.email === "1" || sp.email === "true";
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id, customer_id, project_id, invoice_number, status, issue_date, due_date, notes, subtotal, tax, total, paid_at, created_by, created_at, updated_at, customers(id, name), projects(id, name)"
    )
    .eq("id", id)
    .single();

  if (!invoice) notFound();

  const [{ data: lines }, { data: accounts }, customerRes, { data: company }] =
    await Promise.all([
      supabase
        .from("invoice_line_items")
        .select("id, description, quantity, rate, amount, service_date")
        .eq("invoice_id", id)
        .order("sort_order"),
      supabase
        .from("accounts")
        .select("id, name, is_active")
        .eq("is_active", true)
        .order("name"),
      invoice.customer_id
        ? supabase
            .from("customers")
            .select("id, name, company, email, address, city, state, zip")
            .eq("id", invoice.customer_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("company_settings")
        .select("name, address, email, logo_path, invoice_terms")
        .limit(1)
        .maybeSingle(),
    ]);
  const customer = customerRes.data;

  const typedCompany = (company as CompanySettings | null) ?? null;
  const typed = invoice as unknown as Invoice;
  const typedLines = (lines ?? []) as InvoiceLineItem[];
  const { loadInvoiceCardFee } = await import("@/lib/invoices/load-card-fee");
  const cardFee = await loadInvoiceCardFee(
    supabase,
    id,
    Number(typed.total),
    typed.paid_at
  );
  const { data: logo } = typedCompany?.logo_path
    ? await supabase.storage
        .from("logos")
        .createSignedUrl(typedCompany.logo_path, 60 * 10)
    : { data: null };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            <Link href="/finance/invoices" className="hover:underline">
              Invoices
            </Link>{" "}
            / {typed.invoice_number}
          </p>
          <h2 className="text-lg font-semibold tracking-tight">
            {typed.invoice_number}
          </h2>
          <p className="text-sm text-muted-foreground">
            {typed.customers?.name || "No customer yet"} · issued{" "}
            {formatDate(typed.issue_date)} · due {formatDate(typed.due_date)}
          </p>
        </div>
        <div className="space-y-2">
          <div className="flex justify-end gap-2">
            <Badge variant="secondary">{titleCase(typed.status)}</Badge>
            {typed.status === "draft" ? (
              <Link
                href={`/finance/invoices/${typed.id}/edit`}
                className={buttonVariants({ size: "sm", variant: "outline" })}
              >
                Edit
              </Link>
            ) : null}
          </div>
          <InvoiceActions
            invoice={typed}
            accounts={(accounts ?? []) as Account[]}
            customer={(customer as Customer) ?? null}
            lines={typedLines}
            company={typedCompany}
            logoUrl={logo?.signedUrl ?? null}
            initialEmailOpen={openEmail}
          />
        </div>
      </div>

      <Card className="shadow-none">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm">Line items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {typedLines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>
                    {line.service_date ? (
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">
                          {formatDate(line.service_date)}
                        </p>
                        <p>{line.description}</p>
                      </div>
                    ) : (
                      line.description
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Number(line.quantity)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(line.rate)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(line.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="space-y-1 border-t border-border p-3 text-sm">
            <div className="flex justify-end gap-8">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="w-28 text-right tabular-nums">
                {formatCurrency(typed.subtotal)}
              </span>
            </div>
            <div className="flex justify-end gap-8">
              <span className="text-muted-foreground">Tax</span>
              <span className="w-28 text-right tabular-nums">
                {formatCurrency(typed.tax)}
              </span>
            </div>
            <div className="flex justify-end gap-8 font-medium">
              <span>
                {typed.status === "paid" ? "Amount paid" : "Total"}
              </span>
              <span className="w-28 text-right tabular-nums">
                {formatCurrency(typed.total)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {cardFee && cardFee.feeAmount > 0 ? (
        <InvoiceHowPaidCard
          invoice={typed}
          lines={typedLines}
          customer={(customer as Customer) ?? null}
          company={typedCompany}
          logoUrl={logo?.signedUrl ?? null}
          cardFee={cardFee}
        />
      ) : null}
    </div>
  );
}
