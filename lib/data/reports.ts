import "server-only";

import { format, startOfMonth, endOfMonth } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import {
  getAccountsReceivableOverview,
  type ArInvoiceRow,
  type CustomerBalance,
} from "@/lib/data/balances";
import {
  formatDate,
  toCalendarDateString,
  toLocalDateString,
} from "@/lib/format";
import type { TransactionType } from "@/lib/types/database";

// Re-export for existing report callers
export { toLocalDateString };

export type ReportKey = "pl" | "ar" | "expenses" | "income";

export type ReportTxRow = {
  id: string;
  date: string;
  type: TransactionType;
  description: string;
  amount: number;
  accountId: string | null;
  account: string;
  transferAccountId: string | null;
  transferAccount: string;
  categoryId: string | null;
  category: string;
  customerId: string | null;
  customer: string;
  projectId: string | null;
  project: string;
  invoiceId: string | null;
  invoiceNumber: string;
};

export type NamedAmount = {
  name: string;
  value: number;
  /** Stable key for drill-down (customer id / category name / etc.) */
  key: string;
  customerId?: string | null;
};

export type CashBasisReport = {
  from: string;
  to: string;
  income: number;
  expenses: number;
  profit: number;
  /** Transfers in range (not P&L — balance sheet moves only). */
  transfers: number;
  transferCount: number;
  incomeCount: number;
  expenseCount: number;
  expensesByCategory: NamedAmount[];
  incomeByCustomer: NamedAmount[];
  incomeByCategory: NamedAmount[];
  /** Day-by-day cash activity for charts. */
  byDay: { date: string; income: number; expense: number }[];
  /** Income + expense rows for detail/CSV (excludes transfers). */
  plRows: ReportTxRow[];
  /** Transfer rows for drill-down. */
  transferRows: ReportTxRow[];
  /** All rows in range. */
  allRows: ReportTxRow[];
};

export type ReportsBundle = CashBasisReport & {
  ar: {
    totals: {
      openTotal: number;
      overdueTotal: number;
      openCount: number;
    };
    byCustomer: Array<{
      customerId: string;
      customerName: string;
      company: string | null;
      openTotal: number;
      overdueTotal: number;
      openCount: number;
      aging: CustomerBalance["aging"];
    }>;
    invoices: ArInvoiceRow[];
  };
};

/** Default report range: first day of current month → today (local). */
export function defaultReportRange(now = new Date()): {
  from: string;
  to: string;
} {
  return {
    from: format(startOfMonth(now), "yyyy-MM-dd"),
    to: toCalendarDateString(now),
  };
}

export function clampReportRange(
  fromRaw?: string | null,
  toRaw?: string | null
): { from: string; to: string } {
  const defaults = defaultReportRange();
  let from = (fromRaw && /^\d{4}-\d{2}-\d{2}$/.test(fromRaw)
    ? fromRaw
    : defaults.from) as string;
  let to = (toRaw && /^\d{4}-\d{2}-\d{2}$/.test(toRaw)
    ? toRaw
    : defaults.to) as string;

  if (from > to) {
    const tmp = from;
    from = to;
    to = tmp;
  }
  return { from, to };
}

function mapAmount(
  map: Map<string, { name: string; value: number; customerId?: string | null }>,
  key: string,
  name: string,
  amount: number,
  customerId?: string | null
) {
  const prev = map.get(key);
  if (prev) {
    prev.value += amount;
  } else {
    map.set(key, { name, value: amount, customerId });
  }
}

function sortNamed(
  map: Map<string, { name: string; value: number; customerId?: string | null }>
): NamedAmount[] {
  return Array.from(map.entries())
    .map(([key, row]) => ({
      key,
      name: row.name,
      value: row.value,
      customerId: row.customerId,
    }))
    .sort((a, b) => b.value - a.value);
}

type RawTx = {
  id: string;
  date: string;
  type: TransactionType;
  description: string | null;
  amount: number | string;
  account_id: string | null;
  transfer_account_id: string | null;
  category_id: string | null;
  customer_id: string | null;
  project_id: string | null;
  invoice_id: string | null;
  categories: { id: string; name: string } | null;
  customers: { id: string; name: string } | null;
  projects: { id: string; name: string } | null;
  accounts: { id: string; name: string } | null;
  transfer_accounts: { id: string; name: string } | null;
  invoices: { id: string; invoice_number: string } | null;
};

