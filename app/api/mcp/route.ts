import { NextRequest, NextResponse } from "next/server";
import {
  MCP_CORS_HEADERS,
  jsonWithCors,
  mcpOptionsResponse,
  mcpUnauthorized,
  readBearerToken,
} from "@/lib/mcp/http";
import { isMcpAccessToken, resolveMcpAccessToken } from "@/lib/mcp/accessTokens";
import { OAuthError, verifyAccessToken } from "@/lib/mcp/oauth";
import { handleMcpPayload } from "@/lib/mcp/protocol";
import { getMcpProfile, McpToolError } from "@/lib/mcp/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function mcpResponse(body: unknown, sessionId: string | null) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;
  return jsonWithCors(body, { headers });
}

async function requireMcpUser(request: NextRequest) {
  const token = readBearerToken(request);
  if (!token) {
    return { error: mcpUnauthorized() };
  }
  try {
    let userId: string;
    if (isMcpAccessToken(token)) {
      const patUserId = await resolveMcpAccessToken(token);
      if (!patUserId) return { error: mcpUnauthorized() };
      userId = patUserId;
    } else {
      const access = verifyAccessToken(token);
      userId = access.userId;
    }
    await getMcpProfile(userId);
    return { userId };
  } catch (error) {
    if (error instanceof OAuthError && error.status === 403) {
      return { error: jsonWithCors({ error: "insufficient_scope" }, { status: 403 }) };
    }
    if (error instanceof McpToolError) {
      return { error: jsonWithCors({ error: error.message }, { status: 403 }) };
    }
    return { error: mcpUnauthorized() };
  }
}

export async function OPTIONS() {
  return mcpOptionsResponse();
}

export async function GET(request: NextRequest) {
  const auth = await requireMcpUser(request);
  if ("error" in auth && auth.error) return auth.error;
  return jsonWithCors({ error: "method_not_allowed" }, { status: 405 });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireMcpUser(request);
  if ("error" in auth && auth.error) return auth.error;
  return new NextResponse(null, { status: 204, headers: MCP_CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  const auth = await requireMcpUser(request);
  if ("error" in auth && auth.error) return auth.error;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonWithCors(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 400 }
    );
  }

  const result = await handleMcpPayload(payload, auth.userId!);
  const sessionId = request.headers.get("mcp-session-id");
  if (result === null) {
    return new NextResponse(null, { status: 202, headers: MCP_CORS_HEADERS });
  }
  return mcpResponse(result, sessionId);
}
