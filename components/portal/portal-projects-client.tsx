"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PortalProjectsClient({
  defaultOpen,
  children,
}: {
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(Boolean(defaultOpen));
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (defaultOpen) {
      setOpen(true);
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [defaultOpen]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (!next) {
      router.replace("/portal/projects", { scroll: false });
    }
  }

  return (
    <div ref={panelRef} className="space-y-2">
      <Button
        type="button"
        variant={open ? "secondary" : "outline"}
        size="sm"
        onClick={toggle}
        className="gap-2"
      >
        <FilePlus2 className="size-4" />
        {open ? "Hide brief form" : "Submit a project brief"}
        <ChevronDown
          className={cn(
            "size-4 transition-transform",
            open && "rotate-180"
          )}
        />
      </Button>
      {open ? children : null}
    </div>
  );
}
