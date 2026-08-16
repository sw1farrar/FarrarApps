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
import {
  remittanceCompanyName,
  remittanceCopy,
  shouldShowCardRemittance,
} from "@/lib/invoices/card-fee-remittance";
import { formatDate } from "@/lib/format";
import type {
  CompanySettings,
  Customer,
  Invoice,
  InvoiceLineItem,
} from "@/lib/types/database";

function paidOnLabel(value: string | null | undefined) {
  if (!value) return "";
  // Timestamps: show local calendar day of the instant; pure YMD via formatDate
  return formatDate(value);
}

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
  remittance: {
    marginTop: 20,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    backgroundColor: "#fafaf8",
  },
  remittanceHeading: {
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 0.6,
    color: "#666",
    marginBottom: 6,
  },
  remittanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  remittanceLabel: { fontSize: 9, color: "#555", width: "78%" },
  remittanceValue: { fontSize: 9, textAlign: "right", width: "22%" },
  remittanceTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
  },
  remittanceTotalLabel: { fontSize: 9, fontWeight: 700, width: "78%" },
  remittanceTotalValue: {
    fontSize: 9,
    fontWeight: 700,
    textAlign: "right",
    width: "22%",
  },
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
  includeCardRemittance = false,
}: {
  invoice: Invoice;
  lines: InvoiceLineItem[];
  customer: Customer | null;
  company: CompanySettings | null;
  logoSrc: string;
  cardFee?: InvoiceCardFeeDisplay | null;
  /** Customer receipt only — remittance sits below booked invoice totals. */
  includeCardRemittance?: boolean;
}) {
  const showRemittance = shouldShowCardRemittance(
    includeCardRemittance,
    cardFee
  );
  const isPaid = invoice.status === "paid";
  const companyName = remittanceCompanyName(company?.name);
  const copy = remittanceCopy(companyName);

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
            Issued {formatDate(invoice.issue_date)} · Due{" "}
            {formatDate(invoice.due_date)}
          </Text>
          {isPaid ? (
            <Text style={styles.paidBadge}>
              PAID
              {invoice.paid_at ? ` · ${paidOnLabel(invoice.paid_at)}` : ""}
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
            <View style={styles.colDesc}>
              {line.service_date ? (
                <Text style={{ fontSize: 8, color: "#666", marginBottom: 2 }}>
                  {formatDate(line.service_date)}
                </Text>
              ) : null}
              <Text>{line.description}</Text>
            </View>
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
          <View style={styles.totalRowStrong}>
            <Text style={styles.totalLabelStrong}>
              {isPaid ? "Amount paid" : "Total"}
            </Text>
            <Text style={styles.totalValueStrong}>{money(invoice.total)}</Text>
          </View>
        </View>

        {showRemittance && cardFee ? (
          <View style={styles.remittance}>
            <Text style={styles.remittanceHeading}>{copy.heading}</Text>
            <View style={styles.remittanceRow}>
              <Text style={styles.remittanceLabel}>{copy.paidToLabel}</Text>
              <Text style={styles.remittanceValue}>
                {money(cardFee.invoiceAmount)}
              </Text>
            </View>
            <View style={styles.remittanceRow}>
              <Text style={styles.remittanceLabel}>{copy.feeLabel}</Text>
              <Text style={styles.remittanceValue}>
                {money(cardFee.feeAmount)}
              </Text>
            </View>
            <View style={styles.remittanceTotal}>
              <Text style={styles.remittanceTotalLabel}>
                {copy.cardTotalLabel}
              </Text>
              <Text style={styles.remittanceTotalValue}>
                {money(cardFee.chargeAmount)}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.terms}>
          <Text>Terms</Text>
          <Text>
            {invoice.notes ||
              company?.invoice_terms ||
              "Payment is due within 30 days of invoice date."}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
