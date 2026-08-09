"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  createSavedView,
  deleteSavedView,
} from "@/lib/data/saved-views";
import type { SavedView } from "@/lib/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SavedViewsBar({
  entity,
  views,
}: {
  entity: string;
  views: SavedView[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [name, setName] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function saveView(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const filters = Object.fromEntries(searchParams.entries());
    const result = await createSavedView(entity, name, filters);
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("Saved view");
    setName("");
    router.refresh();
  }

  async function removeView(id: string) {
    const result = await deleteSavedView(id, entity);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Saved view deleted");
      router.refresh();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2 text-sm">
      <span className="text-xs font-medium text-muted-foreground">Views</span>
      {views.length ? (
        views.map((view) => {
          const href = `${pathname}?${new URLSearchParams(view.filters).toString()}`;
          return (
            <span key={view.id} className="inline-flex items-center gap-1">
              <Link
                href={href}
                className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted/40"
              >
                {view.name}
              </Link>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => removeView(view.id)}
              >
                Delete
              </Button>
            </span>
          );
        })
      ) : (
        <span className="text-xs text-muted-foreground">No saved views</span>
      )}
      <form onSubmit={saveView} className="ml-auto flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="View name"
          className="h-7 w-36"
        />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          Save current
        </Button>
      </form>
    </div>
  );
}
