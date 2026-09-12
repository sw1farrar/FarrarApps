import { NextRequest } from "next/server";
import { jsonWithCors, mcpOptionsResponse } from "@/lib/mcp/http";
import { OAuthError, registerGrokClient } from "@/lib/mcp/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return mcpOptionsResponse();
}

export async function POST(request: NextRequest) {
  try {
    const metadata = await request.json();
    return jsonWithCors(registerGrokClient(metadata), { status: 201 });
  } catch (error) {
    const code = error instanceof OAuthError ? error.message : "invalid_client_metadata";
    return jsonWithCors({ error: code }, { status: 400 });
  }
}
