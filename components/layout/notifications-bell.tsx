"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  syncOverdueNotifications,
} from "@/lib/data/notifications";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
  const unread = items.filter((item) => !item.read_at).length;

  async function refresh() {
    await syncOverdueNotifications();
    const data = (await getNotifications()) as NotificationRow[];
    setItems(data);
  }

  React.useEffect(() => {
    void refresh();
  }, []);

  async function onOpenChange(open: boolean) {
    if (open) await refresh();
  }

  async function onSelect(item: NotificationRow) {
    await markNotificationRead(item.id);
    if (item.href) router.push(item.href);
    await refresh();
  }

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="relative size-8" />
        }
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 size-1.5 rounded-full bg-destructive" />
        )}
        <span className="sr-only">Notifications</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unread > 0 && (
            <button
              type="button"
              className="text-xs font-normal text-muted-foreground hover:text-foreground"
              onClick={() => markAllNotificationsRead().then(refresh)}
            >
              Mark all read
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
            You&apos;re all caught up
          </div>
        ) : (
          items.map((item) => (
            <DropdownMenuItem
              key={item.id}
              className="flex flex-col items-start gap-0.5 py-2"
              onClick={() => onSelect(item)}
            >
              <span className={item.read_at ? "font-normal" : "font-medium"}>
                {item.title}
              </span>
              <span className="text-xs text-muted-foreground">
                {[item.body, formatDate(item.created_at)]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
