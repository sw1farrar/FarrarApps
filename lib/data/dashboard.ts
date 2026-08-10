import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getAccountsReceivableOverview } from "@/lib/data/balances";
import {
  defaultReportRange,
  getCashBasisReport,
  type CashBasisReport,
} from "@/lib/data/reports";
import {
  addCalendarDays,
  businessCalendarDate,
  calendarDaysPastDue,
} from "@/lib/format";
import type {
  ActivityLog,
  Invoice,
  Project,
  ProjectMilestone,
} from "@/lib/types/database";

export type DashboardProject = Project & {
  customers?: { id: string; name: string } | null;
};

export type DashboardMilestone = ProjectMilestone & {
  projects?: { id: string; name: string; status?: string } | null;
};

export type DashboardInvoiceRow = Pick<
  Invoice,
  "id" | "invoice_number" | "total" | "due_date" | "status" | "issue_date"
> & {
  customers?: { id: string; name: string } | null;
};

export type AttentionItem = {
  id: string;
  kind: "overdue_invoice" | "draft_invoice" | "milestone" | "planning_project";
  title: string;
  subtitle: string;
  href: string;
  meta: string;
  urgency: "high" | "medium" | "low";
};

export type DashboardData = {
  range: { from: string; to: string; label: string };
  kpis: {
    openAr: number;
    openArCount: number;
    overdueAr: number;
    overdueCount: number;
    incomeMtd: number;
    expenseMtd: number;
    profitMtd: number;
    activeProjects: number;
    planningProjects: number;
  };
  cash: Pick<CashBasisReport, "income" | "expenses" | "profit" | "byDay">;
  arByCustomer: Array<{
    customerId: string;
    customerName: string;
    company: string | null;
    openTotal: number;
    overdueTotal: number;
    openCount: number;
  }>;
  attention: AttentionItem[];
  projects: DashboardProject[];
  nextMilestoneByProject: Record<
    string,
    { title: string; due_date: string | null }
  >;
  recentActivity: ActivityLog[];
  draftInvoiceCount: number;
};

/**
 * Single parallel load for the home dashboard — money first, delivery second.
 */
