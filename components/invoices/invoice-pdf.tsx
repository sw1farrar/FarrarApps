"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  PDFViewer,
} from "@react-pdf/renderer";
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
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  logo: { width: 140, height: 40, objectFit: "contain" },
  apps: { fontSize: 18, fontWeight: 700, letterSpacing: 2, textAlign: "right" },
  meta: { marginBottom: 20 },
  title: { fontSize: 16, marginBottom: 8, fontWeight: 700 },
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
  totalRow: { flexDirection: "row", width: 200, justifyContent: "space-between", marginBottom: 4 },
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
}: {
  invoice: Invoice;
  lines: InvoiceLineItem[];
  customer: Customer | null;
  company: CompanySettings | null;
  logoSrc: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={logoSrc} style={styles.logo} />
          <Text style={styles.apps}>APPS</Text>
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
          <Text>
            Issued {invoice.issue_date} · Due {invoice.due_date} · Status{" "}
            {invoice.status}
          </Text>
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
          <View style={styles.totalRow}>
            <Text>Tax</Text>
            <Text>{money(invoice.tax)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>Total</Text>
            <Text>{money(invoice.total)}</Text>
          </View>
        </View>

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

export function InvoicePdfViewer(props: {
  invoice: Invoice;
  lines: InvoiceLineItem[];
  customer: Customer | null;
  company: CompanySettings | null;
  logoSrc: string;
}) {
  return (
    <PDFViewer width="100%" height="100%" showToolbar>
      <InvoicePdfDocument {...props} />
    </PDFViewer>
  );
}
