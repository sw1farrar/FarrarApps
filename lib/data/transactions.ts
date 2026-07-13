"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/data/activity";
import type { ActionResult } from "@/lib/data/customers";
import type { TransactionType } from "@/lib/types/database";

export async function createTransaction(
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const amount = Number(formData.get("amount") || 0);
  const payload = {
    type: String(formData.get("type") || "expense") as TransactionType,
    amount,
    date: String(formData.get("date") || new Date().toISOString().slice(0, 10)),
    description: String(formData.get("description") || "").trim() || null,
    account_id: String(formData.get("account_id") || ""),
    category_id: String(formData.get("category_id") || "") || null,
    customer_id: String(formData.get("customer_id") || "") || null,
    project_id: String(formData.get("project_id") || "") || null,
    invoice_id: String(formData.get("invoice_id") || "") || null,
    receipt_path: String(formData.get("receipt_path") || "") || null,
    created_by: user?.id ?? null,
  };

  if (!payload.account_id) return { ok: false, error: "Account is required" };
  if (!(amount > 0)) return { ok: false, error: "Amount must be greater than 0" };

  const { data, error } = await supabase
    .from("transactions")
    .insert(payload)
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  await logActivity({
    action: "created",
    entity_type: "transaction",
    entity_id: data.id,
    meta: { type: payload.type, amount: payload.amount },
  });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  return { ok: true, id: data.id };
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    action: "deleted",
    entity_type: "transaction",
    entity_id: id,
  });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  return { ok: true };
}
