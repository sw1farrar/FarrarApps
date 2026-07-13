import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate, titleCase } from "@/lib/format";
import type {
  Account,
  Invoice,
  InvoiceLineItem,
} from "@/lib/types/database";
import { InvoiceActions } from "@/components/invoices/invoice-actions";
import { Badge } from "@/components/ui/badge";
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

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, customers(id, name, email, company), projects(id, name)")
    .eq("id", id)
    .single();

  if (!invoice) notFound();

  const [{ data: lines }, { data: accounts }] = await Promise.all([
    supabase
      .from("invoice_line_items")
      .select("*")
      .eq("invoice_id", id)
      .order("sort_order"),
    supabase.from("accounts").select("*").eq("is_active", true).order("name"),
  ]);

  const typed = invoice as Invoice;
  const typedLines = (lines ?? []) as InvoiceLineItem[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            <Link href="/invoices" className="hover:underline">
              Invoices
            </Link>{" "}
            / {typed.invoice_number}
          </p>
          <h1 className="text-lg font-semibold tracking-tight">
            {typed.invoice_number}
          </h1>
          <p className="text-sm text-muted-foreground">
            {typed.customers?.name} · issued {formatDate(typed.issue_date)} · due{" "}
            {formatDate(typed.due_date)}
          </p>
        </div>
        <div className="space-y-2">
          <Badge variant="secondary">{titleCase(typed.status)}</Badge>
          <InvoiceActions
            invoice={typed}
            accounts={(accounts ?? []) as Account[]}
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
                  <TableCell>{line.description}</TableCell>
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
              <span className="tabular-nums w-24 text-right">
                {formatCurrency(typed.subtotal)}
              </span>
            </div>
            <div className="flex justify-end gap-8">
              <span className="text-muted-foreground">Tax</span>
              <span className="tabular-nums w-24 text-right">
                {formatCurrency(typed.tax)}
              </span>
            </div>
            <div className="flex justify-end gap-8 font-medium">
              <span>Total</span>
              <span className="tabular-nums w-24 text-right">
                {formatCurrency(typed.total)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
