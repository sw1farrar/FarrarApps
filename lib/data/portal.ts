"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/data/activity";
import { sendBrevoEmail } from "@/lib/email/brevo";
import { buildPortalInviteEmail } from "@/lib/email/portal-invite-template";
import type { ActionResult } from "@/lib/data/customers";
import type {
  CompanySettings,
  Customer,
  CustomerMember,
  CustomerMemberRole,
} from "@/lib/types/database";

export type PendingPortalInvite = {
  id: string;
  email: string;
  expires_at: string;
  created_at: string;
};

export async function getPendingPortalInvites(
  customerId: string
): Promise<PendingPortalInvite[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("portal_invites")
    .select("id, email, expires_at, created_at")
    .eq("customer_id", customerId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  return (data as PendingPortalInvite[]) ?? [];
}

/** @deprecated use getPendingPortalInvites — kept for call sites expecting one */
export async function getPendingPortalInvite(
  customerId: string
): Promise<PendingPortalInvite | null> {
  const invites = await getPendingPortalInvites(customerId);
  return invites[0] ?? null;
}

export async function getCustomerMembers(
  customerId: string
): Promise<CustomerMember[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("customer_members")
    .select(
      "id, customer_id, user_id, role, invited_by, created_at, profiles(id, email, full_name)"
    )
    .eq("customer_id", customerId)
    .order("created_at", { ascending: true });

  return (data as unknown as CustomerMember[]) ?? [];
}

async function getAppOrigin() {
  const hdrs = await headers();
  const origin = hdrs.get("origin");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const isLocal = (value: string) => /localhost|127\.0\.0\.1/i.test(value);

  if (siteUrl && !isLocal(siteUrl)) return siteUrl;
  if (origin && !isLocal(origin)) return origin;
  if (siteUrl) return siteUrl;
  if (origin) return origin;
  return "https://farrarapps.com";
}

async function sendPortalAccessEmail(opts: {
  toEmail: string;
  toName: string;
  customer: Customer;
  loginUrl: string;
  mode: "invite" | "access";
}) {
  const supabase = await createClient();
  const { data: company } = await supabase
    .from("company_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  const companyName =
    (company as CompanySettings | null)?.name || "Farrar Apps";
  const template = buildPortalInviteEmail({
    customer: { ...opts.customer, email: opts.toEmail, name: opts.toName },
    loginUrl: opts.loginUrl,
    companyName,
    mode: opts.mode,
  });

  return sendBrevoEmail({
    toEmail: opts.toEmail,
    toName: opts.toName,
    subject:
      opts.mode === "access"
        ? `Access your ${companyName} client portal`
        : `You're invited to the ${companyName} client portal`,
    htmlContent: template.htmlContent,
    textContent: template.textContent,
  });
}

function inviteLoginUrl(origin: string, email: string, token: string) {
  return `${origin}/login?email=${encodeURIComponent(email)}&portal_invite=${encodeURIComponent(token)}&next=/portal`;
}

async function assertCanManagePortal(customerId: string): Promise<
  | { ok: true; userId: string; isStaff: boolean }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in required" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "owner" || profile?.role === "staff") {
    return { ok: true, userId: user.id, isStaff: true };
  }

  const { data: member } = await supabase
    .from("customer_members")
    .select("role")
    .eq("customer_id", customerId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (member?.role === "company_admin") {
    return { ok: true, userId: user.id, isStaff: false };
  }

  return { ok: false, error: "Only company admins can manage portal access" };
}

export async function invitePortalMember(input: {
  customerId: string;
  email: string;
  fullName?: string;
}): Promise<ActionResult & { message?: string }> {
  const auth = await assertCanManagePortal(input.customerId);
  if (!auth.ok) return auth;

  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Enter a valid email address" };
  }

  const supabase = await createClient();
  const { data: customer, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", input.customerId)
    .single();

  if (error || !customer) {
    return { ok: false, error: error?.message || "Customer not found" };
  }

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id, role")
    .ilike("email", email)
    .maybeSingle();

  if (
    existingProfile &&
    existingProfile.role !== "client"
  ) {
    return {
      ok: false,
      error:
        "That email belongs to a staff/owner account. Use a client email instead.",
    };
  }

  if (existingProfile) {
    const { data: alreadyMember } = await supabase
      .from("customer_members")
      .select("id")
      .eq("customer_id", input.customerId)
      .eq("user_id", existingProfile.id)
      .maybeSingle();
    if (alreadyMember) {
      return { ok: false, error: "That user is already a portal member" };
    }
  }

  const { data: pendingSame } = await supabase
    .from("portal_invites")
    .select("id")
    .eq("customer_id", input.customerId)
    .ilike("email", email)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (pendingSame) {
    return resendPortalInviteById(pendingSame.id, input.customerId);
  }

  const origin = await getAppOrigin();
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
  const toName =
    input.fullName?.trim() ||
    email.split("@")[0] ||
    customer.name;

  const { error: inviteError } = await supabase.from("portal_invites").insert({
    customer_id: customer.id,
    email,
    token,
    invited_by: auth.userId,
    expires_at: expiresAt.toISOString(),
  });

  if (inviteError) return { ok: false, error: inviteError.message };

  const loginUrl = inviteLoginUrl(origin, email, token);
  const emailed = await sendPortalAccessEmail({
    toEmail: email,
    toName,
    customer: customer as Customer,
    loginUrl,
    mode: "invite",
  });

  if (!emailed.ok) {
    return {
      ok: false,
      error: `${emailed.error} Invite was created — use Resend after fixing email.`,
    };
  }

  await logActivity({
    action: "portal_invite_sent",
    entity_type: "customer",
    entity_id: customer.id,
    meta: { email, message_id: emailed.messageId ?? null },
  });

  revalidatePath(`/customers/${customer.id}`);
  revalidatePath(`/finance/ar/${customer.id}`);
  revalidatePath("/portal/settings/team");
  return {
    ok: true,
    id: customer.id,
    message: `Portal invite emailed to ${email}`,
  };
}

/** Staff convenience: invite the customer's primary email */
export async function inviteCustomerToPortal(
  customerId: string
): Promise<ActionResult & { message?: string }> {
  const supabase = await createClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("email, name")
    .eq("id", customerId)
    .single();

  if (!customer?.email) {
    return { ok: false, error: "Add an email before inviting to the portal" };
  }

  return invitePortalMember({
    customerId,
    email: customer.email,
    fullName: customer.name,
  });
}

export async function resendPortalInviteById(
  inviteId: string,
  customerId: string
): Promise<ActionResult & { message?: string }> {
  const auth = await assertCanManagePortal(customerId);
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .single();

  if (!customer) return { ok: false, error: "Customer not found" };

  const { data: invite } = await supabase
    .from("portal_invites")
    .select("id, email")
    .eq("id", inviteId)
    .eq("customer_id", customerId)
    .is("accepted_at", null)
    .maybeSingle();

  if (!invite) {
    return { ok: false, error: "Invite is no longer available to resend" };
  }

  const origin = await getAppOrigin();
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);

  const { error: updateError } = await supabase
    .from("portal_invites")
    .update({
      token,
      expires_at: expiresAt.toISOString(),
      invited_by: auth.userId,
    })
    .eq("id", invite.id)
    .is("accepted_at", null);

  if (updateError) return { ok: false, error: updateError.message };

  const loginUrl = inviteLoginUrl(origin, invite.email, token);
  const emailed = await sendPortalAccessEmail({
    toEmail: invite.email,
    toName: invite.email.split("@")[0],
    customer: customer as Customer,
    loginUrl,
    mode: "invite",
  });

  if (!emailed.ok) return { ok: false, error: emailed.error };

  await logActivity({
    action: "portal_invite_resent",
    entity_type: "customer",
    entity_id: customerId,
    meta: { email: invite.email, message_id: emailed.messageId ?? null },
  });

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/portal/settings/team");
  return {
    ok: true,
    id: customerId,
    message: `Portal invite resent to ${invite.email}`,
  };
}

