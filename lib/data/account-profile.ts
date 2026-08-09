"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/data/customers";

/**
 * Update the signed-in user's display name (profiles.full_name).
 * Used by staff Account settings and portal settings.
 */
export async function updateAccountName(
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const full_name = String(formData.get("full_name") || "").trim();
  if (!full_name) return { ok: false, error: "Name is required" };
  if (full_name.length > 120) {
    return { ok: false, error: "Name must be 120 characters or less" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/settings/account");
  revalidatePath("/portal");
  revalidatePath("/portal/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** @deprecated Prefer updateAccountName — kept for existing portal imports. */
export async function updatePortalProfile(
  formData: FormData
): Promise<ActionResult> {
  return updateAccountName(formData);
}
