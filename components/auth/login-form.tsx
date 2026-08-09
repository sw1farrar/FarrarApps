"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  ensureDeviceAccess,
  trustCurrentDevice,
} from "@/lib/auth/device-actions";
import { acceptStaffInvite } from "@/lib/data/staff";
import {
  acceptPortalInvite,
  preparePortalInvitePassword,
} from "@/lib/data/portal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirm_password: z.string().optional(),
  full_name: z.string().optional(),
});

const portalInviteSchema = z
  .object({
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirm_password: z.string().min(6, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type LoginValues = z.infer<typeof loginSchema>;
type PortalInviteValues = z.infer<typeof portalInviteSchema>;

export function LoginForm({
  defaultEmail = "",
  defaultFullName = "",
  inviteToken,
  invitedRole = "staff",
  portalInviteToken,
  portalInviteValid = true,
  portalCustomerName = "",
  portalSignIn = false,
  nextPath,
}: {
  defaultEmail?: string;
  defaultFullName?: string;
  inviteToken?: string;
  invitedRole?: "owner" | "staff" | "client";
  portalInviteToken?: string;
  portalInviteValid?: boolean;
  portalCustomerName?: string;
  /** Framing for client portal return visits (next=/portal) or invites. */
  portalSignIn?: boolean;
  nextPath?: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [rememberComputer, setRememberComputer] = React.useState(true);
  const [forgotMode, setForgotMode] = React.useState(false);
  const [forgotEmail, setForgotEmail] = React.useState(defaultEmail);
  const [forgotSending, setForgotSending] = React.useState(false);
  const staffInviteMode = Boolean(inviteToken);
  const portalInviteMode = Boolean(portalInviteToken);
  const inviteMode = staffInviteMode || portalInviteMode;
  const roleForInvite = portalInviteMode ? "client" : invitedRole;
  const lockedEmail = defaultEmail.trim();
  const lockedName = (portalCustomerName || defaultFullName || "").trim();
  const isPortalFraming = portalSignIn || portalInviteMode;

  const passwordForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: defaultEmail,
      password: "",
      confirm_password: "",
      full_name: defaultFullName,
    },
  });

  const portalForm = useForm<PortalInviteValues>({
    resolver: zodResolver(portalInviteSchema),
    defaultValues: {
      password: "",
      confirm_password: "",
    },
  });

  async function finishAuth(opts?: { skipDeviceChallenge?: boolean }) {
    const device = opts?.skipDeviceChallenge
      ? await trustCurrentDevice({ rememberComputer: true })
      : await ensureDeviceAccess({ rememberComputer });
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
    toast.success(inviteMode ? "Account ready" : "Signed in");
    if (
      portalInviteMode ||
      roleForInvite === "client" ||
      nextPath === "/portal"
    ) {
      router.push("/portal");
    } else if (staffInviteMode) {
      router.push("/dashboard");
    } else if (
      nextPath &&
      nextPath.startsWith("/") &&
      !nextPath.startsWith("//")
    ) {
      router.push(nextPath);
    } else {
      router.push("/dashboard");
    }
    router.refresh();
  }

  async function onPortalInviteSubmit(values: PortalInviteValues) {
    if (!portalInviteToken) return;
    setSubmitting(true);

    try {
      if (!portalInviteValid || !lockedEmail) {
        toast.error("This portal invite is invalid or has already been used.");
        return;
      }

      const prepared = await preparePortalInvitePassword(
        portalInviteToken,
        values.password
      );
      if (!prepared.ok) {
        toast.error(prepared.error);
        return;
      }

      const supabase = createClient();
      const email = prepared.email;
      const fullName = prepared.customer_name || lockedName || email;

      if (prepared.mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: values.password,
          options: {
            data: {
              full_name: fullName,
              invited_role: "client",
              portal_invite_token: portalInviteToken,
            },
          },
        });
        if (error) {
          toast.error(error.message);
          return;
        }
        if (!data.session) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password: values.password,
          });
          if (signInError) {
            toast.error(signInError.message);
            return;
          }
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: values.password,
        });
        if (signInError) {
          toast.error(
            signInError.message ||
              "Could not sign in with that password. Try again."
          );
          return;
        }
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        toast.error("Could not open your portal account");
        return;
      }

      // Trust device before accept so later server actions aren't redirected.
      const trusted = await trustCurrentDevice({ rememberComputer: true });
      if (trusted.status === "error") {
        toast.error(trusted.error);
        return;
      }

      const accepted = await acceptPortalInvite(portalInviteToken, user.id);
      if (!accepted.ok) {
        toast.error(accepted.error);
        return;
      }

      toast.success("Account ready");
      window.location.assign("/portal");
      return;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Something went wrong. Try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function onForgotPassword(event: React.FormEvent) {
    event.preventDefault();
    const email = forgotEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      toast.error("Enter a valid email address");
      return;
    }
    setForgotSending(true);
    try {
      const supabase = createClient();
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/login/reset`,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Check your email for a password reset link");
      setForgotMode(false);
    } finally {
      setForgotSending(false);
    }
  }

  async function onPasswordSubmit(values: LoginValues) {
    setSubmitting(true);
    const supabase = createClient();

    if (staffInviteMode && inviteToken) {
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            full_name: values.full_name || values.email,
            invited_role: roleForInvite,
            invite_token: inviteToken,
          },
        },
      });
      if (error) {
        setSubmitting(false);
        toast.error(error.message);
        return;
      }

      if (!data.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });
        if (signInError) {
          setSubmitting(false);
          toast.error(
            signInError.message.includes("Email not confirmed")
              ? "Check your email to confirm your account, then sign in."
              : signInError.message
          );
          return;
        }
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.id) {
        const accepted = await acceptStaffInvite(inviteToken, user.id);
        if (!accepted.ok) {
          toast.message(accepted.error);
        }
      }
      await finishAuth({ skipDeviceChallenge: true });
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (error) {
      setSubmitting(false);
      toast.error(error.message);
      return;
    }

    await finishAuth();
    setSubmitting(false);
  }

  if (portalInviteMode && !portalInviteValid) {
    return (
      <div className="w-full space-y-3">
        <div className="px-0 pt-0 pb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/farrar_apps_logo.png?v=3"
            alt="Farrar Apps — Applications for Business"
            className="block h-auto w-full bg-transparent object-contain object-center"
          />
        </div>
        <div className="rounded-lg border border-border bg-background/30 px-3 py-3 text-sm text-muted-foreground">
          This portal invite is invalid, expired, or already used. Ask Farrar
          Apps to send a new invite.
        </div>
      </div>
    );
  }

  if (portalInviteMode) {
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

        <form
          className="space-y-2.5 px-0 pb-0 pt-0 max-sm:space-y-3.5"
          onSubmit={portalForm.handleSubmit(onPortalInviteSubmit)}
        >
          <div className="rounded-lg border border-border bg-background/30 px-2.5 py-2 text-xs text-muted-foreground">
            Create a password to open your client portal. Your account details
            were set by Farrar Apps.
          </div>

          <div className="space-y-1 rounded-lg border border-border/70 bg-background/20 px-2.5 py-2 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-muted-foreground">Name</span>
              <span className="truncate font-medium text-foreground">
                {lockedName || "Client"}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-muted-foreground">Email</span>
              <span className="truncate font-medium text-foreground">
                {lockedEmail}
              </span>
            </div>
          </div>

          <div className="space-y-1 max-sm:space-y-1.5">
            <Label htmlFor="password" className="text-xs">
              Create password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              enterKeyHint="next"
              className="h-8 text-sm max-sm:h-11 max-sm:text-base"
              {...portalForm.register("password")}
            />
            {portalForm.formState.errors.password && (
              <p className="text-[11px] text-destructive">
                {portalForm.formState.errors.password.message}
              </p>
            )}
          </div>

          <div className="space-y-1 max-sm:space-y-1.5">
            <Label htmlFor="confirm_password" className="text-xs">
              Re-enter password
            </Label>
            <Input
              id="confirm_password"
              type="password"
              autoComplete="new-password"
              enterKeyHint="go"
              className="h-8 text-sm max-sm:h-11 max-sm:text-base"
              {...portalForm.register("confirm_password")}
            />
            {portalForm.formState.errors.confirm_password && (
              <p className="text-[11px] text-destructive">
                {portalForm.formState.errors.confirm_password.message}
              </p>
            )}
          </div>

          <div className="pt-1 max-sm:pt-2">
            <Button
              type="submit"
              size="sm"
              className="h-8 w-full max-sm:h-11 max-sm:text-sm"
              disabled={submitting}
            >
              {submitting && <Loader2 className="size-3.5 animate-spin" />}
              Create password & open portal
            </Button>
          </div>
        </form>
      </div>
    );
  }

  if (forgotMode && !inviteMode) {
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
        <form
          className="space-y-2.5 px-0 pb-0 pt-0 max-sm:space-y-3.5"
          onSubmit={onForgotPassword}
        >
          <div className="rounded-lg border border-border bg-background/30 px-2.5 py-2 text-xs text-muted-foreground">
            Enter your email and we&apos;ll send a link to reset your password.
          </div>
          <div className="space-y-1 max-sm:space-y-1.5">
            <Label htmlFor="forgot_email" className="text-xs">
              Email
            </Label>
            <Input
              id="forgot_email"
              type="email"
              autoComplete="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              className="h-8 text-sm max-sm:h-11 max-sm:text-base"
            />
          </div>
          <div className="flex flex-col gap-2 pt-1 max-sm:pt-2">
            <Button
              type="submit"
              size="sm"
              className="h-8 w-full max-sm:h-11 max-sm:text-sm"
              disabled={forgotSending}
            >
              {forgotSending && <Loader2 className="size-3.5 animate-spin" />}
              Send reset link
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 w-full max-sm:h-11 max-sm:text-sm"
              onClick={() => setForgotMode(false)}
            >
              Back to sign in
            </Button>
          </div>
        </form>
      </div>
    );
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

      <form
        className="space-y-2.5 px-0 pb-0 pt-0 max-sm:space-y-3.5"
        onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
      >
        {staffInviteMode ? (
          <div className="rounded-lg border border-border bg-background/30 px-2.5 py-2 text-xs text-muted-foreground">
            Create your account as{" "}
            <span className="capitalize">{roleForInvite}</span> to accept this
            invite.
          </div>
        ) : isPortalFraming ? (
          <div className="rounded-lg border border-border bg-background/30 px-2.5 py-2 text-xs text-muted-foreground">
            Sign in to your client portal to view invoices, projects, and
            billing.
          </div>
        ) : null}
        {inviteMode ? (
          <div className="space-y-1 max-sm:space-y-1.5">
            <Label htmlFor="full_name" className="text-xs">
              Name
            </Label>
            <Input
              id="full_name"
              autoComplete="name"
              className="h-8 text-sm max-sm:h-11 max-sm:text-base"
              {...passwordForm.register("full_name")}
            />
          </div>
        ) : null}
        <div className="space-y-1 max-sm:space-y-1.5">
          <Label htmlFor="email" className="text-xs">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            enterKeyHint="next"
            readOnly={staffInviteMode && Boolean(defaultEmail)}
            className="h-8 text-sm max-sm:h-11 max-sm:text-base"
            {...passwordForm.register("email")}
          />
          {passwordForm.formState.errors.email && (
            <p className="text-[11px] text-destructive">
              {passwordForm.formState.errors.email.message}
            </p>
          )}
        </div>
        <div className="space-y-1 max-sm:space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="password" className="text-xs">
              {staffInviteMode ? "Create password" : "Password"}
            </Label>
            {!inviteMode ? (
              <button
                type="button"
                className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                onClick={() => {
                  setForgotEmail(passwordForm.getValues("email") || defaultEmail);
                  setForgotMode(true);
                }}
              >
                Forgot password?
              </button>
            ) : null}
          </div>
          <Input
            id="password"
            type="password"
            autoComplete={staffInviteMode ? "new-password" : "current-password"}
            enterKeyHint="go"
            className="h-8 text-sm max-sm:h-11 max-sm:text-base"
            {...passwordForm.register("password")}
          />
          {passwordForm.formState.errors.password && (
            <p className="text-[11px] text-destructive">
              {passwordForm.formState.errors.password.message}
            </p>
          )}
        </div>

        <label className="flex cursor-pointer items-center gap-2 pt-0.5 text-xs max-sm:min-h-11 max-sm:gap-2.5 max-sm:py-1">
          <Checkbox
            checked={rememberComputer}
            onCheckedChange={(value) => setRememberComputer(value === true)}
            className="size-3.5 max-sm:size-4"
          />
          <span className="font-medium leading-none text-foreground/90">
            <span className="max-sm:hidden">Remember this computer</span>
            <span className="hidden max-sm:inline">Remember this device</span>
          </span>
        </label>

        <div className="pt-1 max-sm:pt-2">
          <Button
            type="submit"
            size="sm"
            className="h-8 w-full max-sm:h-11 max-sm:text-sm"
            disabled={submitting}
          >
            {submitting && <Loader2 className="size-3.5 animate-spin" />}
            {staffInviteMode
              ? "Create account"
              : isPortalFraming
                ? "Sign in to portal"
                : "Sign in"}
          </Button>
        </div>
      </form>
    </div>
  );
}
