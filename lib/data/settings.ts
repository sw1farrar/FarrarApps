"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/data/activity";
import type { ActionResult } from "@/lib/data/customers";
import type {
  AccountType,
  CategoryType,
  UserRole,
} from "@/lib/types/database";

const ACCOUNT_TYPES: AccountType[] = [
  "checking",
  "credit_card",
  "stripe",
];

export async function updateCompanySettings(
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("company_settings")
    .select("id")
    .limit(1)
    .maybeSingle();

  const percentRaw = String(formData.get("stripe_fee_percent") ?? "").trim();
  const fixedRaw = String(formData.get("stripe_fee_fixed") ?? "").trim();
  let stripe_fee_percent = percentRaw === "" ? 2.9 : Number(percentRaw);
  let stripe_fee_fixed = fixedRaw === "" ? 0.3 : Number(fixedRaw);

  if (!Number.isFinite(stripe_fee_percent) || stripe_fee_percent < 0) {
    return { ok: false, error: "Card fee percent must be 0 or greater" };
  }
  if (stripe_fee_percent >= 100) {
    return { ok: false, error: "Card fee percent must be less than 100" };
  }
  if (!Number.isFinite(stripe_fee_fixed) || stripe_fee_fixed < 0) {
    return { ok: false, error: "Fixed card fee must be 0 or greater" };
  }
  // Store with sensible precision
  stripe_fee_percent = Math.round(stripe_fee_percent * 1000) / 1000;
  stripe_fee_fixed = Math.round(stripe_fee_fixed * 100) / 100;

  const payload = {
    name: String(formData.get("name") || "").trim() || "Farrar Apps",
    address: String(formData.get("address") || "").trim() || null,
    email: String(formData.get("email") || "").trim() || null,
    phone: String(formData.get("phone") || "").trim() || null,
    invoice_terms: String(formData.get("invoice_terms") || "").trim() || null,
    stripe_fee_percent,
    stripe_fee_fixed,
  };

  const { error } = existing
    ? await supabase.from("company_settings").update(payload).eq("id", existing.id)
    : await supabase.from("company_settings").insert(payload);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function uploadCompanyLogo(
  formData: FormData
): Promise<ActionResult & { path?: string }> {
  const supabase = await createClient();
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a logo file" };
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `company/${Date.now()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from("logos")
    .upload(path, file, {
      contentType: file.type || undefined,
      upsert: false,
    });

  if (uploadError) return { ok: false, error: uploadError.message };

  const { data: existing } = await supabase
    .from("company_settings")
    .select("id")
    .limit(1)
    .maybeSingle();

  const { error } = existing
    ? await supabase
        .from("company_settings")
        .update({ logo_path: path })
        .eq("id", existing.id)
    : await supabase
        .from("company_settings")
        .insert({ name: "Farrar Apps", logo_path: path });

  if (error) return { ok: false, error: error.message };

  await logActivity({
    action: "updated",
    entity_type: "company_settings",
    entity_id: existing?.id ?? null,
    meta: { logo_path: path },
  });

  revalidatePath("/settings");
  revalidatePath("/finance/invoices");
  return { ok: true, path };
}

export async function createCategory(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const name = String(formData.get("name") || "").trim();
  const type = String(formData.get("type") || "expense") as CategoryType;
  if (!name) return { ok: false, error: "Name is required" };

  const { data, error } = await supabase
    .from("categories")
    .insert({ name, type })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  revalidatePath("/finance/accounts");
  return { ok: true, id: data.id };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  revalidatePath("/finance/accounts");
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
  revalidatePath("/settings/users");
  return { ok: true };
}

export async function createAccount(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const name = String(formData.get("name") || "").trim();
  const type = String(formData.get("type") || "checking") as AccountType;
  const openingRaw = String(formData.get("opening_balance") || "0").trim();
  const opening_balance = Number(openingRaw);

  if (!name) return { ok: false, error: "Name is required" };
  if (!ACCOUNT_TYPES.includes(type)) {
    return { ok: false, error: "Invalid account type" };
  }
  if (!Number.isFinite(opening_balance)) {
    return { ok: false, error: "Opening balance must be a number" };
  }

  const { data, error } = await supabase
    .from("accounts")
    .insert({
      name,
      type,
      opening_balance,
      is_active: true,
    })
    .select("id")
    .single();
  if (error) {
    const msg = error.message || "Could not create account";
    if (
      type === "stripe" &&
      (msg.includes("account_type") ||
        msg.includes("22P02") ||
        msg.includes("check constraint") ||
        msg.includes("accounts_supported_types"))
    ) {
      return {
        ok: false,
        error:
          "Database is missing the Stripe account type. Run scripts/apply-stripe-account-type.sql in the Supabase SQL Editor, then try again.",
      };
    }
    return { ok: false, error: msg };
  }
  revalidatePath("/settings");
  revalidatePath("/finance/accounts");
  revalidatePath(`/finance/accounts/${data.id}`);
  revalidatePath("/finance/transactions");
  revalidatePath("/finance");
  revalidatePath("/dashboard");
  return { ok: true, id: data.id };
}

export async function updateAccount(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const name = String(formData.get("name") || "").trim();
  const type = String(formData.get("type") || "checking") as AccountType;
  const openingRaw = String(formData.get("opening_balance") || "0").trim();
  const opening_balance = Number(openingRaw);
  const is_active = formData.get("is_active") === "on";

  if (!name) return { ok: false, error: "Name is required" };
  if (!ACCOUNT_TYPES.includes(type)) {
    return { ok: false, error: "Invalid account type" };
  }
  if (!Number.isFinite(opening_balance)) {
    return { ok: false, error: "Opening balance must be a number" };
  }

  const { error } = await supabase
    .from("accounts")
    .update({ name, type, opening_balance, is_active })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  revalidatePath("/finance/accounts");
  revalidatePath(`/finance/accounts/${id}`);
  revalidatePath("/finance/transactions");
  revalidatePath("/finance");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function setAccountActive(
  id: string,
  is_active: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("accounts")
    .update({ is_active })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  revalidatePath("/finance/accounts");
  revalidatePath(`/finance/accounts/${id}`);
  revalidatePath("/finance/transactions");
  revalidatePath("/finance");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteAccount(id: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { count: txnCount, error: countError } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .or(`account_id.eq.${id},transfer_account_id.eq.${id}`);

  if (countError) return { ok: false, error: countError.message };
  if ((txnCount ?? 0) > 0) {
    return {
      ok: false,
      error: `This account has ${txnCount} transaction(s). Delete or reassign those first, or deactivate the account instead.`,
    };
  }

  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) {
    if (error.message.includes("foreign key") || error.code === "23503") {
      return {
        ok: false,
        error:
          "This account is still linked to other records. Remove those links first, or deactivate the account.",
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/finance/accounts");
  revalidatePath("/finance/transactions");
  revalidatePath("/finance");
  revalidatePath("/dashboard");
  return { ok: true, id };
}
