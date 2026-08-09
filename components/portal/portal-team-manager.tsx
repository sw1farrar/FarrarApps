"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import {
  cancelPortalInviteById,
  invitePortalMember,
  removePortalMember,
  resendPortalInviteById,
  type PendingPortalInvite,
} from "@/lib/data/portal";
import type { CustomerMember } from "@/lib/types/database";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function PortalTeamManager({
  customerId,
  members,
  pendingInvites,
  canManage,
  showUnlinkAll,
  onUnlinkAll,
}: {
  customerId: string;
  members: CustomerMember[];
  pendingInvites: PendingPortalInvite[];
  canManage: boolean;
  showUnlinkAll?: boolean;
  onUnlinkAll?: () => Promise<void>;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, setPending] = React.useState<string | null>(null);
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    setPending(key);
    const result = await fn();
    setPending(null);
    if (!result.ok) {
      toast.error(result.error || "Something went wrong");
      return;
    }
    toast.success(result.message || "Updated");
    router.refresh();
  }

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    await run("invite", () =>
      invitePortalMember({ customerId, email, fullName })
    );
    setFullName("");
    setEmail("");
  }

  return (
    <div className="space-y-4">
      <Card className="shadow-none">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm">Portal members</CardTitle>
          <CardDescription className="text-xs">
            People who can sign in and access this company&apos;s portal
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 p-3 pt-0">
          {members.length ? (
            members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {m.profiles?.full_name || m.profiles?.email || "Member"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.profiles?.email}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="secondary">
                    {m.role === "company_admin" ? "Admin" : "Member"}
                  </Badge>
                  {canManage ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending !== null}
                      onClick={() =>
                        run(`rm-${m.id}`, () =>
                          removePortalMember(customerId, m.id)
                        )
                      }
                    >
                      {pending === `rm-${m.id}` ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : null}
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          )}
        </CardContent>
      </Card>

      {pendingInvites.length ? (
        <Card className="shadow-none">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm">Pending invites</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-3 pt-0">
            {pendingInvites.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-sm"
              >
                <div>
                  <p className="font-medium">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Expires {new Date(inv.expires_at).toLocaleDateString()}
                  </p>
                </div>
                {canManage ? (
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending !== null}
                      onClick={() =>
                        run(`rs-${inv.id}`, () =>
                          resendPortalInviteById(inv.id, customerId)
                        )
                      }
                    >
                      Resend
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending !== null}
                      onClick={() =>
                        run(`cx-${inv.id}`, () =>
                          cancelPortalInviteById(inv.id, customerId)
                        )
                      }
                    >
                      Cancel
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {canManage ? (
        <Card className="shadow-none">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm">Invite teammate</CardTitle>
            <CardDescription className="text-xs">
              They&apos;ll set a password and join this company&apos;s portal
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <form onSubmit={onInvite} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-name">Name</Label>
                  <Input
                    id="invite-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Alex Rivera"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-email">Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex@company.com"
                  />
                </div>
              </div>
              <Button type="submit" size="sm" disabled={pending !== null}>
                {pending === "invite" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Send invite
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {showUnlinkAll && onUnlinkAll ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending !== null}
          onClick={() => {
            void (async () => {
              const ok = await confirm({
                title: "Unlink all portal access?",
                description:
                  "Remove all portal members and pending invites for this customer.",
                confirmLabel: "Unlink all",
                variant: "destructive",
              });
              if (!ok) return;
              await run("unlink", async () => {
                await onUnlinkAll();
                return { ok: true, message: "Portal access cleared" };
              });
            })();
          }}
        >
          Unlink all portal access
        </Button>
      ) : null}
    </div>
  );
}
