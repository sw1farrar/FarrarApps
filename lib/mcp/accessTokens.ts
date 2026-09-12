import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import {
  createAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";

export const MCP_ACCESS_TOKEN_PREFIX = "fa_mcp_";
export const MCP_ACCESS_TOKEN_MAX_PER_USER = 5;

export type McpAccessTokenSummary = {
  id: string;
  name: string;
  tokenPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export class McpAccessTokenError extends Error {
  constructor(
    message: string,
    readonly code:
      | "not_configured"
      | "table_missing"
      | "limit_reached"
      | "not_found"
      | "invalid_name"
      | "forbidden" = "not_found"
  ) {
    super(message);
    this.name = "McpAccessTokenError";
  }
}

export function isMcpAccessToken(token: string): boolean {
  return token.startsWith(MCP_ACCESS_TOKEN_PREFIX) && !token.includes(".");
}

export function hashMcpAccessToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function hashesMatch(storedHex: string, candidateHex: string): boolean {
  const stored = Buffer.from(storedHex, "hex");
  const candidate = Buffer.from(candidateHex, "hex");
  if (stored.length !== candidate.length || stored.length === 0) return false;
  return timingSafeEqual(stored, candidate);
}

function isSchemaMissing(error: unknown): boolean {
  const e = error as { code?: string; message?: string };
  const message = typeof e?.message === "string" ? e.message : "";
  return (
    e?.code === "PGRST205" ||
    e?.code === "42P01" ||
    message.includes("Could not find the table") ||
    (message.includes("relation") && message.includes("does not exist"))
  );
}

function admin() {
  if (!isSupabaseAdminConfigured()) {
    throw new McpAccessTokenError("MCP tokens are not available.", "not_configured");
  }
  return createAdminClient();
}

function normalizeName(name: string | undefined): string {
  const trimmed = name?.trim() || "Grok bot";
  if (trimmed.length > 80) {
    throw new McpAccessTokenError("Name is too long.", "invalid_name");
  }
  return trimmed;
}

export async function listMcpAccessTokens(
  userId: string
): Promise<McpAccessTokenSummary[]> {
  const supabase = admin();
  const { data, error } = await supabase
    .from("mcp_access_tokens")
    .select("id, name, token_prefix, created_at, last_used_at")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) {
    if (isSchemaMissing(error)) {
      throw new McpAccessTokenError(
        "Run the MCP access tokens migration.",
        "table_missing"
      );
    }
    throw new McpAccessTokenError("Could not list tokens.");
  }
  return (
    (data ?? []) as Array<{
      id: string;
      name: string;
      token_prefix: string;
      created_at: string;
      last_used_at: string | null;
    }>
  ).map((row) => ({
    id: row.id,
    name: row.name,
    tokenPrefix: row.token_prefix,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  }));
}

export async function createMcpAccessToken(
  userId: string,
  name?: string
): Promise<{ token: string; summary: McpAccessTokenSummary }> {
  const supabase = admin();
  const existing = await listMcpAccessTokens(userId);
  if (existing.length >= MCP_ACCESS_TOKEN_MAX_PER_USER) {
    throw new McpAccessTokenError(
      `You can have at most ${MCP_ACCESS_TOKEN_MAX_PER_USER} active tokens.`,
      "limit_reached"
    );
  }

  const secret = randomBytes(32).toString("base64url");
  const token = `${MCP_ACCESS_TOKEN_PREFIX}${secret}`;
  const tokenPrefix = `${token.slice(0, 12)}…`;
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("mcp_access_tokens")
    .insert({
      user_id: userId,
      name: normalizeName(name),
      token_hash: hashMcpAccessToken(token),
      token_prefix: tokenPrefix,
      created_at: now,
    })
    .select("id, name, token_prefix, created_at, last_used_at")
    .single();
  if (error || !data) {
    if (isSchemaMissing(error)) {
      throw new McpAccessTokenError(
        "Run the MCP access tokens migration.",
        "table_missing"
      );
    }
    throw new McpAccessTokenError("Could not create token.");
  }
  const created = data as {
    id: string;
    name: string;
    token_prefix: string;
    created_at: string;
    last_used_at: string | null;
  };
  return {
    token,
    summary: {
      id: created.id,
      name: created.name,
      tokenPrefix: created.token_prefix,
      createdAt: created.created_at,
      lastUsedAt: created.last_used_at,
    },
  };
}

export async function revokeMcpAccessToken(
  userId: string,
  tokenId: string
): Promise<void> {
  const supabase = admin();
  const { data, error } = await supabase
    .from("mcp_access_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", tokenId)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (error) {
    if (isSchemaMissing(error)) {
      throw new McpAccessTokenError(
        "Run the MCP access tokens migration.",
        "table_missing"
      );
    }
    throw new McpAccessTokenError("Could not revoke token.");
  }
  if (!data) {
    throw new McpAccessTokenError("Token not found.", "not_found");
  }
}

export async function resolveMcpAccessToken(
  token: string
): Promise<string | null> {
  if (!isMcpAccessToken(token)) return null;
  if (!isSupabaseAdminConfigured()) return null;
  const supabase = createAdminClient();
  const tokenHash = hashMcpAccessToken(token);
  const { data, error } = await supabase
    .from("mcp_access_tokens")
    .select("id, user_id, token_hash, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as {
    id: string;
    user_id: string;
    token_hash: string;
    revoked_at: string | null;
  };
  if (row.revoked_at) return null;
  if (!hashesMatch(row.token_hash, tokenHash)) return null;
  void Promise.resolve(
    supabase
      .from("mcp_access_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", row.id)
  ).catch(() => undefined);
  return row.user_id;
}
