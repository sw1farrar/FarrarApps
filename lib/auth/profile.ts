import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/database";

/** Dedupes auth+profile fetches within a single RSC request tree. */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  // Middleware already gated identity; use local session (no Auth /user RTT).
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, role, theme_preference, avatar_url, created_at, updated_at"
    )
    .eq("id", user.id)
    .single();

  return data as Profile | null;
});
