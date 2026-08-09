"use server";

import { createClient } from "@/lib/supabase/server";

export async function syncOverdueNotifications() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "owner" && profile?.role !== "staff") return;

  const today = new Date().toISOString().slice(0, 10);

  const { data: overdue } = await supabase
    .from("invoices")
    .select("id, invoice_number, due_date, total, status")
    .in("status", ["sent", "overdue"])
    .lt("due_date", today);

  for (const invoice of overdue ?? []) {
    if (invoice.status === "sent") {
      await supabase
        .from("invoices")
        .update({ status: "overdue" })
        .eq("id", invoice.id);
    }

    // Do not re-notify if user already has any notification for this invoice
    // (including dismissed/read ones).
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", user.id)
      .eq("href", `/finance/invoices/${invoice.id}`)
      .limit(1);

    if (!existing?.length) {
      await supabase.from("notifications").insert({
        user_id: user.id,
        title: `Invoice ${invoice.invoice_number} is overdue`,
        body: `Due ${invoice.due_date}`,
        href: `/finance/invoices/${invoice.id}`,
      });
    }
  }
}

/** Active (not dismissed) notifications for the bell. */
export async function getNotifications() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(30);

  return data ?? [];
}

export async function markNotificationRead(id: string) {
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
}

/** Dismiss one notification (clears it from the bell). */
export async function dismissNotification(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Sign in required" };

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

/** Clear every active notification for the current user. */
export async function dismissAllNotifications() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Sign in required" };

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function markAllNotificationsRead() {
  return dismissAllNotifications();
}
