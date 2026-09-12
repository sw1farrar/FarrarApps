import { jsonWithCors, mcpOptionsResponse } from "@/lib/mcp/http";
import { protectedResourceMetadata } from "@/lib/mcp/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return mcpOptionsResponse();
}

export async function GET() {
  return jsonWithCors(protectedResourceMetadata());
}