export async function resendPortalInvite(
  customerId: string
): Promise<ActionResult & { message?: string }> {
  const pending = await getPendingPortalInvite(customerId);
  if (!pending) {
    return {
      ok: false,
      error: "No unused invite to resend. Send a new invite first.",
    };
  }
  return resendPortalInviteById(pending.id, customerId);
}

export async function cancelPortalInviteById(
  inviteId: string,
  customerId: string
): Promise<ActionResult & { message?: string }> {
  const auth = await assertCanManagePortal(customerId);
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const { data: deleted, error } = await supabase
    .from("portal_invites")
    .delete()
    .eq("id", inviteId)
    .eq("customer_id", customerId)
    .is("accepted_at", null)
    .select("id");

  if (error) return { ok: false, error: error.message };
  if (!deleted?.length) {
    return { ok: false, error: "No unused portal invite to cancel" };
  }

  await logActivity({
    action: "portal_invite_cancelled",
    entity_type: "customer",
    entity_id: customerId,
    meta: { invite_id: inviteId },
  });

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/portal/settings/team");
  return { ok: true, id: customerId, message: "Portal invite cancelled" };
}

export async function cancelPortalInvite(
  customerId: string
): Promise<ActionResult & { message?: string }> {
  const auth = await assertCanManagePortal(customerId);
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const { data: deleted, error } = await supabase
    .from("portal_invites")
    .delete()
    .eq("customer_id", customerId)
    .is("accepted_at", null)
    .select("id");

  if (error) return { ok: false, error: error.message };
  if (!deleted?.length) {
    return { ok: false, error: "No unused portal invite to cancel" };
  }

  await logActivity({
    action: "portal_invite_cancelled",
    entity_type: "customer",
    entity_id: customerId,
    meta: { cancelled_count: deleted.length },
  });

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/portal/settings/team");
  return { ok: true, id: customerId, message: "Portal invite cancelled" };
}

