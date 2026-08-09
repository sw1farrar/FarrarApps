"use client";

import * as React from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function GuestPayButton({
  token,
  disabled,
  label = "Pay with card",
}: {
  token: string;
  disabled?: boolean;
  label?: string;
}) {
  const [pending, setPending] = React.useState(false);

  async function onPay() {
    setPending(true);
    try {
      const res = await fetch("/api/stripe/checkout-public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        toast.error(data.error || "Could not start checkout");
        return;
      }
      window.location.assign(data.url);
    } catch {
      toast.error("Could not start checkout");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      size="lg"
      className="w-full gap-2 sm:w-auto"
      disabled={disabled || pending}
      onClick={() => void onPay()}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <CreditCard className="size-4" />
      )}
      {label}
    </Button>
  );
}
