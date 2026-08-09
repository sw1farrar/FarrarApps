import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client (bypasses RLS).
 * Does NOT fall back to anon in production — that silently breaks payment apply.
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured");
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (serviceKey) {
    return createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required in production for admin operations"
    );
  }

  // Local dev only: allow anon if service role missing (many ops will fail RLS)
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anon) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY required"
    );
  }
  console.warn(
    "[admin] SUPABASE_SERVICE_ROLE_KEY missing — using anon key (local only)"
  );
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
