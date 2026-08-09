import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_LOGO_STORAGE_PATH = "system/farrar_apps_logo.png";
/** Long enough for recipients to open the email; signed URLs are HTTPS and Gmail-safe. */
const EMAIL_LOGO_SIGNED_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * Email clients (especially Gmail) strip data: URIs and cannot load localhost.
 * Always return a publicly fetchable HTTPS URL from Supabase Storage.
 */
export async function resolveEmailLogoSrc(
  supabase: SupabaseClient,
  logoPath: string | null | undefined
): Promise<string> {
  const storagePath = logoPath || (await ensureDefaultLogoInStorage(supabase));
  if (!storagePath) return "";

  const { data: publicData } = supabase.storage
    .from("logos")
    .getPublicUrl(storagePath);
  // Prefer permanent public URL when the bucket is public.
  if (publicData?.publicUrl) {
    try {
      const head = await fetch(publicData.publicUrl, { method: "HEAD" });
      if (head.ok) {
        return `${publicData.publicUrl}?v=${encodeURIComponent(storagePath)}`;
      }
    } catch {
      // Fall through to signed URL.
    }
  }

  const { data, error } = await supabase.storage
    .from("logos")
    .createSignedUrl(storagePath, EMAIL_LOGO_SIGNED_TTL_SECONDS);
  if (!error && data?.signedUrl) {
    return data.signedUrl;
  }

  return "";
}

async function ensureDefaultLogoInStorage(
  supabase: SupabaseClient
): Promise<string | null> {
  const { data: existing } = await supabase.storage
    .from("logos")
    .list("system", { search: "farrar_apps_logo.png", limit: 1 });
  if (existing?.some((f) => f.name === "farrar_apps_logo.png")) {
    return DEFAULT_LOGO_STORAGE_PATH;
  }

  try {
    const file = await readFile(
      path.join(process.cwd(), "public", "farrar_apps_logo.png")
    );
    const { error } = await supabase.storage
      .from("logos")
      .upload(DEFAULT_LOGO_STORAGE_PATH, file, {
        contentType: "image/png",
        upsert: true,
      });
    if (error) {
      console.error("Failed to upload default email logo:", error.message);
      return null;
    }
    return DEFAULT_LOGO_STORAGE_PATH;
  } catch (err) {
    console.error("Failed to read default email logo:", err);
    return null;
  }
}
