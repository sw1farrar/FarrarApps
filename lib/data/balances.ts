import { businessCalendarDate, calendarDaysPastDue } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export type CustomerBalance = {
  customerId: string;
  openTotal: number;
  overdueTotal: number;
  openCount: number;
  overdueCount: number;
  paidTotal: number;
  aging: {
    current: number;
    days30: number;
    days60: number;
    days90: number;
  };
};

const OPEN_STATUSES = ["sent", "overdue"] as const;

function daysPastDue(dueDate: string, todayYmd: string): number {
  return calendarDaysPastDue(dueDate, todayYmd) ?? 0;
}

export async function getCustomerBalance(
  customerId: string
): Promise<CustomerBalance> {
  const supabase = await createClient();
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, status, total, due_date")
    .eq("customer_id", customerId)
    .in("status", [...OPEN_STATUSES, "paid"]);

  const todayYmd = businessCalendarDate();

  const balance: CustomerBalance = {
    customerId,
    openTotal: 0,
    overdueTotal: 0,
    openCount: 0,
    overdueCount: 0,
    paidTotal: 0,
    aging: { current: 0, days30: 0, days60: 0, days90: 0 },
  };

  for (const inv of invoices ?? []) {
    const total = Number(inv.total) || 0;
    if (inv.status === "paid") {
      balance.paidTotal += total;
      continue;
    }

    balance.openTotal += total;
    balance.openCount += 1;

    const past = daysPastDue(inv.due_date, todayYmd);
    if (inv.status === "overdue" || past > 0) {
      balance.overdueTotal += total;
      balance.overdueCount += 1;
    }

    if (past <= 0) balance.aging.current += total;
    else if (past <= 30) balance.aging.days30 += total;
    else if (past <= 60) balance.aging.days60 += total;
    else balance.aging.days90 += total;
  }

  return balance;
}

export type ArAgingBucket = "current" | "days30" | "days60" | "days90";

export type ArInvoiceRow = {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  company: string | null;
  projectId: string | null;
  projectName: string | null;
  status: string;
  total: number;
  dueDate: string;
  issueDate: string | null;
  daysPastDue: number;
  agingBucket: ArAgingBucket;
  isOverdue: boolean;
};

export async function getAccountsReceivableOverview(): Promise<{
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
  /** Line-level open invoices for report drill-down. */
  invoices: ArInvoiceRow[];
}> {
  const supabase = await createClient();
  const { data: invoices } = await supabase
    .from("invoices")
    .select(
      "id, customer_id, project_id, status, total, due_date, issue_date, invoice_number, customers(id, name, company), projects(id, name)"
    )
    .in("status", [...OPEN_STATUSES])
    .order("due_date", { ascending: true });

  const todayYmd = businessCalendarDate();

  const map = new Map<
    string,
    {
      customerId: string;
      customerName: string;
      company: string | null;
      openTotal: number;
      overdueTotal: number;
      openCount: number;
      aging: CustomerBalance["aging"];
    }
  >();

  const invoiceRows: ArInvoiceRow[] = [];

  let openTotal = 0;
  let overdueTotal = 0;
  let openCount = 0;

  for (const inv of invoices ?? []) {
    const cust = inv.customers as unknown as {
      id: string;
      name: string;
      company: string | null;
    } | null;
    if (!cust) continue;

    const project = inv.projects as unknown as {
      id: string;
      name: string;
    } | null;

    const total = Number(inv.total) || 0;
    openTotal += total;
    openCount += 1;

    let row = map.get(cust.id);
    if (!row) {
      row = {
        customerId: cust.id,
        customerName: cust.name,
        company: cust.company,
        openTotal: 0,
        overdueTotal: 0,
        openCount: 0,
        aging: { current: 0, days30: 0, days60: 0, days90: 0 },
      };
      map.set(cust.id, row);
    }

    row.openTotal += total;
    row.openCount += 1;

    const past = daysPastDue(inv.due_date, todayYmd);
    const isOverdue = inv.status === "overdue" || past > 0;
    if (isOverdue) {
      overdueTotal += total;
      row.overdueTotal += total;
    }

    let agingBucket: ArAgingBucket = "current";
    if (past <= 0) {
      row.aging.current += total;
      agingBucket = "current";
    } else if (past <= 30) {
      row.aging.days30 += total;
      agingBucket = "days30";
    } else if (past <= 60) {
      row.aging.days60 += total;
      agingBucket = "days60";
    } else {
      row.aging.days90 += total;
      agingBucket = "days90";
    }

    invoiceRows.push({
      id: inv.id,
      invoiceNumber: inv.invoice_number,
      customerId: cust.id,
      customerName: cust.name,
      company: cust.company,
      projectId: inv.project_id ?? project?.id ?? null,
      projectName: project?.name ?? null,
      status: inv.status,
      total,
      dueDate: inv.due_date,
      issueDate: inv.issue_date ?? null,
      daysPastDue: past,
      agingBucket,
      isOverdue,
    });
  }

  return {
    totals: { openTotal, overdueTotal, openCount },
    byCustomer: Array.from(map.values()).sort(
      (a, b) => b.openTotal - a.openTotal
    ),
    invoices: invoiceRows,
  };
}
