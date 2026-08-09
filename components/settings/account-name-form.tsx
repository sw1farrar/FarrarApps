"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { updateAccountName } from "@/lib/data/account-profile";
import { setCachedProfile } from "@/lib/auth/profile-cache";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Profile } from "@/lib/types/database";

export function AccountNameForm({
  fullName,
  profile,
}: {
  fullName: string;
  /** When provided, updates the client sidebar cache after save. */
  profile?: Profile | null;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [value, setValue] = React.useState(fullName);

  React.useEffect(() => {
    setValue(fullName);
  }, [fullName]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);
    const result = await updateAccountName(formData);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const nextName = String(formData.get("full_name") || "").trim();
    if (profile) {
      setCachedProfile({ ...profile, full_name: nextName });
    }
    toast.success(fullName ? "Name updated" : "Name saved");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="full_name">Full name</Label>
        <Input
          id="full_name"
          name="full_name"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Your name"
          autoComplete="name"
          required
        />
        <p className="text-[11px] text-muted-foreground">
          Shown in the sidebar and activity. You can add a name if it is blank.
        </p>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Save name
      </Button>
    </form>
  );
}
