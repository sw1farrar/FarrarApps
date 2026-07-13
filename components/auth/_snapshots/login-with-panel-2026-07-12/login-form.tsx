"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ensureDeviceAccess } from "@/lib/auth/device-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [signingUp, setSigningUp] = React.useState(false);
  const [rememberComputer, setRememberComputer] = React.useState(true);

  const passwordForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: defaultEmail, password: "" },
  });

  async function finishAuth() {
    const device = await ensureDeviceAccess({ rememberComputer });
    if (device.status === "error") {
      toast.error(device.error);
      return;
    }
    if (device.status === "needs_verification") {
      toast.message("Check your email for a verification code");
      router.push("/login/verify");
      router.refresh();
      return;
    }
    toast.success("Signed in");
    router.refresh();
  }

  async function onPasswordSubmit(values: LoginValues) {
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) {
      setSubmitting(false);
      toast.error(error.message);
      return;
    }

    await finishAuth();
    setSubmitting(false);
  }

  async function onSignUp(values: LoginValues) {
    setSigningUp(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setSigningUp(false);
      toast.error(error.message);
      return;
    }

    await finishAuth();
    setSigningUp(false);
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

      <form
        className="space-y-2.5 p-4"
        onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
      >
        <div className="space-y-1">
          <Label htmlFor="email" className="text-xs">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            className="h-8 text-sm"
            {...passwordForm.register("email")}
          />
          {passwordForm.formState.errors.email && (
            <p className="text-[11px] text-destructive">
              {passwordForm.formState.errors.email.message}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="password" className="text-xs">
            Password
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            className="h-8 text-sm"
            {...passwordForm.register("password")}
          />
          {passwordForm.formState.errors.password && (
            <p className="text-[11px] text-destructive">
              {passwordForm.formState.errors.password.message}
            </p>
          )}
        </div>

        <label className="flex cursor-pointer items-start gap-2 pt-0.5 text-xs">
          <Checkbox
            checked={rememberComputer}
            onCheckedChange={(value) => setRememberComputer(value === true)}
            className="mt-0.5 size-3.5"
          />
          <span className="leading-snug text-muted-foreground">
            <span className="font-medium text-foreground/90">
              Remember this computer
            </span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground/80">
              Uncheck on shared or public devices.
            </span>
          </span>
        </label>

        <div className="flex flex-col gap-1.5 pt-1">
          <Button
            type="submit"
            size="sm"
            className="h-8 w-full"
            disabled={submitting || signingUp}
          >
            {submitting && <Loader2 className="size-3.5 animate-spin" />}
            Sign in
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-full text-muted-foreground"
            disabled={submitting || signingUp}
            onClick={passwordForm.handleSubmit(onSignUp)}
          >
            {signingUp && <Loader2 className="size-3.5 animate-spin" />}
            Create account
          </Button>
        </div>
      </form>
    </div>
  );
}
