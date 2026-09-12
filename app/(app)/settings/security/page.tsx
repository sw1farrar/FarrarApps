import { listTrustedDevices } from "@/lib/auth/device-actions";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getMcpBotUrl } from "@/lib/mcp/config";
import type { TrustedDevice } from "@/lib/types/database";
import { McpAccessTokensPanel } from "@/components/settings/mcp-access-tokens-panel";
import { TrustedDevicesPanel } from "@/components/settings/trusted-devices-panel";

export default async function SettingsSecurityPage() {
  const [devices, profile] = await Promise.all([
    listTrustedDevices(),
    getCurrentProfile(),
  ]);

  return (
    <div className="space-y-3">
      <McpAccessTokensPanel
        canManage={profile?.role === "owner"}
        thisEnvironmentBotUrl={getMcpBotUrl()}
      />
      <TrustedDevicesPanel devices={devices as TrustedDevice[]} />
    </div>
  );
}
