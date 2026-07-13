"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/data/activity";
import { sendBrevoEmail } from "@/lib/email/brevo";
import { buildPortalInviteEmail } from "@/lib/email/portal-invite-template";
import type { ActionResult } from "@/lib/data/customers";
import type { CompanySettings, Customer } from "@/lib/types/database";

export async function inviteCustomerToPortal(
  customerId: string
): Promise<ActionResult & { message?: string }> {
  const supabase = await createClient();

  const { data: customer, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .single();

  if (error || !customer) {
    return { ok: false, error: error?.message || "Customer not found" };
  }
  if (!customer.email) {
    return { ok: false, error: "Add an email before inviting to the portal" };
  }
  if (customer.portal_user_id) {
    return { ok: true, id: customerId, message: "Already linked to portal" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .ilike("email", customer.email)
    .maybeSingle();

  if (profile) {
    if (profile.role !== "client") {
      return {
        ok: false,
        error:
          "That email belongs to a staff/owner account. Use a client email instead.",
      };
    }

    const { error: linkError } = await supabase
      .from("customers")
      .update({ portal_user_id: profile.id })
      .eq("id", customerId);

    if (linkError) return { ok: false, error: linkError.message };

    await logActivity({
      action: "portal_linked",
      entity_type: "customer",
      entity_id: customerId,
      meta: { email: customer.email },
    });

    revalidatePath(`/customers/${customerId}`);
    return {
      ok: true,
      id: customerId,
      message: "Linked existing account to this customer",
    };
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const loginUrl = `${origin}/login?email=${encodeURIComponent(customer.email)}&next=/portal`;

  const { data: company } = await supabase
    .from("company_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  const template = buildPortalInviteEmail({
    customer: customer as Customer,
    loginUrl,
    companyName: (company as CompanySettings | null)?.name || "Farrar Apps",
  });

  const emailed = await sendBrevoEmail({
    toEmail: customer.email,
    toName: customer.name,
    subject: `You're invited to the ${(company as CompanySettings | null)?.name || "Farrar Apps"} client portal`,
    htmlContent: template.htmlContent,
    textContent: template.textContent,
  });

  if (!emailed.ok) {
    return { ok: false, error: emailed.error };
  }

  // Best-effort magic link via Supabase (may no-op if Auth email is limited)
  await supabase.auth.signInWithOtp({
    email: customer.email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/portal`,
      data: {
        full_name: customer.name,
        invited_customer_id: customerId,
      },
    },
  });

  await logActivity({
    action: "portal_invite_sent",
    entity_type: "customer",
    entity_id: customerId,
    meta: { email: customer.email, message_id: emailed.messageId ?? null },
  });

  revalidatePath(`/customers/${customerId}`);
  return {
    ok: true,
    id: customerId,
    message: `Portal invite emailed to ${customer.email}`,
  };
}

export async function linkPortalUserBySessionCustomer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return;

  const invitedCustomerId =
    typeof user.user_metadata?.invited_customer_id === "string"
      ? user.user_metadata.invited_customer_id
      : null;

  if (invitedCustomerId) {
    await supabase
      .from("customers")
      .update({ portal_user_id: user.id })
      .eq("id", invitedCustomerId)
      .is("portal_user_id", null);
  }

  await supabase
    .from("customers")
    .update({ portal_user_id: user.id })
    .ilike("email", user.email)
    .is("portal_user_id", null);
}
