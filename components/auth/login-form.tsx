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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
          Sign in
        </CardTitle>
        <CardDescription className="text-center">
          Manage customers, projects, invoices, and more.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              {...passwordForm.register("email")}
            />
            {passwordForm.formState.errors.email && (
              <p className="text-xs text-destructive">
                {passwordForm.formState.errors.email.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...passwordForm.register("password")}
            />
            {passwordForm.formState.errors.password && (
              <p className="text-xs text-destructive">
                {passwordForm.formState.errors.password.message}
              </p>
            )}
          </div>
          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border/70 bg-muted/30 px-3 py-2.5 text-sm">
            <Checkbox
              checked={rememberComputer}
              onCheckedChange={(value) => setRememberComputer(value === true)}
              className="mt-0.5"
            />
            <span className="leading-snug text-muted-foreground">
              <span className="font-medium text-foreground">
                Remember this computer
              </span>
              <span className="mt-0.5 block text-xs">
                Skip email confirmation next time on this device. Leave unchecked
                on shared or public computers.
              </span>
            </span>
          </label>
          <div className="flex flex-col gap-2 pt-1">
            <Button type="submit" disabled={submitting || signingUp}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Sign in
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={submitting || signingUp}
              onClick={passwordForm.handleSubmit(onSignUp)}
            >
              {signingUp && <Loader2 className="size-4 animate-spin" />}
              Create account
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
