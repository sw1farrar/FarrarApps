import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { McpAccessTokenError, revokeMcpAccessToken } from "@/lib/mcp/accessTokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (profile.role !== "owner") {
    return NextResponse.json(
      { error: "Only owners can manage MCP tokens." },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Token id is required." }, { status: 400 });
  }

  try {
    await revokeMcpAccessToken(profile.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof McpAccessTokenError) {
      const status =
        err.code === "not_found" ? 404 : err.code === "table_missing" ? 503 : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    return NextResponse.json({ error: "Could not revoke token." }, { status: 500 });
  }
}
