"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/data/activity";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

export async function createCustomer(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const payload = {
    name: String(formData.get("name") || "").trim(),
    email: String(formData.get("email") || "").trim() || null,
    phone: String(formData.get("phone") || "").trim() || null,
    company: String(formData.get("company") || "").trim() || null,
    notes: String(formData.get("notes") || "").trim() || null,
    created_by: user?.id ?? null,
  };

  if (!payload.name) return { ok: false, error: "Name is required" };

  const { data, error } = await supabase
    .from("customers")
    .insert(payload)
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  await logActivity({
    action: "created",
    entity_type: "customer",
    entity_id: data.id,
    meta: { name: payload.name },
  });

  revalidatePath("/customers");
  revalidatePath("/dashboard");
  return { ok: true, id: data.id };
}

export async function updateCustomer(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const payload = {
    name: String(formData.get("name") || "").trim(),
    email: String(formData.get("email") || "").trim() || null,
    phone: String(formData.get("phone") || "").trim() || null,
    company: String(formData.get("company") || "").trim() || null,
    notes: String(formData.get("notes") || "").trim() || null,
  };

  if (!payload.name) return { ok: false, error: "Name is required" };

  const { error } = await supabase.from("customers").update(payload).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    action: "updated",
    entity_type: "customer",
    entity_id: id,
    meta: { name: payload.name },
  });

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return { ok: true, id };
}

export async function deleteCustomer(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    action: "deleted",
    entity_type: "customer",
    entity_id: id,
  });

  revalidatePath("/customers");
  revalidatePath("/dashboard");
  return { ok: true };
}
