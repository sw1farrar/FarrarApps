import type { Customer, InvoiceLineItem } from "@/lib/types/database";

export function invoiceBillToName(customer: Customer | null): string {
  const name = customer?.name?.trim() || "Customer";
  const company = customer?.company?.trim();
  return company ? `${name} (${company})` : name;
}

export function invoiceCustomerAddress(customer: Customer | null): string | null {
  if (!customer) return null;
  const cityState = [customer.city, customer.state].filter(Boolean).join(", ");
  const parts = [customer.address, cityState, customer.zip].filter(
    (part) => Boolean(part && String(part).trim())
  );
  return parts.length ? parts.join(" · ") : null;
}

export function invoiceLinesHaveDates(lines: InvoiceLineItem[]): boolean {
  return lines.some((line) => Boolean(line.service_date));
}

/**
 * Letter preview metrics. Keep in sync with invoice-paper-preview padding
 * and type sizes so row packing matches the on-screen sheet.
 */
export const INVOICE_PREVIEW_PAGE_WIDTH = 520;
export const INVOICE_PREVIEW_PAGE_HEIGHT =
  (INVOICE_PREVIEW_PAGE_WIDTH * 11) / 8.5;

const PAGE_PAD_Y = 28;
const PAGE_NUM_H = 20;
const SAFETY = 20;
const USABLE_H =
  INVOICE_PREVIEW_PAGE_HEIGHT - PAGE_PAD_Y - PAGE_NUM_H - SAFETY;
const TABLE_HEAD_H = 18;
const CONT_HEADER_H = 16;
const CONT_THEAD_ONLY = TABLE_HEAD_H + CONT_HEADER_H;
const BASE_ROW_H = 18;
const WRAP_LINE_H = 12;

function estimateHeaderHeight(input: {
  hasCompanyAddress: boolean;
  hasCustomerAddress: boolean;
  hasCustomerEmail: boolean;
  isPaid: boolean;
}): number {
  const rightCol = 12 + 16 + 14 + 14 + (input.isPaid ? 14 : 0);
  const leftCol = 32 + 8 + 14 + (input.hasCompanyAddress ? 12 : 0);
  const top = Math.max(rightCol, leftCol);
  const billToLines =
    1 + (input.hasCustomerAddress ? 1 : 0) + (input.hasCustomerEmail ? 1 : 0);
  return top + 16 + 12 + 12 + billToLines * 13;
}

function estimateRowHeight(line: InvoiceLineItem, charsPerLine: number): number {
  const len = (line.description || "").length;
  const wraps = Math.max(1, Math.ceil(len / charsPerLine));
  return BASE_ROW_H + (wraps - 1) * WRAP_LINE_H;
}

function estimateFooterHeight(input: {
  showRemittance: boolean;
  showTax: boolean;
  terms: string;
}): number {
  const totals = 14 + (input.showTax ? 14 : 0) + 24 + 10;
  const remittance = input.showRemittance ? 64 : 0;
  const termLines = Math.max(1, Math.ceil((input.terms || "").length / 80));
  const terms = 18 + termLines * 12;
  return totals + remittance + terms + 12;
}

export function paginateInvoiceRows(input: {
  rowHeights: number[];
  firstBodyBudget: number;
  contBodyBudget: number;
  footerHeight: number;
}): number[][] {
  const { rowHeights, footerHeight } = input;
  if (rowHeights.length === 0) return [[]];

  const pages: number[][] = [];
  let offset = 0;

  while (offset < rowHeights.length) {
    const budget =
      pages.length === 0 ? input.firstBodyBudget : input.contBodyBudget;
    let remainingHeight = 0;
    for (let i = offset; i < rowHeights.length; i++) {
      remainingHeight += rowHeights[i];
    }

    if (remainingHeight + footerHeight <= budget) {
      const rest: number[] = [];
      for (let i = offset; i < rowHeights.length; i++) rest.push(i);
      pages.push(rest);
      break;
    }

    const page: number[] = [];
    let used = 0;
    while (offset < rowHeights.length) {
      const h = rowHeights[offset];
      if (page.length > 0 && used + h > budget) break;
      page.push(offset);
      used += h;
      offset += 1;
    }
    pages.push(page);

    if (offset >= rowHeights.length) {
      pages.push([]);
      break;
    }
  }

  return pages;
}

export function buildInvoicePreviewPages(input: {
  lines: InvoiceLineItem[];
  hasCompanyAddress: boolean;
  hasCustomerAddress: boolean;
  hasCustomerEmail: boolean;
  isPaid: boolean;
  showRemittance: boolean;
  showTax: boolean;
  terms: string;
  hasDateColumn: boolean;
}): InvoiceLineItem[][] {
  const headerH = estimateHeaderHeight(input);
  const firstBody = Math.max(48, USABLE_H - headerH - TABLE_HEAD_H);
  const contBody = Math.max(48, USABLE_H - CONT_THEAD_ONLY);
  const footerH = estimateFooterHeight(input);
  const charsPerLine = input.hasDateColumn ? 32 : 44;
  const rowHeights = input.lines.map((line) =>
    estimateRowHeight(line, charsPerLine)
  );
  const indexes = paginateInvoiceRows({
    rowHeights,
    firstBodyBudget: firstBody,
    contBodyBudget: contBody,
    footerHeight: footerH,
  });
  return indexes.map((idxs) => idxs.map((i) => input.lines[i]));
}
