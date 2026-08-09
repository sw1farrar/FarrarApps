"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/data/customers";
import type { SavedView } from "@/lib/types/database";

export async function listSavedViews(entityType: string): Promise<SavedView[]> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return [];

  const { data } = await supabase
    .from("saved_views")
    .select("id, entity_type, name, filters, user_id, created_at")
    .eq("entity_type", entityType)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    entity: row.entity_type,
    name: row.name,
    filters: (row.filters ?? {}) as Record<string, string>,
    created_by: row.user_id,
    created_at: row.created_at,
  }));
}

export async function createSavedView(
  entityType: string,
  name: string,
  filters: Record<string, string>
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to save views" };

  const cleanName = name.trim();
  if (!cleanName) return { ok: false, error: "View name is required" };

  const { data, error } = await supabase
    .from("saved_views")
    .insert({
      user_id: user.id,
      entity_type: entityType,
      name: cleanName,
      filters,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/${entityType}`);
  return { ok: true, id: data.id };
}

export async function deleteSavedView(
  id: string,
  entityType: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in required" };

  const { error } = await supabase
    .from("saved_views")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("entity_type", entityType);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/${entityType}`);
  return { ok: true };
}