export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();
  const range = defaultReportRange();
  const today = businessCalendarDate();
  const soon = addCalendarDays(today, 7);

  const [
    cash,
    ar,
    projectsRes,
    overdueInvRes,
    draftInvRes,
    milestonesRes,
    nextMsRes,
    activityRes,
  ] = await Promise.all([
    getCashBasisReport(range.from, range.to),
    getAccountsReceivableOverview(),
    supabase
      .from("projects")
      .select("id, name, status, updated_at, customers(id, name)")
      .in("status", ["planning", "in_progress"])
      .order("updated_at", { ascending: false })
      .limit(24),
    supabase
      .from("invoices")
      .select(
        "id, invoice_number, total, due_date, status, issue_date, customers(id, name)"
      )
      .in("status", ["sent", "overdue"])
      .order("due_date", { ascending: true })
      .limit(40),
    supabase
      .from("invoices")
      .select(
        "id, invoice_number, total, due_date, status, issue_date, customers(id, name)"
      )
      .eq("status", "draft")
      .order("updated_at", { ascending: false })
      .limit(8),
    supabase
      .from("project_milestones")
      .select(
        "id, project_id, title, due_date, completed_at, projects(id, name, status)"
      )
      .is("completed_at", null)
      .not("due_date", "is", null)
      .lte("due_date", soon)
      .order("due_date", { ascending: true })
      .limit(16),
    supabase
      .from("project_milestones")
      .select(
        "id, project_id, title, due_date, completed_at, projects!inner(status)"
      )
      .is("completed_at", null)
      .in("projects.status", ["planning", "in_progress"])
      .order("due_date", { ascending: true })
      .limit(80),
    supabase
      .from("activity_logs")
      .select("id, action, entity_type, entity_id, meta, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const projects = (projectsRes.data ?? []) as unknown as DashboardProject[];
  const inProgress = projects.filter((p) => p.status === "in_progress");
  const planning = projects.filter((p) => p.status === "planning");

  const openInvoices = (overdueInvRes.data ??
    []) as unknown as DashboardInvoiceRow[];
  const drafts = (draftInvRes.data ?? []) as unknown as DashboardInvoiceRow[];

  const milestones = (
    (milestonesRes.data ?? []) as unknown as DashboardMilestone[]
  ).filter((m) => {
    const s = m.projects?.status;
    return s === "planning" || s === "in_progress";
  });

  const nextMilestoneByProject: DashboardData["nextMilestoneByProject"] = {};
  for (const m of (nextMsRes.data ?? []) as unknown as ProjectMilestone[]) {
    if (!nextMilestoneByProject[m.project_id]) {
      nextMilestoneByProject[m.project_id] = {
        title: m.title,
        due_date: m.due_date,
      };
    }
  }

  // Past-due open invoices (status may still be "sent" until sync)
  const pastDueInvoices = openInvoices
    .map((inv) => {
      const days = calendarDaysPastDue(inv.due_date, today) ?? 0;
      return { inv, days };
    })
    .filter(({ days, inv }) => inv.status === "overdue" || days > 0)
    .sort((a, b) => b.days - a.days);

  const attention: AttentionItem[] = [];

  for (const { inv, days } of pastDueInvoices.slice(0, 6)) {
    attention.push({
      id: `inv-${inv.id}`,
      kind: "overdue_invoice",
      title: inv.invoice_number,
      subtitle: inv.customers?.name || "No customer",
      href: `/finance/invoices/${inv.id}`,
      meta:
        days > 0
          ? `${days}d past due · ${formatMoneyShort(inv.total)}`
          : formatMoneyShort(inv.total),
      urgency: days >= 14 ? "high" : "medium",
    });
  }

  for (const inv of drafts.slice(0, 4)) {
    attention.push({
      id: `draft-${inv.id}`,
      kind: "draft_invoice",
      title: inv.invoice_number,
      subtitle: inv.customers?.name || "Draft — add customer",
      href: `/finance/invoices/${inv.id}/edit`,
      meta: formatMoneyShort(inv.total),
      urgency: "low",
    });
  }

  for (const m of milestones.slice(0, 6)) {
    const days = m.due_date ? (calendarDaysPastDue(m.due_date, today) ?? 0) : 0;
    attention.push({
      id: `ms-${m.id}`,
      kind: "milestone",
      title: m.title,
      subtitle: m.projects?.name || "Project",
      href: `/projects/${m.project_id}`,
      meta: days > 0 ? `${days}d late` : days === 0 ? "Due today" : "Due soon",
      urgency: days > 0 ? "high" : days === 0 ? "medium" : "low",
    });
  }

  for (const p of planning.slice(0, 3)) {
    attention.push({
      id: `plan-${p.id}`,
      kind: "planning_project",
      title: p.name,
      subtitle: p.customers?.name || "Needs brief / kickoff",
      href: `/projects/${p.id}`,
      meta: "Planning",
      urgency: "low",
    });
  }

  // Priority: high → medium → low, cap list
  const urgencyRank = { high: 0, medium: 1, low: 2 } as const;
  attention.sort(
    (a, b) => urgencyRank[a.urgency] - urgencyRank[b.urgency]
  );

  return {
    range: {
      from: range.from,
      to: range.to,
      label: "This month",
    },
    kpis: {
      openAr: ar.totals.openTotal,
      openArCount: ar.totals.openCount,
      overdueAr: ar.totals.overdueTotal,
      overdueCount: pastDueInvoices.length,
      incomeMtd: cash.income,
      expenseMtd: cash.expenses,
      profitMtd: cash.profit,
      activeProjects: inProgress.length,
      planningProjects: planning.length,
    },
    cash: {
      income: cash.income,
      expenses: cash.expenses,
      profit: cash.profit,
      byDay: cash.byDay,
    },
    arByCustomer: ar.byCustomer
      .slice()
      .sort((a, b) => b.openTotal - a.openTotal)
      .slice(0, 6)
      .map((c) => ({
        customerId: c.customerId,
        customerName: c.customerName,
        company: c.company,
        openTotal: c.openTotal,
        overdueTotal: c.overdueTotal,
        openCount: c.openCount,
      })),
    attention: attention.slice(0, 10),
    projects: [...inProgress, ...planning].slice(0, 8),
    nextMilestoneByProject,
    recentActivity: (activityRes.data ?? []) as ActivityLog[],
    draftInvoiceCount: drafts.length,
  };
}

function formatMoneyShort(n: number | string | null | undefined) {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v);
}
