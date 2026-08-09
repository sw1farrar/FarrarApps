"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/data/customers";

export async function updatePortalProfile(
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const full_name = String(formData.get("full_name") || "").trim();
  if (!full_name) return { ok: false, error: "Name is required" };

  const { error } = await supabase
    .from("profiles")
    .update({ full_name })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/portal");
  revalidatePath("/portal/settings");
  return { ok: true };
}
