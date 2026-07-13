"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/data/customers";
import type { CategoryType, UserRole } from "@/lib/types/database";

export async function updateCompanySettings(
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("company_settings")
    .select("id")
    .limit(1)
    .maybeSingle();

  const payload = {
    name: String(formData.get("name") || "").trim() || "Farrar Apps",
    address: String(formData.get("address") || "").trim() || null,
    email: String(formData.get("email") || "").trim() || null,
    phone: String(formData.get("phone") || "").trim() || null,
    invoice_terms: String(formData.get("invoice_terms") || "").trim() || null,
  };

  const { error } = existing
    ? await supabase.from("company_settings").update(payload).eq("id", existing.id)
    : await supabase.from("company_settings").insert(payload);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function createCategory(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const name = String(formData.get("name") || "").trim();
  const type = String(formData.get("type") || "expense") as CategoryType;
  if (!name) return { ok: false, error: "Name is required" };

  const { error } = await supabase.from("categories").insert({ name, type });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function updateUserRole(
  userId: string,
  role: UserRole
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}
