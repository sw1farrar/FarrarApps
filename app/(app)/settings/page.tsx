import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import type { Category, CompanySettings, Profile } from "@/lib/types/database";
import {
  CategoriesManager,
  CompanySettingsForm,
  UsersManager,
} from "@/components/settings/settings-panels";
import { DataExportCard } from "@/components/settings/data-export-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function SettingsPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const [{ data: settings }, { data: categories }, { data: users }] =
    await Promise.all([
      supabase.from("company_settings").select("*").limit(1).maybeSingle(),
      supabase.from("categories").select("*").order("name"),
      supabase.from("profiles").select("*").order("created_at"),
    ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Company profile, categories, email, and users.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <CompanySettingsForm settings={(settings as CompanySettings) ?? null} />
        <CategoriesManager categories={(categories ?? []) as Category[]} />
        <UsersManager
          users={(users ?? []) as Profile[]}
          canManage={profile?.role === "owner"}
        />
        <DataExportCard />
        <Card className="shadow-none">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm">Email (Brevo)</CardTitle>
            <CardDescription className="text-xs">
              Transactional invoice email via Brevo REST API. Sender:
              FarrarApps &lt;noreply@farrarapps.com&gt;.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0 text-sm text-muted-foreground">
            Status:{" "}
            {process.env.BREVO_API_KEY ? "configured" : "missing BREVO_API_KEY"}
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm">Keyboard shortcuts</CardTitle>
            <CardDescription className="text-xs">
              ⌘K search · g then d/c/p/i/t/r/s to jump · n then c/p/i/t to create
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
