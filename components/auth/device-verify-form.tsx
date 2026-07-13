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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
    <Card className="w-full max-w-md border-border/80 bg-card/80 shadow-none">
      <CardHeader className="space-y-3">
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/farrar_apps_logo.png"
            alt="Farrar Apps"
            className="h-12 w-auto object-contain"
          />
        </div>
        <CardTitle className="text-center text-xl tracking-tight">
          Confirm it’s you
        </CardTitle>
        <CardDescription className="text-center">
          We sent a 6-digit code
          {email ? (
            <>
              {" "}
              to <span className="text-foreground">{email}</span>
            </>
          ) : (
            " to your email"
          )}
          . This is only required once per computer you choose to remember.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-1.5">
            <Label htmlFor="code">Verification code</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              className="tracking-[0.35em]"
              maxLength={6}
              {...form.register("code")}
            />
            {form.formState.errors.code && (
              <p className="text-xs text-destructive">
                {form.formState.errors.code.message}
              </p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Verify and continue
          </Button>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={resending}
              onClick={onResend}
            >
              {resending && <Loader2 className="size-4 animate-spin" />}
              Resend code
            </Button>
            <Button type="button" variant="ghost" onClick={onSignOut}>
              Use a different account
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
