"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/data/activity";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function customerPayload(formData: FormData) {
  return {
    name: String(formData.get("name") || "").trim(),
    email: String(formData.get("email") || "").trim() || null,
    phone: String(formData.get("phone") || "").trim() || null,
    company: String(formData.get("company") || "").trim() || null,
    address: String(formData.get("address") || "").trim() || null,
    city: String(formData.get("city") || "").trim() || null,
    state: String(formData.get("state") || "").trim() || null,
    zip: String(formData.get("zip") || "").trim() || null,
    notes: String(formData.get("notes") || "").trim() || null,
  };
}

export async function createCustomer(
  formData: FormData
): Promise<ActionResult & { inviteSent?: boolean; inviteError?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const payload = {
    ...customerPayload(formData),
    created_by: user?.id ?? null,
  };
  const sendPortalInvite =
    String(formData.get("send_portal_invite") || "") === "on" ||
    String(formData.get("send_portal_invite") || "") === "true";

  if (!payload.name) return { ok: false, error: "Name is required" };

  const { data, error } = await supabase
    .from("customers")
    .insert(payload)
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  try {
    await logActivity({
      action: "created",
      entity_type: "customer",
      entity_id: data.id,
      meta: { name: payload.name },
    });
  } catch {
    // Don't fail the create if activity logging fails.
  }

  let inviteSent = false;
  let inviteError: string | undefined;
  if (sendPortalInvite && payload.email) {
    const { inviteCustomerToPortal } = await import("@/lib/data/portal");
    const invite = await inviteCustomerToPortal(data.id);
    if (invite.ok) {
      inviteSent = true;
    } else {
      inviteError = invite.error || "Portal invite failed";
    }
  }

  revalidatePath("/customers");
  revalidatePath("/projects");
  revalidatePath("/finance/invoices");
  revalidatePath("/dashboard");
  return { ok: true, id: data.id, inviteSent, inviteError };
}

export async function updateCustomer(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const payload = customerPayload(formData);

  if (!payload.name) return { ok: false, error: "Name is required" };

  const { error } = await supabase.from("customers").update(payload).eq("id", id);
  if (error) return { ok: false, error: error.message };

  try {
    await logActivity({
      action: "updated",
      entity_type: "customer",
      entity_id: id,
      meta: { name: payload.name },
    });
  } catch {
    // Don't fail the update if activity logging fails.
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  revalidatePath("/projects");
  revalidatePath("/finance/invoices");
  return { ok: true, id };
}

export async function deleteCustomer(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  try {
    await logActivity({
      action: "deleted",
      entity_type: "customer",
      entity_id: id,
    });
  } catch {
    // Ignore activity logging failures.
  }

  revalidatePath("/customers");
  revalidatePath("/dashboard");
  return { ok: true };
}
