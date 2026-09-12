import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/mcp/rateLimit";
import {
  createAuthCode,
  GROK_REDIRECT_URI,
  OAuthError,
  parseAuthorizationRequest,
} from "@/lib/mcp/oauth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function grokRedirect(code: string | null, state: string, error?: string) {
  const url = new URL(GROK_REDIRECT_URI);
  if (error) url.searchParams.set("error", error);
  if (code) url.searchParams.set("code", code);
  if (state) url.searchParams.set("state", state);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const values = new URLSearchParams();
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") values.set(key, value);
  }

  let authRequest;
  try {
    authRequest = parseAuthorizationRequest(values);
  } catch (error) {
    const message = error instanceof OAuthError ? error.message : "invalid_request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (values.get("decision") === "deny") {
    return grokRedirect(null, authRequest.state, "access_denied");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const next = `/oauth/authorize?${values.toString()}`;
    const login = new URL("/login", request.url);
    login.searchParams.set("next", next);
    return NextResponse.redirect(login, 303);
  }

  const rate = checkRateLimit(`mcp-oauth-consent:${user.id}`, 20, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: "temporarily_unavailable",
        error_description: "Too many authorization attempts.",
      },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "owner" && profile?.role !== "staff") {
    return grokRedirect(null, authRequest.state, "access_denied");
  }

  try {
    const code = await createAuthCode({ ...authRequest, userId: user.id });
    return grokRedirect(code, authRequest.state);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "mcp_oauth_table_missing") {
      return NextResponse.json(
        {
          error: "temporarily_unavailable",
          error_description: "MCP OAuth tables are missing. Apply the latest migration.",
        },
        { status: 503 }
      );
    }
    console.error("[mcp oauth] failed to issue authorization code", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
