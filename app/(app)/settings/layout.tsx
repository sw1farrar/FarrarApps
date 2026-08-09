import { SettingsNav } from "@/components/layout/settings-nav";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <SettingsNav />
      <div className="mx-auto w-full max-w-3xl">{children}</div>
    </div>
  );
}