export async function removePortalMember(
  customerId: string,
  memberId: string
): Promise<ActionResult & { message?: string }> {
  const auth = await assertCanManagePortal(customerId);
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("customer_members")
    .select("id, user_id, role")
    .eq("id", memberId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (!member) return { ok: false, error: "Member not found" };

  if (member.user_id === auth.userId) {
    return { ok: false, error: "You cannot remove yourself" };
  }

  const { count } = await supabase
    .from("customer_members")
    .select("*", { count: "exact", head: true })
    .eq("customer_id", customerId)
    .eq("role", "company_admin");

  if (member.role === "company_admin" && (count ?? 0) <= 1) {
    return { ok: false, error: "Keep at least one company admin" };
  }

  const { error } = await supabase
    .from("customer_members")
    .delete()
    .eq("id", memberId);

  if (error) return { ok: false, error: error.message };

  await logActivity({
    action: "portal_member_removed",
    entity_type: "customer",
    entity_id: customerId,
    meta: { member_user_id: member.user_id },
  });

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/portal/settings/team");
  return { ok: true, id: customerId, message: "Member removed" };
}

export async function unlinkPortalAccess(
  customerId: string
): Promise<ActionResult & { message?: string }> {
  const auth = await assertCanManagePortal(customerId);
  if (!auth.ok) return auth;
  if (!auth.isStaff) {
    return { ok: false, error: "Only staff can unlink all portal access" };
  }

  const supabase = await createClient();

  await supabase.from("customer_members").delete().eq("customer_id", customerId);
  await supabase
    .from("customers")
    .update({ portal_user_id: null })
    .eq("id", customerId);
  await supabase
    .from("portal_invites")
    .delete()
    .eq("customer_id", customerId)
    .is("accepted_at", null);

  await logActivity({
    action: "portal_unlinked",
    entity_type: "customer",
    entity_id: customerId,
    meta: {},
  });

  revalidatePath(`/customers/${customerId}`);
  return {
    ok: true,
    id: customerId,
    message: "All portal access removed. You can send new invites.",
  };
}

export async function getPortalInviteByToken(token: string): Promise<{
  email: string;
  customer_id: string;
  customer_name: string;
} | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_portal_invite_by_token", {
    p_token: token,
  });

  if (error || !data?.length) return null;
  const invite = data[0] as {
    email: string;
    customer_id: string;
    customer_name: string | null;
    expires_at: string;
    accepted_at: string | null;
  };

  if (invite.accepted_at) return null;
  if (new Date(invite.expires_at).getTime() < Date.now()) return null;

  return {
    email: invite.email,
    customer_id: invite.customer_id,
    customer_name: invite.customer_name || invite.email.split("@")[0],
  };
}

