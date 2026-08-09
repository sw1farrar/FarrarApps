"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBrevoEmail } from "@/lib/email/brevo";
import {
  buildEmailChangeVerifyEmail,
  buildEmailChangedNoticeEmail,
} from "@/lib/email/email-change-template";
import {
  challengeExpiresAt,
  generateChallengeCode,
  hashChallengeCode,
} from "@/lib/auth/device-crypto";

type ActionResult = { ok: true } | { ok: false; error: string };

type RequestResult =
  | { ok: true; newEmail: string }
  | { ok: false; error: string };

function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Verify password without touching the browser cookie session.
 *
 * IMPORTANT: never call signOut() with default scope ("global") — that
 * revokes ALL sessions for the user and logs them out of the app mid-flow.
 * Use scope "local" only so only this temporary in-memory session is cleared.
 */
async function verifyCurrentPassword(
  email: string,
  password: string,
  expectedUserId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return { ok: false, error: "Auth is not configured" };
  }

  const temp = createSupabaseJsClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await temp.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return { ok: false, error: "Current password is incorrect" };
  }
  if (data.user.id !== expectedUserId) {
    await temp.auth.signOut({ scope: "local" }).catch(() => undefined);
    return { ok: false, error: "Current password is incorrect" };
  }

  // Local only — must not invalidate the user's real browser session
  await temp.auth.signOut({ scope: "local" }).catch(() => undefined);
  return { ok: true };
}

async function emailAlreadyTaken(
  newEmail: string,
  excludeUserId: string
): Promise<boolean> {
  const admin = createAdminClient();

  const { data: profileHit } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", newEmail)
    .neq("id", excludeUserId)
    .maybeSingle();

  if (profileHit?.id) return true;

  // Auth users: list is paginated; prefer getUserByEmail if available on this SDK.
  // Fallback: scan first pages of listUsers filtered by email match.
  try {
    // @supabase/supabase-js v2 admin may expose getUserByEmail in some versions
    const byEmail = (
      admin.auth.admin as {
        getUserByEmail?: (
          email: string
        ) => Promise<{ data: { user: { id: string } | null }; error: unknown }>;
      }
    ).getUserByEmail;

    if (typeof byEmail === "function") {
      const { data } = await byEmail.call(admin.auth.admin, newEmail);
      if (data?.user && data.user.id !== excludeUserId) return true;
      return false;
    }
  } catch {
    // fall through
  }

  const { data: listed } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  const conflict = listed?.users?.find(
    (u) =>
      u.email?.toLowerCase() === newEmail && u.id !== excludeUserId
  );
  return Boolean(conflict);
}

/**
 * Start email change: re-check password, send 6-digit code to the NEW address only.
 */
export async function requestEmailChange(input: {
  newEmail: string;
  currentPassword: string;
}): Promise<RequestResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { ok: false, error: "Not signed in" };
  }

  const newEmail = normalizeEmail(input.newEmail);
  if (!isValidEmail(newEmail)) {
    return { ok: false, error: "Enter a valid email address" };
  }
  if (newEmail === user.email.toLowerCase()) {
    return { ok: false, error: "That is already your current email" };
  }

  const passwordCheck = await verifyCurrentPassword(
    user.email,
    input.currentPassword,
    user.id
  );
  if (!passwordCheck.ok) return passwordCheck;

  if (await emailAlreadyTaken(newEmail, user.id)) {
    return { ok: false, error: "That email is already in use" };
  }

  // Throttle: one active unexpired challenge per 60s
  const { data: recent } = await supabase
    .from("email_change_requests")
    .select("created_at")
    .eq("user_id", user.id)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent?.created_at) {
    const ageMs = Date.now() - new Date(recent.created_at).getTime();
    if (ageMs < 60_000) {
      return {
        ok: false,
        error: "Please wait a minute before requesting another code",
      };
    }
  }

  // Invalidate prior open requests for this user
  await supabase
    .from("email_change_requests")
    .update({ consumed_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("consumed_at", null);

  const code = generateChallengeCode();
  const { error: insertError } = await supabase
    .from("email_change_requests")
    .insert({
      user_id: user.id,
      new_email: newEmail,
      code_hash: hashChallengeCode(code),
      expires_at: challengeExpiresAt().toISOString(),
    });

  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const email = buildEmailChangeVerifyEmail({
    code,
    toName: profile?.full_name || newEmail,
    newEmail,
  });

  const sent = await sendBrevoEmail({
    toEmail: newEmail,
    toName: profile?.full_name,
    subject: email.subject,
    htmlContent: email.htmlContent,
    textContent: email.textContent,
  });

  if (!sent.ok) {
    return { ok: false, error: sent.error };
  }

  return { ok: true, newEmail };
}

/**
 * Resend code for the latest open request (same new email). Requires password again for safety.
 */
export async function resendEmailChangeCode(input: {
  currentPassword: string;
}): Promise<RequestResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { ok: false, error: "Not signed in" };
  }

  const passwordCheck = await verifyCurrentPassword(
    user.email,
    input.currentPassword,
    user.id
  );
  if (!passwordCheck.ok) return passwordCheck;

  const { data: open } = await supabase
    .from("email_change_requests")
    .select("id, new_email, created_at")
    .eq("user_id", user.id)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!open?.new_email) {
    return {
      ok: false,
      error: "No pending email change — start again with a new email",
    };
  }

  return requestEmailChange({
    newEmail: open.new_email,
    currentPassword: input.currentPassword,
  });
}

/**
 * Verify 6-digit code sent to the new address, then commit Auth + profiles.email.
 */
export async function confirmEmailChange(input: {
  code: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in" };
  }

  const code = String(input.code || "").trim();
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, error: "Enter the 6-digit code" };
  }

  const codeHash = hashChallengeCode(code);
  const { data: request } = await supabase
    .from("email_change_requests")
    .select("id, new_email, expires_at, code_hash")
    .eq("user_id", user.id)
    .eq("code_hash", codeHash)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!request) {
    return { ok: false, error: "Invalid verification code" };
  }

  if (new Date(request.expires_at).getTime() < Date.now()) {
    return {
      ok: false,
      error: "That code has expired — request a new one",
    };
  }

  const newEmail = normalizeEmail(request.new_email);
  if (await emailAlreadyTaken(newEmail, user.id)) {
    return { ok: false, error: "That email is already in use" };
  }

  const admin = createAdminClient();
  const previousEmail = user.email;

  const { error: authError } = await admin.auth.admin.updateUserById(user.id, {
    email: newEmail,
    email_confirm: true,
  });

  if (authError) {
    return { ok: false, error: authError.message };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ email: newEmail })
    .eq("id", user.id);

  if (profileError) {
    // Roll auth email back so login identity stays consistent with profiles
    await admin.auth.admin
      .updateUserById(user.id, {
        email: previousEmail || undefined,
        email_confirm: true,
      })
      .catch(() => undefined);
    return {
      ok: false,
      error: `Could not update profile email: ${profileError.message}`,
    };
  }

  await admin
    .from("email_change_requests")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", request.id);

  // Security notice to the previous address (best-effort)
  if (previousEmail) {
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    const notice = buildEmailChangedNoticeEmail({
      toName: profile?.full_name,
      oldEmail: previousEmail,
      newEmail,
    });

    await sendBrevoEmail({
      toEmail: previousEmail,
      toName: profile?.full_name,
      subject: notice.subject,
      htmlContent: notice.htmlContent,
      textContent: notice.textContent,
    }).catch(() => undefined);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/account");
  revalidatePath("/portal");
  revalidatePath("/portal/settings");
  revalidatePath("/dashboard");

  return { ok: true };
}
