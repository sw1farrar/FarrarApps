import { createClient } from "@/lib/supabase/server";

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
