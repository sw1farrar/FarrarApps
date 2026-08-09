import type { InvoiceStatus } from "@/lib/types/database";

export type InvoiceDisplayStatus = "Draft" | "Sent" | "Past due" | "Paid";

/** Days past due date; null when not applicable (draft/paid) or invalid date. */
export function invoiceDaysPastDue(
  dueDate: string | null | undefined,
  status: InvoiceStatus
): number | null {
  if (status === "paid" || status === "draft") return null;
  if (!dueDate) return null;
  const due = new Date(`${String(dueDate).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

export function displayInvoiceStatus(
  status: InvoiceStatus,
  dueDate?: string | null
): InvoiceDisplayStatus {
  if (status === "paid") return "Paid";
  if (status === "draft") return "Draft";
  const days = invoiceDaysPastDue(dueDate, status);
  if (status === "overdue" || (days !== null && days > 0)) return "Past due";
  return "Sent";
}

/** Tailwind classes for LICA-like status colors. */
export function invoiceStatusBadgeClass(
  status: InvoiceStatus,
  dueDate?: string | null
): string {
  const label = displayInvoiceStatus(status, dueDate);
  switch (label) {
    case "Paid":
      return "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
    case "Past due":
      return "border-transparent bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300";
    case "Sent":
      return "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";
    case "Draft":
    default:
      return "border-transparent bg-secondary text-secondary-foreground";
  }
}

export function formatInvoiceAging(
  dueDate: string | null | undefined,
  status: InvoiceStatus
): string {
  if (status === "paid") return "—";
  if (status === "draft") return "—";
  const days = invoiceDaysPastDue(dueDate, status);
  if (days === null) return "—";
  if (days <= 0) return "Current";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export function canDeleteInvoice(status: InvoiceStatus): boolean {
  return status !== "paid";
}
