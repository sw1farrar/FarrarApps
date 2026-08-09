"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  revokeOtherTrustedDevices,
  revokeTrustedDevice,
} from "@/lib/auth/device-actions";
import type { TrustedDevice } from "@/lib/types/database";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function TrustedDevicesPanel({
  devices,
}: {
  devices: TrustedDevice[];
}) {
  const router = useRouter();

  async function revoke(id: string) {
    const result = await revokeTrustedDevice(id);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Device revoked");
      router.refresh();
    }
  }

  async function revokeOthers() {
    const result = await revokeOtherTrustedDevices();
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Other devices revoked");
      router.refresh();
    }
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="p-3 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm">Trusted devices</CardTitle>
            <CardDescription className="text-xs">
              Computers that can skip email device verification.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={revokeOthers}>
            Revoke others
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-1 p-3 pt-0">
        {devices.length ? (
          devices.map((device) => (
            <div
              key={device.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {device.user_agent || "Unknown browser"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Last used {formatDate(device.last_used_at)}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => revoke(device.id)}>
                Revoke
              </Button>
            </div>
          ))
        ) : (
          <p className="rounded-md border border-dashed border-border px-2 py-3 text-xs text-muted-foreground">
            No trusted devices saved.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
