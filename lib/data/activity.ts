import { createClient } from "@/lib/supabase/server";
import type { ActivityLog } from "@/lib/types/database";

export type ActivityLogRow = ActivityLog & {
  profiles?: { email: string | null; full_name: string | null } | null;
};

export async function listActivity(opts?: number | {
  limit?: number;
  offset?: number;
  entity_type?: string;
}): Promise<ActivityLogRow[]> {
  const supabase = await createClient();
  const options = typeof opts === "number" ? { limit: opts } : opts;
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
  const offset = Math.max(options?.offset ?? 0, 0);

  let query = supabase
    .from("activity_logs")
    .select("id, actor_id, action, entity_type, entity_id, meta, created_at")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (options?.entity_type) {
    query = query.eq("entity_type", options.entity_type);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as ActivityLogRow[];
  const actorIds = Array.from(
    new Set(rows.map((row) => row.actor_id).filter(Boolean) as string[])
  );
  if (!actorIds.length) return rows;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .in("id", actorIds);
  const byId = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return rows.map((row) => ({
    ...row,
    profiles: row.actor_id ? (byId.get(row.actor_id) ?? null) : null,
  })) as ActivityLogRow[];
}

export async function logActivity(input: {
  action: string;
  entity_type: string;
  entity_id?: string | null;
  meta?: Record<string, unknown>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("activity_logs").insert({
    actor_id: user?.id ?? null,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id ?? null,
    meta: input.meta ?? {},
  });
}

