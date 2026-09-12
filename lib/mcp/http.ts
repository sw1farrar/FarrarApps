import { NextResponse } from "next/server";
import { getMcpIssuer } from "@/lib/mcp/config";

export const MCP_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id",
  "Cache-Control": "no-store",
};

export function mcpOptionsResponse() {
  return new NextResponse(null, { status: 204, headers: MCP_CORS_HEADERS });
}

export function jsonWithCors(
  body: unknown,
  init?: { status?: number; headers?: Record<string, string> }
) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: { ...MCP_CORS_HEADERS, ...(init?.headers ?? {}) },
  });
}

export function mcpUnauthorized(error = "invalid_token") {
  const metadata = `${getMcpIssuer()}/.well-known/oauth-protected-resource/api/mcp`;
  return new NextResponse(JSON.stringify({ error }), {
    status: 401,
    headers: {
      ...MCP_CORS_HEADERS,
      "Content-Type": "application/json",
      "WWW-Authenticate": `Bearer error="${error}", resource_metadata="${metadata}"`,
    },
  });
}

export function readBearerToken(request: Request): string | null {
  const header =
    request.headers.get("authorization") || request.headers.get("Authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

/** Token-only MCP hosts (Grok Bot) may send a PAT in a header or ?token=. */
export function readMcpAccessToken(request: Request): string | null {
  const bearer = readBearerToken(request);
  if (bearer) return bearer;
  const apiKey = request.headers.get("x-api-key")?.trim();
  if (apiKey) return apiKey;
  try {
    const token = new URL(request.url).searchParams.get("token")?.trim();
    if (token) return token;
  } catch {
    // ignore invalid URLs
  }
  return null;
}
