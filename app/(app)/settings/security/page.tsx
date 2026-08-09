import { listTrustedDevices } from "@/lib/auth/device-actions";
import type { TrustedDevice } from "@/lib/types/database";
import { TrustedDevicesPanel } from "@/components/settings/trusted-devices-panel";

export default async function SettingsSecurityPage() {
  const devices = await listTrustedDevices();

  return <TrustedDevicesPanel devices={devices as TrustedDevice[]} />;
}
