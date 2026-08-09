"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function ProjectDetailWorkspace({
  messaging,
  context,
  contextTitle = "Project details",
}: {
  messaging: React.ReactNode;
  context: React.ReactNode;
  contextTitle?: string;
}) {
  const [contextOpen, setContextOpen] = React.useState(false);

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-background">
      <div className="absolute right-2 top-2 z-10 lg:hidden">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="bg-background/90 backdrop-blur-sm"
          onClick={() => setContextOpen(true)}
          aria-label="Open project details"
        >
          <Info className="size-4" />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {messaging}
        </div>
        <aside className="hidden h-full min-h-0 w-72 shrink-0 overflow-y-auto overscroll-contain border-l border-border bg-muted/15 lg:block">
          {context}
        </aside>
      </div>

      <Sheet open={contextOpen} onOpenChange={setContextOpen}>
        <SheetContent side="right" className="w-full max-w-sm overflow-y-auto p-0">
          <SheetHeader className="border-b border-border px-4 py-3">
            <SheetTitle className="text-sm">{contextTitle}</SheetTitle>
          </SheetHeader>
          <div className="p-3">{context}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
