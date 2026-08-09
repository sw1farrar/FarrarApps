import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import type { Profile } from "@/lib/types/database";
import { getClientPortalLinks } from "@/lib/data/portal-status";
import { UsersManager } from "@/components/settings/settings-panels";

export default async function SettingsUsersPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .order("created_at");

  const list = (users ?? []) as Profile[];
  const clientIds = list.filter((u) => u.role === "client").map((u) => u.id);
  const clientLinks = await getClientPortalLinks(clientIds);

  return (
    <UsersManager
      users={list}
      canManage={profile?.role === "owner"}
      clientLinks={clientLinks}
    />
  );
}