function toRow(tx: RawTx): ReportTxRow {
  return {
    id: tx.id,
    date: tx.date,
    type: tx.type,
    description: tx.description || "",
    amount: Number(tx.amount) || 0,
    accountId: tx.account_id ?? tx.accounts?.id ?? null,
    account: tx.accounts?.name || "",
    transferAccountId:
      tx.transfer_account_id ?? tx.transfer_accounts?.id ?? null,
    transferAccount: tx.transfer_accounts?.name || "",
    categoryId: tx.category_id ?? tx.categories?.id ?? null,
    category: tx.categories?.name || "",
    customerId: tx.customer_id ?? tx.customers?.id ?? null,
    customer: tx.customers?.name || "",
    projectId: tx.project_id ?? tx.projects?.id ?? null,
    project: tx.projects?.name || "",
    invoiceId: tx.invoice_id ?? tx.invoices?.id ?? null,
    invoiceNumber: tx.invoices?.invoice_number || "",
  };
}

/**
 * Cash-basis P&L and breakdowns for a date range.
 * Uses explicit account FK embeds (required after transfer_account_id was added).
 */
export async function getCashBasisReport(
  from: string,
  to: string
): Promise<CashBasisReport> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(
      `
      id,
      date,
      type,
      description,
      amount,
      account_id,
      transfer_account_id,
      category_id,
      customer_id,
      project_id,
      invoice_id,
      categories(id, name),
      customers(id, name),
      projects(id, name),
      accounts!transactions_account_id_fkey(id, name),
      transfer_accounts:accounts!transactions_transfer_account_id_fkey(id, name),
      invoices(id, invoice_number)
    `
    )
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getCashBasisReport", error.message);
  }

  const raw = (data ?? []) as unknown as RawTx[];
  const allRows = raw.map(toRow);

  let income = 0;
  let expenses = 0;
  let transfers = 0;
  let incomeCount = 0;
  let expenseCount = 0;
  let transferCount = 0;

  const expensesByCategory = new Map<
    string,
    { name: string; value: number; customerId?: string | null }
  >();
  const incomeByCustomer = new Map<
    string,
    { name: string; value: number; customerId?: string | null }
  >();
  const incomeByCategory = new Map<
    string,
    { name: string; value: number; customerId?: string | null }
  >();
  const byDay = new Map<string, { income: number; expense: number }>();
  const plRows: ReportTxRow[] = [];
  const transferRows: ReportTxRow[] = [];

  for (const row of allRows) {
    const day = byDay.get(row.date) ?? { income: 0, expense: 0 };

    if (row.type === "income") {
      income += row.amount;
      incomeCount += 1;
      day.income += row.amount;
      mapAmount(
        incomeByCustomer,
        row.customerId || "unassigned",
        row.customer || "Unassigned",
        row.amount,
        row.customerId
      );
      mapAmount(
        incomeByCategory,
        row.category || "Uncategorized",
        row.category || "Uncategorized",
        row.amount
      );
      plRows.push(row);
    } else if (row.type === "expense") {
      expenses += row.amount;
      expenseCount += 1;
      day.expense += row.amount;
      mapAmount(
        expensesByCategory,
        row.category || "Uncategorized",
        row.category || "Uncategorized",
        row.amount
      );
      plRows.push(row);
    } else if (row.type === "transfer") {
      transfers += row.amount;
      transferCount += 1;
      transferRows.push(row);
    }

    byDay.set(row.date, day);
  }

  return {
    from,
    to,
    income,
    expenses,
    profit: income - expenses,
    transfers,
    transferCount,
    incomeCount,
    expenseCount,
    expensesByCategory: sortNamed(expensesByCategory),
    incomeByCustomer: sortNamed(incomeByCustomer),
    incomeByCategory: sortNamed(incomeByCategory),
    byDay: Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({ date, ...values })),
    plRows,
    transferRows,
    allRows,
  };
}

export async function getReportsBundle(
  fromRaw?: string | null,
  toRaw?: string | null
): Promise<ReportsBundle> {
  const { from, to } = clampReportRange(fromRaw, toRaw);
  const [cash, ar] = await Promise.all([
    getCashBasisReport(from, to),
    getAccountsReceivableOverview(),
  ]);
  return { ...cash, ar };
}

/** Human label for a report range (calendar dates, no UTC shift). */
export function formatReportRangeLabel(from: string, to: string): string {
  return `${formatDate(from)} – ${formatDate(to)}`;
}

export function monthBounds(date = new Date()) {
  return {
    start: format(startOfMonth(date), "yyyy-MM-dd"),
    end: format(endOfMonth(date), "yyyy-MM-dd"),
  };
}
