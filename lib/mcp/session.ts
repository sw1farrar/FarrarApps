import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { runWithMcpAuth } from "@/lib/mcp/context";
import type { UserRole } from "@/lib/types/database";

export class McpToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpToolError";
  }
}

export type McpWhoami = {
  userId: string;
  email: string | null;
  name: string | null;
  role: UserRole;
};

export async function getMcpProfile(userId: string): Promise<McpWhoami> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new McpToolError(error.message);
  if (!data) throw new McpToolError("Account not found.");
  if (data.role !== "owner" && data.role !== "staff") {
    throw new McpToolError("MCP access is limited to owners and staff.");
  }
  return {
    userId: data.id,
    email: data.email ?? null,
    name: data.full_name ?? null,
    role: data.role as UserRole,
  };
}

export async function runAsMcpUser<T>(
  userId: string,
  fn: () => Promise<T>
): Promise<T> {
  const profile = await getMcpProfile(userId);
  return runWithMcpAuth(
    {
      keyId: "mcp",
      keyName: "mcp",
      userId: profile.userId,
      email: profile.email,
    },
    fn
  );
}

export function unwrapAction<T extends { ok: true } | { ok: false; error: string }>(
  result: T
): Exclude<T, { ok: false }> {
  if (!result.ok) throw new McpToolError(result.error);
  return result as Exclude<T, { ok: false }>;
}

export function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new McpToolError(`${label} is required.`);
  }
  return value.trim();
}

export function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function optionalBool(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function formFrom(
  args: Record<string, unknown>,
  keys: string[]
): FormData {
  const fd = new FormData();
  for (const key of keys) {
    const value = args[key];
    if (value == null || value === "") continue;
    if (typeof value === "boolean") {
      if (value) fd.set(key, "true");
      continue;
    }
    fd.set(key, String(value));
  }
  return fd;
}

export function clampLimit(limit: number | undefined, fallback = 50, max = 100): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(limit)));
}
