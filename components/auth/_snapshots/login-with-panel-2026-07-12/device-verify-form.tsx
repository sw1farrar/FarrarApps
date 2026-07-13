"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  sendDeviceChallengeEmail,
  verifyDeviceChallenge,
} from "@/lib/auth/device-actions";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your email"),
});

type Values = z.infer<typeof schema>;

export function DeviceVerifyForm({ email }: { email?: string | null }) {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [resending, setResending] = React.useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { code: "" },
  });

  async function onSubmit(values: Values) {
    setSubmitting(true);
    const result = await verifyDeviceChallenge({ code: values.code });
    setSubmitting(false);

    if (result.status === "error") {
      toast.error(result.error);
      return;
    }

    toast.success("Computer verified");
    router.refresh();
  }

  async function onResend() {
    setResending(true);
    const result = await sendDeviceChallengeEmail();
    setResending(false);
    if (result.status === "error") {
      toast.error(result.error);
      return;
    }
    toast.success("New code sent");
  }

  async function onSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="w-full overflow-hidden rounded-lg border border-border/60 bg-card/70 shadow-none backdrop-blur-sm">
      <div className="border-b border-border/50 px-4 pt-4 pb-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/farrar_apps_logo.png?v=3"
          alt="Farrar Apps — Applications for Business"
          className="block h-auto w-full bg-transparent object-contain object-center"
        />
      </div>

      <form className="space-y-2.5 p-4" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-1">
          <Label htmlFor="code" className="text-xs">
            Verification code
          </Label>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Enter the 6-digit code
            {email ? (
              <>
                {" "}
                sent to <span className="text-foreground/90">{email}</span>
              </>
            ) : (
              " from your email"
            )}
            .
          </p>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            className="h-8 tracking-[0.28em] text-sm"
            maxLength={6}
            {...form.register("code")}
          />
          {form.formState.errors.code && (
            <p className="text-[11px] text-destructive">
              {form.formState.errors.code.message}
            </p>
          )}
        </div>
        <Button
          type="submit"
          size="sm"
          className="h-8 w-full"
          disabled={submitting}
        >
          {submitting && <Loader2 className="size-3.5 animate-spin" />}
          Verify and continue
        </Button>
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-full text-muted-foreground"
            disabled={resending}
            onClick={onResend}
          >
            {resending && <Loader2 className="size-3.5 animate-spin" />}
            Resend code
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-full text-muted-foreground"
            onClick={onSignOut}
          >
            Use a different account
          </Button>
        </div>
      </form>
    </div>
  );
}
