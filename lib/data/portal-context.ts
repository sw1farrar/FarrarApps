import { cache } from "react";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import type { CustomerMemberRole, Profile } from "@/lib/types/database";

export type PortalCustomer = {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
};

export const requirePortalContext = cache(async (): Promise<{
  profile: Profile;
  customer: PortalCustomer | null;
  memberRole: CustomerMemberRole | null;
}> => {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "client") redirect("/dashboard");

  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("customer_members")
    .select("customer_id, role, customers(id, name, email, company)")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membership?.customers) {
    const c = membership.customers as unknown as PortalCustomer;
    return {
      profile,
      customer: c,
      memberRole: membership.role as CustomerMemberRole,
    };
  }

  // Legacy fallback while portal_user_id still exists
  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, email, company")
    .eq("portal_user_id", profile.id)
    .maybeSingle();

  return {
    profile,
    customer: (customer as PortalCustomer | null) ?? null,
    memberRole: customer ? "company_admin" : null,
  };
});
