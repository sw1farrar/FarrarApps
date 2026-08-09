import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";

export function formatCurrency(amount: number | string | null | undefined) {
  const value = Number(amount ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

/**
 * Format a date for display.
 * Calendar dates (`YYYY-MM-DD`) are treated as local days so they do not
 * shift back a day in US timezones (unlike `new Date("2026-08-09")` UTC parse).
 * Full timestamps keep normal ISO parsing.
 */
export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    // Local midnight for pure calendar dates
    date = parseISO(`${value}T00:00:00`);
  } else {
    date = new Date(value);
  }
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "MMM d, yyyy");
}

export function monthToDateRange(date = new Date()) {
  return {
    start: format(startOfMonth(date), "yyyy-MM-dd"),
    end: format(endOfMonth(date), "yyyy-MM-dd"),
  };
}

export function titleCase(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
