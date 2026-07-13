"use server";

import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { sendBrevoEmail } from "@/lib/email/brevo";
import { buildDeviceVerifyEmail } from "@/lib/email/device-verify-template";
import {
  DEVICE_SESSION_OK_COOKIE,
  DEVICE_TOKEN_COOKIE,
  DEVICE_TOKEN_MAX_AGE,
} from "@/lib/auth/device-constants";
import {
  challengeExpiresAt,
  generateChallengeCode,
  hashChallengeCode,
} from "@/lib/auth/device-crypto";
import { sessionOkValue } from "@/lib/auth/device-session";

type ActionResult =
  | { status: "trusted" }
  | { status: "needs_verification" }
  | { status: "error"; error: string };

function cookieSecure() {
  return process.env.NODE_ENV === "production";
}

export async function getOrCreateDeviceToken(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(DEVICE_TOKEN_COOKIE)?.value;
  if (existing) return existing;

  const token = crypto.randomUUID();
  jar.set(DEVICE_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: DEVICE_TOKEN_MAX_AGE,
  });
  return token;
}

export async function isDeviceTrustedForUser(
  userId: string,
  deviceToken: string
): Promise<boolean> {
  const jar = await cookies();
  const sessionOk = jar.get(DEVICE_SESSION_OK_COOKIE)?.value;
  if (sessionOk === sessionOkValue(userId, deviceToken)) {
    return true;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("trusted_devices")
    .select("id")
    .eq("user_id", userId)
    .eq("device_token", deviceToken)
    .maybeSingle();

  return Boolean(data?.id);
}

export async function ensureDeviceAccess(input: {
  rememberComputer: boolean;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "error", error: "Not signed in" };
  }

  const deviceToken = await getOrCreateDeviceToken();
  const trusted = await isDeviceTrustedForUser(user.id, deviceToken);
  if (trusted) {
    await supabase
      .from("trusted_devices")
      .update({ last_used_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("device_token", deviceToken);
    return { status: "trusted" };
  }

  // Stash remember preference for the verify step
  const jar = await cookies();
  jar.set("fa_remember_device", input.rememberComputer ? "1" : "0", {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 30,
  });

  const sendResult = await sendDeviceChallengeEmail();
  if (sendResult.status === "error") return sendResult;
  return { status: "needs_verification" };
}

export async function sendDeviceChallengeEmail(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { status: "error", error: "Not signed in" };
  }

  const deviceToken = await getOrCreateDeviceToken();

  // Basic resend throttle: one active unexpired challenge per minute
  const { data: recent } = await supabase
    .from("device_challenges")
    .select("created_at")
    .eq("user_id", user.id)
    .eq("device_token", deviceToken)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent?.created_at) {
    const ageMs = Date.now() - new Date(recent.created_at).getTime();
    if (ageMs < 60_000) {
      return { status: "needs_verification" };
    }
  }

  const code = generateChallengeCode();
  const { error: insertError } = await supabase.from("device_challenges").insert({
    user_id: user.id,
    device_token: deviceToken,
    code_hash: hashChallengeCode(code),
    expires_at: challengeExpiresAt().toISOString(),
  });

  if (insertError) {
    return { status: "error", error: insertError.message };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const email = buildDeviceVerifyEmail({
    code,
    toName: profile?.full_name || user.email,
  });

  const sent = await sendBrevoEmail({
    toEmail: user.email,
    toName: profile?.full_name,
    subject: email.subject,
    htmlContent: email.htmlContent,
    textContent: email.textContent,
  });

  if (!sent.ok) {
    return { status: "error", error: sent.error };
  }

  return { status: "needs_verification" };
}

export async function verifyDeviceChallenge(input: {
  code: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "error", error: "Not signed in" };
  }

  const deviceToken = await getOrCreateDeviceToken();
  const codeHash = hashChallengeCode(input.code);

  const { data: challenge } = await supabase
    .from("device_challenges")
    .select("id, expires_at, consumed_at, code_hash")
    .eq("user_id", user.id)
    .eq("device_token", deviceToken)
    .eq("code_hash", codeHash)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!challenge) {
    return { status: "error", error: "Invalid verification code" };
  }

  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    return { status: "error", error: "That code has expired — request a new one" };
  }

  await supabase
    .from("device_challenges")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", challenge.id);

  const jar = await cookies();
  const remember = jar.get("fa_remember_device")?.value !== "0";
  const hdrs = await headers();
  const userAgent = hdrs.get("user-agent")?.slice(0, 300) || null;

  if (remember) {
    const { error } = await supabase.from("trusted_devices").upsert(
      {
        user_id: user.id,
        device_token: deviceToken,
        user_agent: userAgent,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "user_id,device_token" }
    );
    if (error) {
      return { status: "error", error: error.message };
    }
    jar.delete(DEVICE_SESSION_OK_COOKIE);
  } else {
    // Session-only trust — cleared when the browser closes
    jar.set(DEVICE_SESSION_OK_COOKIE, sessionOkValue(user.id, deviceToken), {
      httpOnly: true,
      secure: cookieSecure(),
      sameSite: "lax",
      path: "/",
    });
  }

  jar.delete("fa_remember_device");
  return { status: "trusted" };
}
