"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";
import {
  dismissAllNotifications,
  dismissNotification,
  getNotifications,
  syncOverdueNotifications,
} from "@/lib/data/notifications";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/format";

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

export function NotificationsBell() {
  const router = useRouter();
  const [items, setItems] = React.useState<NotificationRow[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const count = items.length;

  async function refresh(opts?: { sync?: boolean }) {
    if (opts?.sync) await syncOverdueNotifications();
    const data = (await getNotifications()) as NotificationRow[];
    setItems(data);
    setLoaded(true);
  }

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh({ sync: false });
    }, 800);
    return () => window.clearTimeout(timer);
  }, []);

  async function onOpenChange(open: boolean) {
    if (open) await refresh({ sync: true });
  }

  async function onSelect(item: NotificationRow) {
    await dismissNotification(item.id);
    setItems((prev) => prev.filter((row) => row.id !== item.id));
    if (item.href) router.push(item.href);
  }

  async function onDismiss(
    event: React.MouseEvent,
    id: string
  ) {
    event.preventDefault();
    event.stopPropagation();
    await dismissNotification(id);
    setItems((prev) => prev.filter((row) => row.id !== id));
  }

  async function onClearAll(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    await dismissAllNotifications();
    setItems([]);
  }

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="relative size-8" />
        }
      >
        <Bell className="size-4" />
        {loaded && count > 0 ? (
          <span className="absolute top-1 right-1 size-1.5 rounded-full bg-destructive" />
        ) : null}
        <span className="sr-only">Notifications</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-1.5 py-1 text-xs font-medium text-muted-foreground">
          <span>Notifications{count > 0 ? ` (${count})` : ""}</span>
          {count > 0 ? (
            <button
              type="button"
              className="text-xs font-normal text-muted-foreground hover:text-foreground"
              onClick={(e) => void onClearAll(e)}
            >
              Clear all
            </button>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        {count === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
            You&apos;re all caught up
          </div>
        ) : (
          items.map((item) => (
            <DropdownMenuItem
              key={item.id}
              className="group relative flex flex-col items-start gap-0.5 py-2 pr-9"
              onClick={() => void onSelect(item)}
            >
              <span className="font-medium pr-1">{item.title}</span>
              <span className="text-xs text-muted-foreground">
                {[item.body, formatDate(item.created_at)]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <button
                type="button"
                className="absolute top-1.5 right-1.5 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Clear ${item.title}`}
                onClick={(e) => void onDismiss(e, item.id)}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <X className="size-3.5" />
              </button>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
