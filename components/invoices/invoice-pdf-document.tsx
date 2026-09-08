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
import {
  invoiceBillToName,
  invoiceCustomerAddress,
  invoiceLinesHaveDates,
} from "@/lib/invoices/invoice-document";
import { formatDate } from "@/lib/format";
import type {
  CompanySettings,
  Customer,
  Invoice,
  InvoiceLineItem,
} from "@/lib/types/database";

function paidOnLabel(value: string | null | undefined) {
  if (!value) return "";
  return formatDate(value);
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 22,
    paddingHorizontal: 24,
    paddingBottom: 28,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#111",
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  brand: {
    width: "58%",
    paddingRight: 10,
  },
  logo: { width: 108, height: 28, objectFit: "contain", marginBottom: 3 },
  companyName: { fontSize: 9, fontWeight: 700 },
  companyAddress: { fontSize: 8, color: "#555", marginTop: 1 },
  meta: {
    width: "42%",
    alignItems: "flex-end",
  },
  metaKicker: {
    fontSize: 8,
    letterSpacing: 1.2,
    color: "#666",
    marginBottom: 1,
    fontWeight: 700,
  },
  title: { fontSize: 13, fontWeight: 700, marginBottom: 3 },
  metaLine: { fontSize: 8, marginBottom: 1, textAlign: "right" },
  metaMuted: { color: "#666" },
  paidBadge: {
    marginTop: 2,
    fontSize: 8,
    fontWeight: 700,
    color: "#166534",
  },
  billTo: {
    marginBottom: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
  },
  billToLabel: {
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 0.6,
    color: "#666",
    marginBottom: 2,
  },
  billToName: { fontSize: 9 },
  billToDetail: { fontSize: 8, color: "#555", marginTop: 1 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e5e5",
    paddingVertical: 3,
    alignItems: "flex-start",
  },
  th: {
    fontWeight: 700,
    fontSize: 7,
    letterSpacing: 0.4,
    color: "#444",
    borderBottomWidth: 1,
    borderBottomColor: "#111",
    paddingTop: 2,
    paddingBottom: 4,
    textTransform: "uppercase",
  },
  colDate: { width: "18%" },
  colDesc: { width: "42%" },
  colDescWide: { width: "60%" },
  colQty: { width: "12%", textAlign: "right" },
  colRate: { width: "14%", textAlign: "right" },
  colAmt: { width: "14%", textAlign: "right" },
  dateText: { fontSize: 8, color: "#555" },
  totals: { marginTop: 8, alignItems: "flex-end" },
  totalRow: {
    flexDirection: "row",
    width: 180,
    justifyContent: "space-between",
    marginBottom: 2,
  },
  totalRowStrong: {
    flexDirection: "row",
    width: 180,
    justifyContent: "space-between",
    marginTop: 2,
    paddingTop: 3,
    borderTopWidth: 1,
    borderTopColor: "#111",
  },
  totalLabelStrong: { fontSize: 10, fontWeight: 700 },
  totalValueStrong: { fontSize: 10, fontWeight: 700 },
  terms: { marginTop: 10, paddingTop: 6, borderTopWidth: 1, borderTopColor: "#e5e5e5" },
  termsHeading: { fontSize: 8, fontWeight: 700, color: "#444", marginBottom: 2 },
  termsBody: { fontSize: 8, color: "#555", lineHeight: 1.3 },
  remittance: {
    marginTop: 8,
    padding: 6,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    backgroundColor: "#fafaf8",
  },
  remittanceHeading: {
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 0.6,
    color: "#666",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  remittanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  remittanceLabel: { fontSize: 8, color: "#555", width: "78%" },
  remittanceValue: { fontSize: 8, textAlign: "right", width: "22%" },
  remittanceTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 3,
    paddingTop: 3,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
  },
  remittanceTotalLabel: { fontSize: 8, fontWeight: 700, width: "78%" },
  remittanceTotalValue: {
    fontSize: 8,
    fontWeight: 700,
    textAlign: "right",
    width: "22%",
  },
  pageNumber: {
    position: "absolute",
    bottom: 12,
    left: 24,
    right: 24,
    fontSize: 8,
    color: "#999",
    textAlign: "center",
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
  const billTo = invoiceBillToName(customer);
  const customerAddress = invoiceCustomerAddress(customer);
  const showDate = invoiceLinesHaveDates(lines);
  const descCol = showDate ? styles.colDesc : styles.colDescWide;

  return (
    <Document>
      <Page size="LETTER" style={styles.page} wrap>
        <View wrap={false}>
          <View style={styles.header}>
            <View style={styles.brand}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image src={logoSrc} style={styles.logo} />
              <Text style={styles.companyName}>{companyName}</Text>
              {company?.address ? (
                <Text style={styles.companyAddress}>{company.address}</Text>
              ) : null}
            </View>
            <View style={styles.meta}>
              <Text style={styles.metaKicker}>INVOICE</Text>
              <Text style={styles.title}>{invoice.invoice_number}</Text>
              <Text style={styles.metaLine}>
                <Text style={styles.metaMuted}>Issued </Text>
                {formatDate(invoice.issue_date)}
              </Text>
              <Text style={styles.metaLine}>
                <Text style={styles.metaMuted}>Due </Text>
                {formatDate(invoice.due_date)}
              </Text>
              {isPaid ? (
                <Text style={styles.paidBadge}>
                  PAID
                  {invoice.paid_at ? ` · ${paidOnLabel(invoice.paid_at)}` : ""}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.billTo}>
            <Text style={styles.billToLabel}>BILL TO</Text>
            <Text style={styles.billToName}>{billTo}</Text>
            {customerAddress ? (
              <Text style={styles.billToDetail}>{customerAddress}</Text>
            ) : null}
            {customer?.email ? (
              <Text style={styles.billToDetail}>{customer.email}</Text>
            ) : null}
          </View>
        </View>

        <View style={[styles.row, styles.th]} wrap={false}>
          {showDate ? <Text style={styles.colDate}>Date</Text> : null}
          <Text style={descCol}>Description</Text>
          <Text style={styles.colQty}>Qty</Text>
          <Text style={styles.colRate}>Rate</Text>
          <Text style={styles.colAmt}>Amount</Text>
        </View>
        {lines.map((line) => (
          <View key={line.id} style={styles.row} wrap={false}>
            {showDate ? (
              <Text style={[styles.colDate, styles.dateText]}>
                {line.service_date ? formatDate(line.service_date) : ""}
              </Text>
            ) : null}
            <Text style={descCol}>{line.description}</Text>
            <Text style={styles.colQty}>{Number(line.quantity)}</Text>
            <Text style={styles.colRate}>{money(line.rate)}</Text>
            <Text style={styles.colAmt}>{money(line.amount)}</Text>
          </View>
        ))}

        <View wrap={false}>
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
            <Text style={styles.termsHeading}>Terms</Text>
            <Text style={styles.termsBody}>
              {invoice.notes ||
                company?.invoice_terms ||
                "Payment is due within 30 days of invoice date."}
            </Text>
          </View>
        </View>

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            totalPages > 1
              ? `${invoice.invoice_number}  ·  ${pageNumber} / ${totalPages}`
              : ""
          }
          fixed
        />
      </Page>
    </Document>
  );
}