export async function preparePortalInvitePassword(
  token: string,
  password: string
): Promise<
  | {
      ok: true;
      mode: "signup" | "signin";
      email: string;
      customer_name: string;
    }
  | { ok: false; error: string }
> {
  if (!token) return { ok: false, error: "Missing invite token" };
  if (!password || password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_password_for_portal_invite", {
    p_token: token,
    p_password: password,
  });

  if (error) return { ok: false, error: error.message };

  const result = data as {
    ok?: boolean;
    error?: string;
    mode?: "signup" | "signin";
    email?: string;
    customer_name?: string;
  } | null;

  if (!result?.ok) {
    return { ok: false, error: result?.error || "Could not prepare portal invite" };
  }

  if (!result.email || !result.mode) {
    return { ok: false, error: "Invalid invite response" };
  }

  return {
    ok: true,
    mode: result.mode,
    email: result.email,
    customer_name: result.customer_name || result.email.split("@")[0],
  };
}

export async function acceptPortalInvite(
  token: string,
  userId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to accept this invite" };
  if (user.id !== userId) return { ok: false, error: "Invite user mismatch" };

  const { data: ok, error } = await supabase.rpc("accept_portal_invite", {
    p_token: token,
    p_user_id: userId,
  });

  if (error) return { ok: false, error: error.message };
  if (!ok) {
    return { ok: false, error: "Invite is invalid, expired, or already used" };
  }

  await logActivity({
    action: "portal_invite_accepted",
    entity_type: "customer",
    entity_id: userId,
    meta: { email: user.email },
  });

  revalidatePath("/portal");
  return { ok: true, id: userId };
}

export async function linkPortalUserBySessionCustomer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return;

  const { data: existing } = await supabase
    .from("customer_members")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (existing) return;

  const invitedCustomerId =
    typeof user.user_metadata?.invited_customer_id === "string"
      ? user.user_metadata.invited_customer_id
      : null;

  if (invitedCustomerId) {
    await supabase.from("customer_members").upsert(
      {
        customer_id: invitedCustomerId,
        user_id: user.id,
        role: "company_admin" as CustomerMemberRole,
      },
      { onConflict: "customer_id,user_id", ignoreDuplicates: true }
    );
  }

  const { data: byEmail } = await supabase
    .from("customers")
    .select("id")
    .ilike("email", user.email)
    .limit(1)
    .maybeSingle();

  if (byEmail) {
    const { count } = await supabase
      .from("customer_members")
      .select("*", { count: "exact", head: true })
      .eq("customer_id", byEmail.id);

    await supabase.from("customer_members").upsert(
      {
        customer_id: byEmail.id,
        user_id: user.id,
        role: (count ?? 0) === 0 ? "company_admin" : "member",
      },
      { onConflict: "customer_id,user_id", ignoreDuplicates: true }
    );
  }
}
