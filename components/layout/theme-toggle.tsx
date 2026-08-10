"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import type { ThemePreference } from "@/lib/types/database";

export function ThemeToggle({ userId }: { userId?: string }) {
  const { setTheme } = useTheme();
  // next-themes + Base UI menu IDs must not SSR: theme class and useId both
  // disagree with the client on first paint otherwise.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  async function persistTheme(preference: ThemePreference) {
    setTheme(preference);
    if (!userId) return;

    const supabase = createClient();
    await supabase
      .from("profiles")
      .update({ theme_preference: preference })
      .eq("id", userId);
  }

  if (!mounted) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label="Toggle theme"
        disabled
      >
        <Sun className="size-4" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="size-8" />
        }
      >
        <Sun className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
        <Moon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
        <span className="sr-only">Toggle theme</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => persistTheme("light")}>
          <Sun className="size-4" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => persistTheme("dark")}>
          <Moon className="size-4" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => persistTheme("system")}>
          <Monitor className="size-4" />
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
