"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Menu } from "lucide-react";
import { PortalSidebar } from "@/components/layout/portal-sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { createClient } from "@/lib/supabase/client";
import {
  getCachedProfile,
  loadProfileOnce,
} from "@/lib/auth/profile-cache";
import type { CustomerMemberRole, Profile } from "@/lib/types/database";

const NotificationsBell = dynamic(
  () =>
    import("@/components/layout/notifications-bell").then(
      (mod) => mod.NotificationsBell
    ),
  { ssr: false }
);

export function PortalShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [profile, setProfile] = React.useState<Profile | null>(
    getCachedProfile()
  );
  const [customerName, setCustomerName] = React.useState<string | null>(null);
  const [memberRole, setMemberRole] =
    React.useState<CustomerMemberRole | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void loadProfileOnce(async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from("profiles")
        .select(
          "id, email, full_name, role, theme_preference, avatar_url, created_at, updated_at"
        )
        .eq("id", user.id)
        .single();

      return (data as Profile | null) ?? null;
    }).then(async (next) => {
      if (cancelled) return;
      setProfile(next);
      if (!next) return;

      const supabase = createClient();
      const { data: membership } = await supabase
        .from("customer_members")
        .select("role, customers(name)")
        .eq("user_id", next.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (membership) {
        setMemberRole(membership.role as CustomerMemberRole);
        const customer = membership.customers as unknown as {
          name?: string;
        } | null;
        setCustomerName(customer?.name ?? null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ConfirmProvider>
      <div className="flex h-svh overflow-hidden bg-background">
        <div className="hidden md:flex">
          <PortalSidebar
            collapsed={collapsed}
            onToggle={() => setCollapsed((v) => !v)}
            profile={profile}
            customerName={customerName}
            memberRole={memberRole}
          />
        </div>

        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="w-[min(18rem,88vw)] p-0 md:hidden">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <PortalSidebar
              collapsed={false}
              onToggle={() => setMobileNavOpen(false)}
              profile={profile}
              customerName={customerName}
              memberRole={memberRole}
              onNavigate={() => setMobileNavOpen(false)}
              className="h-full w-full border-0"
            />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-3 sm:h-14 sm:px-4">
            <div className="flex min-w-0 items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="md:hidden"
                aria-label="Open navigation"
                onClick={() => setMobileNavOpen(true)}
              >
                <Menu className="size-4" />
              </Button>
              <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
                Client Portal
              </h1>
            </div>
            <div className="flex items-center gap-1">
              <NotificationsBell />
              {profile ? <ThemeToggle userId={profile.id} /> : null}
            </div>
          </header>
          <main className="min-h-0 flex-1 overflow-auto p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
            {children}
          </main>
        </div>
      </div>
    </ConfirmProvider>
  );
}
