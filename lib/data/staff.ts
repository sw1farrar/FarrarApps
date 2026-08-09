"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/data/activity";
import { sendBrevoEmail } from "@/lib/email/brevo";
import { buildStaffInviteEmail } from "@/lib/email/staff-invite-template";
import type { ActionResult } from "@/lib/data/customers";
import type { CompanySettings, UserRole } from "@/lib/types/database";

const INVITE_ROLES: UserRole[] = ["owner", "staff", "client"];

export async function inviteStaffMember(input: {
  email: string;
  fullName?: string;
  role?: UserRole;
}): Promise<ActionResult & { message?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Sign in to invite staff" };

  const { data: currentProfile, error: currentProfileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (currentProfileError || currentProfile?.role !== "owner") {
    return { ok: false, error: "Only owners can invite staff" };
  }

  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName?.trim() || null;
  const role: UserRole = input.role && INVITE_ROLES.includes(input.role)
    ? input.role
    : "staff";

  if (!email) return { ok: false, error: "Email is required" };

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (existing) return { ok: false, error: "That user already exists" };

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
  const { data, error } = await supabase
    .from("staff_invites")
    .insert({
      email,
      full_name: fullName,
      role,
      token,
      invited_by: user.id,
      expires_at: expiresAt.toISOString(),
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  const hdrs = await headers();
  const origin =
    hdrs.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";
  const loginUrl = `${origin}/login?email=${encodeURIComponent(email)}&invite=${encodeURIComponent(token)}`;
  const { data: company } = await supabase
    .from("company_settings")
    .select("*")
    .limit(1)
    .maybeSingle();
  const companyName = (company as CompanySettings | null)?.name || "Farrar Apps";
  const template = buildStaffInviteEmail({
    email,
    fullName,
    role,
    loginUrl,
    companyName,
  });

  const emailed = await sendBrevoEmail({
    toEmail: email,
    toName: fullName ?? undefined,
    subject: `You're invited to ${companyName}`,
    htmlContent: template.htmlContent,
    textContent: template.textContent,
  });

  if (!emailed.ok) return { ok: false, error: emailed.error };

  await logActivity({
    action: "staff_invite_sent",
    entity_type: "profile",
    entity_id: data.id,
    meta: { email, role, message_id: emailed.messageId ?? null },
  });

  revalidatePath("/settings");
  revalidatePath("/settings/users");
  return {
    ok: true,
    id: data.id,
    message: `Invite emailed to ${email} as ${role}`,
  };
}

export async function getStaffInviteByToken(
  token: string
): Promise<{
  email: string;
  full_name: string | null;
  role: UserRole;
} | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_staff_invite_by_token", {
    p_token: token,
  });

  if (error || !data?.length) return null;
  const invite = data[0] as {
    email: string;
    full_name: string | null;
    role: UserRole;
    expires_at: string;
    accepted_at: string | null;
  };

  if (invite.accepted_at) return null;
  if (new Date(invite.expires_at).getTime() < Date.now()) return null;

  return {
    email: invite.email,
    full_name: invite.full_name,
    role: invite.role,
  };
}

export async function acceptStaffInvite(
  token: string,
  userId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to accept this invite" };
  if (user.id !== userId) return { ok: false, error: "Invite user mismatch" };

  const { data: ok, error } = await supabase.rpc("accept_staff_invite", {
    p_token: token,
    p_user_id: userId,
  });

  if (error) return { ok: false, error: error.message };
  if (!ok) {
    return { ok: false, error: "Invite is invalid, expired, or already used" };
  }

  await logActivity({
    action: "staff_invite_accepted",
    entity_type: "profile",
    entity_id: userId,
    meta: { email: user.email },
  });

  revalidatePath("/settings");
  revalidatePath("/settings/users");
  return { ok: true, id: userId };
}
