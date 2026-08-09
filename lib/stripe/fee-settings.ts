import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_STRIPE_FEE_SETTINGS,
  normalizeFeeSettings,
  type StripeFeeSettings,
} from "@/lib/stripe/fee";

/** Load company fee settings (service role so guest checkout works). */
export async function loadStripeFeeSettings(): Promise<StripeFeeSettings> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("company_settings")
      .select("stripe_fee_percent, stripe_fee_fixed")
      .limit(1)
      .maybeSingle();
    if (!data) return DEFAULT_STRIPE_FEE_SETTINGS;
    return normalizeFeeSettings(data);
  } catch {
    return DEFAULT_STRIPE_FEE_SETTINGS;
  }
}
