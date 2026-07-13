"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  FileText,
  ArrowLeftRight,
  BarChart3,
  Settings,
  Plus,
  Search,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type SearchHit = {
  id: string;
  label: string;
  href: string;
  group: string;
};

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [searching, setSearching] = React.useState(false);

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

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setHits([]);
    }
  }, [open]);

  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      const supabase = createClient();
      const pattern = `%${q.replace(/[%_,]/g, "")}%`;
      const [customers, projects, invoices] = await Promise.all([
        supabase
          .from("customers")
          .select("id, name, company")
          .or(
            `name.ilike.${pattern},company.ilike.${pattern},email.ilike.${pattern}`
          )
          .limit(5),
        supabase
          .from("projects")
          .select("id, name")
          .ilike("name", pattern)
          .limit(5),
        supabase
          .from("invoices")
          .select("id, invoice_number")
          .ilike("invoice_number", pattern)
          .limit(5),
      ]);

      if (cancelled) return;

      const next: SearchHit[] = [
        ...(customers.data ?? []).map((row) => ({
          id: `customer-${row.id}`,
          label: row.company ? `${row.name} · ${row.company}` : row.name,
          href: `/customers/${row.id}`,
          group: "Customers",
        })),
        ...(projects.data ?? []).map((row) => ({
          id: `project-${row.id}`,
          label: row.name,
          href: `/projects/${row.id}`,
          group: "Projects",
        })),
        ...(invoices.data ?? []).map((row) => ({
          id: `invoice-${row.id}`,
          label: row.invoice_number,
          href: `/invoices/${row.id}`,
          group: "Invoices",
        })),
      ];
      setHits(next);
      setSearching(false);
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  const groupedHits = hits.reduce<Record<string, SearchHit[]>>((acc, hit) => {
    acc[hit.group] = acc[hit.group] ? [...acc[hit.group], hit] : [hit];
    return acc;
  }, {});

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

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search or jump to…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {searching ? "Searching…" : "No results found."}
          </CommandEmpty>

          <CommandGroup heading="Create">
            <CommandItem onSelect={() => go("/customers")}>
              <Plus className="size-4" />
              New customer
            </CommandItem>
            <CommandItem onSelect={() => go("/projects/new")}>
              <Plus className="size-4" />
              New project
            </CommandItem>
            <CommandItem onSelect={() => go("/invoices/new")}>
              <Plus className="size-4" />
              New invoice
            </CommandItem>
            <CommandItem onSelect={() => go("/transactions")}>
              <Plus className="size-4" />
              New transaction
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Navigate">
            <CommandItem onSelect={() => go("/dashboard")}>
              <LayoutDashboard className="size-4" />
              Dashboard
            </CommandItem>
            <CommandItem onSelect={() => go("/customers")}>
              <Users className="size-4" />
              Customers
            </CommandItem>
            <CommandItem onSelect={() => go("/projects")}>
              <FolderKanban className="size-4" />
              Projects
            </CommandItem>
            <CommandItem onSelect={() => go("/invoices")}>
              <FileText className="size-4" />
              Invoices
            </CommandItem>
            <CommandItem onSelect={() => go("/transactions")}>
              <ArrowLeftRight className="size-4" />
              Transactions
            </CommandItem>
            <CommandItem onSelect={() => go("/reports")}>
              <BarChart3 className="size-4" />
              Reports
            </CommandItem>
            <CommandItem onSelect={() => go("/settings")}>
              <Settings className="size-4" />
              Settings
            </CommandItem>
          </CommandGroup>

          {Object.entries(groupedHits).map(([group, items]) => (
            <React.Fragment key={group}>
              <CommandSeparator />
              <CommandGroup heading={group}>
                {items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${group} ${item.label}`}
                    onSelect={() => go(item.href)}
                  >
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </React.Fragment>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
