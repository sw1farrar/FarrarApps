"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AccountPasswordForm({ currentEmail }: { currentEmail: string }) {
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    if (!currentEmail) {
      toast.error("Missing account email");
      return;
    }

    setPending(true);
    const supabase = createClient();

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: currentEmail,
      password: currentPassword,
    });
    if (reauthError) {
      setPending(false);
      toast.error("Current password is incorrect");
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    setPending(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirm("");
    toast.success("Password updated");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="current_password">Current password</Label>
        <Input
          id="current_password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new_password">New password</Label>
        <Input
          id="new_password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm_password">Confirm new password</Label>
        <Input
          id="confirm_password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Update password
      </Button>
    </form>
  );
}
