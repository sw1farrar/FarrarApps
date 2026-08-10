import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";

export function formatCurrency(amount: number | string | null | undefined) {
  const value = Number(amount ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

const CALENDAR_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Optional IANA timezone for server-side calendar-day logic (aging, "today"
 * when recording payments without a client date). Client UI always uses the
 * browser's local timezone for form defaults.
 *
 * Set NEXT_PUBLIC_APP_TIMEZONE (or APP_TIMEZONE) e.g. America/Chicago.
 */
export function getAppTimeZone(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_APP_TIMEZONE ||
    process.env.APP_TIMEZONE ||
    undefined
  );
}

export function isCalendarDateString(
  value: string | null | undefined
): value is string {
  return Boolean(value && CALENDAR_DATE_RE.test(value));
}

/**
 * Local calendar date as YYYY-MM-DD using the runtime's local timezone
 * (browser user TZ on the client; process TZ on the server — often UTC on
 * Vercel unless APP_TIMEZONE is set via {@link businessCalendarDate}).
 */
export function toCalendarDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** @deprecated Use toCalendarDateString — same behavior, clearer name. */
export function toLocalDateString(date: Date = new Date()): string {
  return toCalendarDateString(date);
}

/**
 * "Today" as YYYY-MM-DD for business/server logic.
 * Uses APP_TIMEZONE when set so US evenings are not shifted to the next UTC day.
 * Falls back to the runtime local calendar day.
 */
export function businessCalendarDate(date: Date = new Date()): string {
  const timeZone = getAppTimeZone();
  if (!timeZone) return toCalendarDateString(date);
  // en-CA → YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Parse a stored calendar date (YYYY-MM-DD) as a local Date at midnight.
 * Never use `new Date("YYYY-MM-DD")` — that is UTC midnight and shifts a day
 * west of UTC.
 */
export function parseCalendarDate(value: string): Date {
  const ymd = value.slice(0, 10);
  if (!CALENDAR_DATE_RE.test(ymd)) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      throw new Error(`Invalid calendar date: ${value}`);
    }
    return d;
  }
  // parseISO with explicit local time (no Z) → local midnight
  return parseISO(`${ymd}T00:00:00`);
}

/** Safe parse; returns null if invalid. */
export function tryParseCalendarDate(
  value: string | null | undefined
): Date | null {
  if (!value) return null;
  try {
    const d = parseCalendarDate(value);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/**
 * Add whole calendar days to a YYYY-MM-DD (or Date) and return YYYY-MM-DD.
 * Pure Y-M-D arithmetic (UTC date parts) so DST and server TZ cannot skew
 * the calendar day.
 */
export function addCalendarDays(
  value: string | Date,
  days: number
): string {
  if (typeof value === "string" && CALENDAR_DATE_RE.test(value.slice(0, 10))) {
    const [y, m, d] = value.slice(0, 10).split("-").map(Number);
    const utc = new Date(Date.UTC(y, m - 1, d + days));
    const yy = utc.getUTCFullYear();
    const mm = String(utc.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(utc.getUTCDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  }
  const base =
    value instanceof Date
      ? new Date(value.getFullYear(), value.getMonth(), value.getDate())
      : parseCalendarDate(String(value));
  base.setDate(base.getDate() + days);
  return toCalendarDateString(base);
}

/**
 * Whole calendar days from `fromYmd` to `toYmd` (to - from).
 * Uses UTC date parts of the Y-M-D numbers so the result is timezone-stable
 * once both strings are correct calendar dates.
 */
export function calendarDaysBetween(fromYmd: string, toYmd: string): number {
  const from = String(fromYmd).slice(0, 10);
  const to = String(toYmd).slice(0, 10);
  if (!CALENDAR_DATE_RE.test(from) || !CALENDAR_DATE_RE.test(to)) {
    return NaN;
  }
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const fromUtc = Date.UTC(fy, fm - 1, fd);
  const toUtc = Date.UTC(ty, tm - 1, td);
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

/** Days past due: positive = overdue. Compares two calendar date strings. */
export function calendarDaysPastDue(
  dueYmd: string | null | undefined,
  todayYmd: string = businessCalendarDate()
): number | null {
  if (!dueYmd) return null;
  const due = String(dueYmd).slice(0, 10);
  if (!CALENDAR_DATE_RE.test(due)) return null;
  const days = calendarDaysBetween(due, todayYmd);
  return Number.isFinite(days) ? days : null;
}

function formatInstantInZone(
  date: Date,
  options: Intl.DateTimeFormatOptions
): string {
  const timeZone = getAppTimeZone();
  if (timeZone) {
    return new Intl.DateTimeFormat("en-US", { timeZone, ...options }).format(
      date
    );
  }
  // Browser / process local
  if (options.hour != null) {
    return format(date, "MMM d, yyyy h:mm a");
  }
  return format(date, "MMM d, yyyy");
}

/**
 * Format a date for display.
 * - Calendar dates (`YYYY-MM-DD`): shown as that day (no TZ shift).
 * - Timestamps: viewer's local zone, or APP_TIMEZONE when set (server PDF/email).
 */
export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  if (typeof value === "string" && CALENDAR_DATE_RE.test(value)) {
    // Format pure calendar day without involving timezone offsets
    try {
      return format(parseCalendarDate(value), "MMM d, yyyy");
    } catch {
      return "—";
    }
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return formatInstantInZone(date, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format an instant (timestamptz) for display.
 * Uses APP_TIMEZONE when set; otherwise the runtime local zone.
 */
export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return formatInstantInZone(date, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
