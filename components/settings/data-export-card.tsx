"use client";

import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { toCalendarDateString } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function DataExportCard() {
  async function exportBackup() {
    const supabase = createClient();
    const tables = [
      "customers",
      "projects",
      "project_files",
      "project_milestones",
      "accounts",
      "categories",
      "invoices",
      "invoice_line_items",
      "transactions",
      "company_settings",
      "activity_logs",
      "notifications",
      "saved_views",
      "staff_invites",
      "portal_invites",
      "trusted_devices",
    ] as const;

    const payload: Record<string, unknown> = {
      exported_at: new Date().toISOString(),
      tables: {},
    };

    for (const table of tables) {
      const { data, error } = await supabase.from(table).select("*");
      if (error) {
        toast.error(`Failed exporting ${table}: ${error.message}`);
        return;
      }
      (payload.tables as Record<string, unknown>)[table] = data ?? [];
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `farrar-apps-backup-${toCalendarDateString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup downloaded");
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-sm">Data export</CardTitle>
        <CardDescription className="text-xs">
          Download a JSON backup of core business tables.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <Button size="sm" variant="outline" onClick={exportBackup}>
          Download full backup
        </Button>
      </CardContent>
    </Card>
  );
}
