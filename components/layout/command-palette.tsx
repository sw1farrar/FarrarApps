"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

const CommandPaletteDialog = dynamic(
  () =>
    import("@/components/layout/command-palette-dialog").then(
      (mod) => mod.CommandPaletteDialog
    ),
  { ssr: false }
);

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="hidden h-8 gap-2 text-muted-foreground sm:inline-flex"
        onClick={() => setOpen(true)}
      >
        <Search className="size-3.5" />
        Search
        <kbd className="rounded border border-border bg-muted px-1.5 text-[10px]">
          ⌘K
        </kbd>
      </Button>

      {open && <CommandPaletteDialog open={open} onOpenChange={setOpen} />}
    </>
  );
}
