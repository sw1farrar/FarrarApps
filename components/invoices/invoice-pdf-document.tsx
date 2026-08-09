import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import type { InvoiceCardFeeDisplay } from "@/lib/invoices/card-fee-display";
import type {
  CompanySettings,
  Customer,
  Invoice,
  InvoiceLineItem,
} from "@/lib/types/database";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111",
    backgroundColor: "#ffffff",
  },
  logoWrap: {
    alignItems: "center",
    marginBottom: 24,
  },
  logo: { width: 160, height: 48, objectFit: "contain" },
  meta: { marginBottom: 20 },
  title: { fontSize: 16, marginBottom: 8, fontWeight: 700 },
  paidBadge: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: 700,
    color: "#166534",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    paddingVertical: 6,
  },
  th: { fontWeight: 700, borderBottomWidth: 1, borderBottomColor: "#111" },
  colDesc: { width: "46%" },
  colQty: { width: "18%", textAlign: "right" },
  colRate: { width: "18%", textAlign: "right" },
  colAmt: { width: "18%", textAlign: "right" },
  totals: { marginTop: 16, alignItems: "flex-end" },
  totalRow: {
    flexDirection: "row",
    width: 220,
    justifyContent: "space-between",
    marginBottom: 4,
  },
  totalRowStrong: {
    flexDirection: "row",
    width: 220,
    justifyContent: "space-between",
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#111",
  },
  totalLabelStrong: { fontSize: 11, fontWeight: 700 },
  totalValueStrong: { fontSize: 11, fontWeight: 700 },
  terms: { marginTop: 36, color: "#555", lineHeight: 1.4 },
});

function money(n: number) {
  return `$${Number(n).toFixed(2)}`;
}

export function InvoicePdfDocument({
  invoice,
  lines,
  customer,
  company,
  logoSrc,
  cardFee,
}: {
  invoice: Invoice;
  lines: InvoiceLineItem[];
  customer: Customer | null;
  company: CompanySettings | null;
  logoSrc: string;
  /** When paid online with pass-through fee — final total must match charge. */
  cardFee?: InvoiceCardFeeDisplay | null;
}) {
  const showFee = Boolean(cardFee && cardFee.feeAmount > 0);
  const isPaid = invoice.status === "paid" || Boolean(cardFee);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.logoWrap}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={logoSrc} style={styles.logo} />
        </View>

        <View style={styles.meta}>
          <Text style={styles.title}>Invoice {invoice.invoice_number}</Text>
          <Text>
            {company?.name || "Farrar Apps"}
            {company?.address ? ` · ${company.address}` : ""}
          </Text>
          <Text>
            Bill to: {customer?.name || "Customer"}
            {customer?.company ? ` (${customer.company})` : ""}
          </Text>
          {customer?.address ||
          customer?.city ||
          customer?.state ||
          customer?.zip ? (
            <Text>
              {[
                customer?.address,
                [customer?.city, customer?.state].filter(Boolean).join(", "),
                customer?.zip,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          ) : null}
          {customer?.email ? <Text>{customer.email}</Text> : null}
          <Text>
            Issued {invoice.issue_date} · Due {invoice.due_date}
          </Text>
          {isPaid ? (
            <Text style={styles.paidBadge}>
              PAID
              {cardFee?.paidAt || invoice.paid_at
                ? ` · ${String(cardFee?.paidAt || invoice.paid_at).slice(0, 10)}`
                : ""}
              {showFee ? " · includes card processing fee" : ""}
            </Text>
          ) : null}
        </View>

        <View style={[styles.row, styles.th]}>
          <Text style={styles.colDesc}>Description</Text>
          <Text style={styles.colQty}>Qty</Text>
          <Text style={styles.colRate}>Rate</Text>
          <Text style={styles.colAmt}>Amount</Text>
        </View>
        {lines.map((line) => (
          <View key={line.id} style={styles.row}>
            <Text style={styles.colDesc}>{line.description}</Text>
            <Text style={styles.colQty}>{Number(line.quantity)}</Text>
            <Text style={styles.colRate}>{money(line.rate)}</Text>
            <Text style={styles.colAmt}>{money(line.amount)}</Text>
          </View>
        ))}

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text>Subtotal</Text>
            <Text>{money(invoice.subtotal)}</Text>
          </View>
          {Number(invoice.tax) !== 0 ? (
            <View style={styles.totalRow}>
              <Text>Tax</Text>
              <Text>{money(invoice.tax)}</Text>
            </View>
          ) : null}
          {showFee && cardFee ? (
            <>
              <View style={styles.totalRow}>
                <Text>Invoice total</Text>
                <Text>{money(cardFee.invoiceAmount)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text>Card processing fee</Text>
                <Text>{money(cardFee.feeAmount)}</Text>
              </View>
              <View style={styles.totalRowStrong}>
                <Text style={styles.totalLabelStrong}>
                  {isPaid ? "Amount paid" : "Total due"}
                </Text>
                <Text style={styles.totalValueStrong}>
                  {money(cardFee.chargeAmount)}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.totalRowStrong}>
              <Text style={styles.totalLabelStrong}>
                {isPaid ? "Amount paid" : "Total"}
              </Text>
              <Text style={styles.totalValueStrong}>
                {money(invoice.total)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.terms}>
          <Text>Terms</Text>
          <Text>
            {invoice.notes ||
              company?.invoice_terms ||
              "Payment is due within 30 days of invoice date."}
          </Text>
          {showFee && cardFee ? (
            <Text>
              {`Card processing fee of ${money(cardFee.feeAmount)} was charged so the invoice principal of ${money(cardFee.invoiceAmount)} is received in full. Total charged: ${money(cardFee.chargeAmount)}.`}
            </Text>
          ) : null}
        </View>
      </Page>
    </Document>
  );
}
