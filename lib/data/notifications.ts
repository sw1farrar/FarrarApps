"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function syncOverdueNotifications() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

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

    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", user.id)
      .eq("href", `/invoices/${invoice.id}`)
      .is("read_at", null)
      .limit(1);

    if (!existing?.length) {
      await supabase.from("notifications").insert({
        user_id: user.id,
        title: `Invoice ${invoice.invoice_number} is overdue`,
        body: `Due ${invoice.due_date}`,
        href: `/invoices/${invoice.id}`,
      });
    }
  }
}

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
    .order("created_at", { ascending: false })
    .limit(20);

  return data ?? [];
}

export async function markNotificationRead(id: string) {
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  revalidatePath("/", "layout");
}
