import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { checkRateLimit } from "@/lib/mcp/rateLimit";
import {
  McpAccessTokenError,
  createMcpAccessToken,
  listMcpAccessTokens,
} from "@/lib/mcp/accessTokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireOwner() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (profile.role !== "owner") {
    return {
      error: NextResponse.json(
        { error: "Only owners can manage MCP tokens." },
        { status: 403 }
      ),
    };
  }
  return { profile };
}

function tokenError(err: unknown) {
  if (err instanceof McpAccessTokenError) {
    const status =
      err.code === "limit_reached" || err.code === "invalid_name"
        ? 400
        : err.code === "table_missing" || err.code === "not_configured"
          ? 503
          : 400;
    return NextResponse.json({ error: err.message, code: err.code }, { status });
  }
  return NextResponse.json({ error: "Token request failed." }, { status: 500 });
}

export async function GET() {
  const auth = await requireOwner();
  if ("error" in auth && auth.error) return auth.error;
  try {
    const tokens = await listMcpAccessTokens(auth.profile!.id);
    return NextResponse.json({ ok: true, tokens });
  } catch (err) {
    return tokenError(err);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireOwner();
  if ("error" in auth && auth.error) return auth.error;

  const rate = checkRateLimit(`mcp-pat-create:${auth.profile!.id}`, 8, 10 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many tokens created. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  let name: string | undefined;
  try {
    const body = (await request.json()) as { name?: string };
    name = body.name;
  } catch {
    name = undefined;
  }

  try {
    const created = await createMcpAccessToken(auth.profile!.id, name);
    return NextResponse.json({
      ok: true,
      token: created.token,
      summary: created.summary,
    });
  } catch (err) {
    return tokenError(err);
  }
}
