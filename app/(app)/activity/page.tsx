import { listActivity } from "@/lib/data/activity";
import { formatDate, titleCase } from "@/lib/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function metaLabel(meta: Record<string, unknown>, entityId: string | null) {
  if (typeof meta.name === "string") return meta.name;
  if (typeof meta.invoice_number === "string") return meta.invoice_number;
  if (typeof meta.email === "string") return meta.email;
  return entityId?.slice(0, 8) || "No linked record";
}

export default async function ActivityPage() {
  const activity = await listActivity({ limit: 50 });

  return (
    <div className="space-y-4">
      <Card className="shadow-none">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm">History</CardTitle>
          <CardDescription className="text-xs">
            Latest 50 recorded events.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 p-3 pt-0">
          {activity.length ? (
            activity.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-md border border-border px-2 py-1.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {titleCase(item.action)} {item.entity_type}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {metaLabel(item.meta, item.entity_id)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.profiles?.full_name ||
                      item.profiles?.email ||
                      "System"}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(item.created_at)}
                </span>
              </div>
            ))
          ) : (
            <p className="rounded-md border border-dashed border-border px-2 py-8 text-center text-sm text-muted-foreground">
              No activity yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
