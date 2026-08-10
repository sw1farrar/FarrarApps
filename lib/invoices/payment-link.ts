import "server-only";
import { createHash, randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseJs } from "@supabase/supabase-js";
import type {
  CompanySettings,
  Customer,
  Invoice,
  InvoiceLineItem,
} from "@/lib/types/database";

export function hashPaymentToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

function generateRawToken() {
  return randomBytes(32).toString("hex");
}

function appOrigin() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

function defaultExpiresAt(dueDate?: string | null) {
  const now = Date.now();
  const min = now + 30 * 86_400_000;
  // dueDate is a calendar day (YYYY-MM-DD). Parse as local midnight, not UTC.
  let fromDue = min;
  if (dueDate) {
    const ymd = String(dueDate).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
      const [y, m, d] = ymd.split("-").map(Number);
      // End of due day + 60 days, as UTC instant for expires_at timestamptz
      fromDue = Date.UTC(y, m - 1, d + 60, 23, 59, 59, 999);
    } else {
      const parsed = new Date(dueDate).getTime();
      if (Number.isFinite(parsed)) fromDue = parsed + 60 * 86_400_000;
    }
  }
  const max = now + 90 * 86_400_000;
  return new Date(Math.min(Math.max(min, fromDue), max)).toISOString();
}

function sanitizeToken(token: string) {
  return token
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, "")
    .replace(/%20/g, "");
}

function publicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseJs(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const GENERIC_INVALID = "This payment link is unavailable";

/**
 * Create a new guest pay link for an invoice (staff session).
 * Prior active links for the same invoice are revoked.
 */
export async function createInvoicePaymentLink(
  invoiceId: string
): Promise<
  | { ok: true; token: string; url: string; expiresAt: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("id, customer_id, due_date, status, total")
    .eq("id", invoiceId)
    .single();

  if (error || !invoice) {
    return { ok: false, error: error?.message || "Invoice not found" };
  }

  if (invoice.status === "paid") {
    return { ok: false, error: "Invoice is already paid" };
  }
  if (!(Number(invoice.total) > 0)) {
    return { ok: false, error: "Invoice has no amount due" };
  }
  // Allow draft (email path promotes to sent) and sent/overdue
  if (!["draft", "sent", "overdue"].includes(invoice.status)) {
    return { ok: false, error: "Invoice is not payable" };
  }

  const raw = generateRawToken();
  const tokenHash = hashPaymentToken(raw);
  const expiresAt = defaultExpiresAt(invoice.due_date);

  // Revoke prior active links then insert (unique partial index enforces one active)
  await supabase
    .from("invoice_payment_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("invoice_id", invoiceId)
    .is("revoked_at", null);

  const { error: insertError } = await supabase
    .from("invoice_payment_links")
    .insert({
      invoice_id: invoiceId,
      customer_id: invoice.customer_id,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_by: user.id,
    });

  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  return {
    ok: true,
    token: raw,
    url: `${appOrigin()}/pay/${raw}`,
    expiresAt,
  };
}

export type ResolvedPaymentLink = {
  token: string;
  tokenHash: string;
  linkId: string;
  invoice: Invoice;
  customer: Customer;
  lines: InvoiceLineItem[];
  company: CompanySettings | null;
  logoUrl: string | null;
  payable: boolean;
  reason?: string;
};

export async function resolvePaymentLink(
  token: string
): Promise<
  | { ok: true; data: ResolvedPaymentLink }
  | { ok: false; error: string }
> {
  const raw = sanitizeToken(token ?? "");
  if (!raw || raw.length < 16) {
    return { ok: false, error: GENERIC_INVALID };
  }

  const tokenHash = hashPaymentToken(raw);
  const supabase = publicClient();

  const { data, error } = await supabase.rpc("resolve_invoice_pay_token", {
    p_token_hash: tokenHash,
  });

  if (error) {
    console.error("resolve_invoice_pay_token", error.message);
    return { ok: false, error: GENERIC_INVALID };
  }

  if (!data || typeof data !== "object") {
    return { ok: false, error: GENERIC_INVALID };
  }

  const payload = data as {
    error?: string;
    link_id?: string;
    invoice?: Invoice;
    customer?: Customer;
    lines?: InvoiceLineItem[];
    company?: CompanySettings | null;
  };

  if (payload.error || !payload.invoice || !payload.customer || !payload.link_id) {
    return { ok: false, error: GENERIC_INVALID };
  }

  const invoice = payload.invoice;
  const customer = payload.customer;
  const company = payload.company ?? null;
  const lines = (payload.lines ?? []) as InvoiceLineItem[];

  // Logos bucket is public — use public URL (works without service role).
  // Fall back to static brand asset in /public.
  let logoUrl: string | null = null;
  if (company?.logo_path) {
    try {
      const { data } = publicClient()
        .storage.from("logos")
        .getPublicUrl(company.logo_path);
      logoUrl = data.publicUrl || null;
    } catch {
      logoUrl = null;
    }
  }
  if (!logoUrl) {
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      "http://localhost:3000";
    logoUrl = `${origin}/farrar_apps_logo.png`;
  }

  let payable = true;
  let reason: string | undefined;
  if (invoice.status === "paid") {
    payable = false;
    reason = "This invoice has already been paid.";
  } else if (invoice.status === "draft") {
    payable = false;
    reason = "This invoice is not ready for payment.";
  } else if (!(Number(invoice.total) > 0)) {
    payable = false;
    reason = "This invoice has no amount due.";
  }

  return {
    ok: true,
    data: {
      token: raw,
      tokenHash,
      linkId: payload.link_id,
      invoice,
      customer,
      lines,
      company,
      logoUrl,
      payable,
      reason,
    },
  };
}
