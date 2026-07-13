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

  return (
    <div className="w-full overflow-hidden bg-transparent shadow-none">
      <div className="px-0 pt-0 pb-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/farrar_apps_logo.png?v=3"
          alt="Farrar Apps — Applications for Business"
          className="block h-auto w-full bg-transparent object-contain object-center"
        />
      </div>

      <form
        className="space-y-2.5 px-0 pb-0 pt-0"
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

        <label className="flex cursor-pointer items-center gap-2 pt-0.5 text-xs">
          <Checkbox
            checked={rememberComputer}
            onCheckedChange={(value) => setRememberComputer(value === true)}
            className="size-3.5"
          />
          <span className="font-medium leading-none text-foreground/90">
            Remember this computer
          </span>
        </label>

        <div className="pt-1">
          <Button
            type="submit"
            size="sm"
            className="h-8 w-full"
            disabled={submitting}
          >
            {submitting && <Loader2 className="size-3.5 animate-spin" />}
            Sign in
          </Button>
        </div>
      </form>
    </div>
  );
}
