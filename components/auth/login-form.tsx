"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
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

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const magicSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

type LoginValues = z.infer<typeof loginSchema>;
type MagicValues = z.infer<typeof magicSchema>;

export function LoginForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const router = useRouter();
  const [mode, setMode] = React.useState<"password" | "magic">("password");
  const [submitting, setSubmitting] = React.useState(false);
  const [signingUp, setSigningUp] = React.useState(false);

  const passwordForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: defaultEmail, password: "" },
  });

  const magicForm = useForm<MagicValues>({
    resolver: zodResolver(magicSchema),
    defaultValues: { email: defaultEmail },
  });

  async function onPasswordSubmit(values: LoginValues) {
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword(values);
    setSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Signed in");
    router.refresh();
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
    setSigningUp(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Account created — you can sign in now");
    router.refresh();
  }

  async function onMagicSubmit(values: MagicValues) {
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: values.email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Magic link sent — check your email");
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
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
          <Button
            type="button"
            variant={mode === "password" ? "default" : "ghost"}
            size="sm"
            onClick={() => setMode("password")}
          >
            Email & password
          </Button>
          <Button
            type="button"
            variant={mode === "magic" ? "default" : "ghost"}
            size="sm"
            onClick={() => setMode("magic")}
          >
            Magic link
          </Button>
        </div>

        {mode === "password" ? (
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
        ) : (
          <form
            className="space-y-3"
            onSubmit={magicForm.handleSubmit(onMagicSubmit)}
          >
            <div className="space-y-1.5">
              <Label htmlFor="magic-email">Email</Label>
              <Input
                id="magic-email"
                type="email"
                autoComplete="email"
                {...magicForm.register("email")}
              />
              {magicForm.formState.errors.email && (
                <p className="text-xs text-destructive">
                  {magicForm.formState.errors.email.message}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Mail className="size-4" />
              )}
              Send magic link
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
