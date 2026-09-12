import "server-only";
import {
  createAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";

export type OAuthTicketKind = "auth_code" | "refresh_token";

export type OAuthTicketStore = {
  issue: (jti: string, kind: OAuthTicketKind, userId: string, expiresAt: Date) => Promise<void>;
  consume: (jti: string, kind: OAuthTicketKind) => Promise<boolean>;
};

type MemoryRow = {
  kind: OAuthTicketKind;
  userId: string;
  expiresAt: number;
  consumed: boolean;
};

const memoryTickets = new Map<string, MemoryRow>();

export const memoryOAuthTicketStore: OAuthTicketStore = {
  async issue(jti, kind, userId, expiresAt) {
    memoryTickets.set(jti, {
      kind,
      userId,
      expiresAt: expiresAt.getTime(),
      consumed: false,
    });
  },
  async consume(jti, kind) {
    const row = memoryTickets.get(jti);
    if (!row || row.kind !== kind || row.consumed || row.expiresAt <= Date.now()) {
      return false;
    }
    row.consumed = true;
    return true;
  },
};

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

export const supabaseOAuthTicketStore: OAuthTicketStore = {
  async issue(jti, kind, userId, expiresAt) {
    const admin = createAdminClient();
    const { error } = await admin.from("mcp_oauth_jtis").insert({
      jti,
      kind,
      user_id: userId,
      expires_at: expiresAt.toISOString(),
    });
    if (error) {
      if (isSchemaMissing(error)) {
        throw new Error("mcp_oauth_table_missing");
      }
      throw new Error("oauth_store_unavailable");
    }
  },
  async consume(jti, kind) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("mcp_oauth_jtis")
      .update({ consumed_at: new Date().toISOString() })
      .eq("jti", jti)
      .eq("kind", kind)
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .select("jti")
      .maybeSingle();
    if (error) {
      if (isSchemaMissing(error)) {
        throw new Error("mcp_oauth_table_missing");
      }
      throw new Error("oauth_store_unavailable");
    }
    return Boolean((data as { jti?: string } | null)?.jti);
  },
};

export function getOAuthTicketStore(): OAuthTicketStore {
  if (process.env.NODE_ENV === "test") return memoryOAuthTicketStore;
  if (!isSupabaseAdminConfigured()) {
    throw new Error("oauth_store_unavailable");
  }
  return supabaseOAuthTicketStore;
}
