"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const [sessionError, setSessionError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event: string, nextSession: { user?: unknown } | null) => {
        if (cancelled) return;
        if (
          nextSession &&
          (event === "PASSWORD_RECOVERY" ||
            event === "SIGNED_IN" ||
            event === "INITIAL_SESSION" ||
            event === "TOKEN_REFRESHED")
        ) {
          setReady(true);
          setSessionError(null);
        }
      }
    );

    void supabase.auth.getSession().then((result: {
      data: { session: { user?: unknown } | null };
    }) => {
      if (cancelled) return;
      if (result.data.session) {
        setReady(true);
      }
    });

    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      void supabase.auth.getSession().then((result: {
        data: { session: { user?: unknown } | null };
      }) => {
        if (cancelled) return;
        if (result.data.session) {
          setReady(true);
        } else {
          setSessionError(
            "This reset link is invalid or has expired. Request a new one from the sign-in page."
          );
        }
      });
    }, 2000);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated — sign in with your new password");
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="w-full overflow-hidden bg-transparent shadow-none">
      <div className="px-0 pt-0 pb-3 max-sm:pb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/farrar_apps_logo.png?v=3"
          alt="Farrar Apps — Applications for Business"
          className="block h-auto w-full bg-transparent object-contain object-center"
        />
      </div>

      {sessionError && !ready ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-background/30 px-3 py-3 text-sm text-muted-foreground">
            {sessionError}
          </div>
          <Link
            href="/login"
            className={cn(buttonVariants({ size: "sm" }), "w-full")}
          >
            Back to sign in
          </Link>
        </div>
      ) : !ready ? (
        <div className="flex min-h-[8rem] items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <form
          className="space-y-2.5 px-0 pb-0 pt-0 max-sm:space-y-3.5"
          onSubmit={onSubmit}
        >
          <div className="rounded-lg border border-border bg-background/30 px-2.5 py-2 text-xs text-muted-foreground">
            Choose a new password for your account.
          </div>
          <div className="space-y-1 max-sm:space-y-1.5">
            <Label htmlFor="new_password" className="text-xs">
              New password
            </Label>
            <Input
              id="new_password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-8 text-sm max-sm:h-11 max-sm:text-base"
            />
          </div>
          <div className="space-y-1 max-sm:space-y-1.5">
            <Label htmlFor="confirm_new_password" className="text-xs">
              Confirm password
            </Label>
            <Input
              id="confirm_new_password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="h-8 text-sm max-sm:h-11 max-sm:text-base"
            />
          </div>
          <div className="pt-1 max-sm:pt-2">
            <Button
              type="submit"
              size="sm"
              className="h-8 w-full max-sm:h-11 max-sm:text-sm"
              disabled={submitting}
            >
              {submitting && <Loader2 className="size-3.5 animate-spin" />}
              Update password
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
