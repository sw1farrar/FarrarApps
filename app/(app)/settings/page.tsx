import { createClient } from "@/lib/supabase/server";
import type { CompanySettings } from "@/lib/types/database";
import { CompanySettingsForm } from "@/components/settings/settings-panels";

export default async function SettingsCompanyPage() {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("company_settings")
    .select(
      "id, name, address, email, phone, logo_path, invoice_terms, stripe_fee_percent, stripe_fee_fixed"
    )
    .limit(1)
    .maybeSingle();

  const companySettings = (settings as CompanySettings | null) ?? null;
  const { data: logo } = companySettings?.logo_path
    ? await supabase.storage
        .from("logos")
        .createSignedUrl(companySettings.logo_path, 60 * 10)
    : { data: null };

  return (
    <CompanySettingsForm
      settings={companySettings}
      logoUrl={logo?.signedUrl ?? null}
    />
  );
}
