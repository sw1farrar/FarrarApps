import { NextRequest } from "next/server";
import { jsonWithCors, mcpOptionsResponse } from "@/lib/mcp/http";
import {
  consumeAuthCode,
  consumeRefreshToken,
  createTokenPair,
  OAuthError,
  validateClient,
  validateClientId,
  verifyAuthCode,
  verifyPkce,
  verifyRefreshToken,
} from "@/lib/mcp/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readTokenBody(request: NextRequest): Promise<Record<string, string>> {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const json = (await request.json()) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(json).map(([key, value]) => [key, value == null ? "" : String(value)])
    );
  }
  return Object.fromEntries(new URLSearchParams(await request.text()));
}

export async function OPTIONS() {
  return mcpOptionsResponse();
}

export async function POST(request: NextRequest) {
  try {
    const body = await readTokenBody(request);
    const clientId = body.client_id;
    if (!clientId) {
      return jsonWithCors({ error: "invalid_request" }, { status: 400 });
    }

    if (body.grant_type === "refresh_token") {
      validateClientId(clientId);
      if (!body.refresh_token) throw new OAuthError("invalid_grant");
      const refresh = await verifyRefreshToken(body.refresh_token);
      if (refresh.client_id !== clientId) throw new OAuthError("invalid_grant");
      await consumeRefreshToken(refresh.jti);
      return jsonWithCors(
        await createTokenPair({
          clientId,
          scope: refresh.scope,
          userId: refresh.sub,
        })
      );
    }

    if (body.grant_type !== "authorization_code") {
      return jsonWithCors({ error: "unsupported_grant_type" }, { status: 400 });
    }

    const { code, redirect_uri, code_verifier } = body;
    if (!code || !redirect_uri || !code_verifier) {
      return jsonWithCors({ error: "invalid_request" }, { status: 400 });
    }

    validateClient(clientId, redirect_uri);
    const authCode = await verifyAuthCode(code);
    if (authCode.redirect_uri !== redirect_uri || authCode.client_id !== clientId) {
      throw new OAuthError("invalid_grant");
    }
    if (!(await verifyPkce(code_verifier, authCode.code_challenge))) {
      throw new OAuthError("invalid_grant");
    }
    await consumeAuthCode(authCode.jti);
    return jsonWithCors(
      await createTokenPair({
        clientId,
        scope: authCode.scope,
        userId: authCode.sub,
      })
    );
  } catch (error) {
    if (error instanceof OAuthError) {
      return jsonWithCors({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "";
    if (message === "mcp_oauth_table_missing") {
      return jsonWithCors(
        {
          error: "temporarily_unavailable",
          error_description: "MCP OAuth tables are missing. Apply the latest migration.",
        },
        { status: 503 }
      );
    }
    return jsonWithCors({ error: "invalid_grant" }, { status: 400 });
  }
}
