"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  confirmEmailChange,
  requestEmailChange,
  resendEmailChangeCode,
} from "@/lib/auth/email-change-actions";
import { setCachedProfile } from "@/lib/auth/profile-cache";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Profile } from "@/lib/types/database";

export function AccountEmailForm({
  currentEmail,
  profile,
}: {
  currentEmail: string;
  profile?: Profile | null;
}) {
  const router = useRouter();
  const [step, setStep] = React.useState<"edit" | "verify">("edit");
  const [newEmail, setNewEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [pendingEmail, setPendingEmail] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function onRequest(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const result = await requestEmailChange({
      newEmail,
      currentPassword: password,
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setPendingEmail(result.newEmail);
    setStep("verify");
    setCode("");
    toast.success(`Code sent to ${result.newEmail}`);
  }

  async function onResend() {
    setPending(true);
    const result = await resendEmailChangeCode({
      currentPassword: password,
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setPendingEmail(result.newEmail);
    toast.success(`New code sent to ${result.newEmail}`);
  }

  async function onConfirm(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const result = await confirmEmailChange({ code });
    if (!result.ok) {
      setPending(false);
      toast.error(result.error);
      return;
    }

    const supabase = createClient();
    // Prefer re-auth with the new email if we still have the password in state;
    // refreshSession alone can fail after admin email change and look like a logout.
    if (password && pendingEmail) {
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: pendingEmail,
        password,
      });
      if (reauthError) {
        // Fall back to refresh; if that also fails, send them to login with guidance
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          setPending(false);
          toast.success(
            `Email updated to ${pendingEmail}. Sign in again with your new email.`
          );
          router.push("/login");
          router.refresh();
          return;
        }
      }
    } else {
      await supabase.auth.refreshSession().catch(() => undefined);
    }

    if (profile) {
      setCachedProfile({ ...profile, email: pendingEmail });
    }
    setPending(false);
    toast.success("Email updated");
    setStep("edit");
    setNewEmail("");
    setPassword("");
    setCode("");
    setPendingEmail("");
    router.refresh();
  }

  if (step === "verify") {
    return (
      <form onSubmit={onConfirm} className="space-y-3">
        <p className="text-xs text-muted-foreground">
          We sent a 6-digit code to{" "}
          <span className="font-medium text-foreground">{pendingEmail}</span>.
          Your login email will not change until you enter the code.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="email_code">Verification code</Label>
          <Input
            id="email_code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder="000000"
            className="tracking-[0.35em] font-mono"
            required
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={pending || code.length !== 6}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Confirm email
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => void onResend()}
          >
            Resend code
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setStep("edit");
              setCode("");
            }}
          >
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={onRequest} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="current_email">Current email</Label>
        <Input
          id="current_email"
          value={currentEmail}
          disabled
          readOnly
        />
        <p className="text-[11px] text-muted-foreground">
          This is your login email
          {profile?.role === "client"
            ? " (not your company billing contact)."
            : "."}
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new_email">New email</Label>
        <Input
          id="new_email"
          type="email"
          autoComplete="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email_current_password">Current password</Label>
        <Input
          id="email_current_password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Send verification code
      </Button>
    </form>
  );
}
