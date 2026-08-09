import { DataExportCard } from "@/components/settings/data-export-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SettingsWorkspacePage() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <DataExportCard />
      <Card className="shadow-none">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm">Email (Brevo)</CardTitle>
          <CardDescription className="text-xs">
            Transactional email for invoices, invites, and device verification.
            Sender: FarrarApps &lt;noreply@farrarapps.com&gt;.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 pt-0 text-sm text-muted-foreground">
          Status:{" "}
          {process.env.BREVO_API_KEY ? "configured" : "missing BREVO_API_KEY"}
        </CardContent>
      </Card>
      <Card className="shadow-none lg:col-span-2">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm">Keyboard shortcuts</CardTitle>
          <CardDescription className="text-xs">
            ⌘K search · g then d/p/c/f to jump · n then c/p/i/t to create
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
