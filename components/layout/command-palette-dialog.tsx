"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Wallet,
  Settings,
  Plus,
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
import { createClient } from "@/lib/supabase/client";

type SearchHit = {
  id: string;
  label: string;
  href: string;
  group: string;
};

type CustomerSearchRow = {
  id: string;
  name: string;
  company: string | null;
};

type ProjectSearchRow = {
  id: string;
  name: string;
};

type InvoiceSearchRow = {
  id: string;
  invoice_number: string;
};

export function CommandPaletteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [searching, setSearching] = React.useState(false);

  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
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
        ...((customers.data ?? []) as CustomerSearchRow[]).map((row) => ({
          id: `customer-${row.id}`,
          label: row.company ? `${row.name} · ${row.company}` : row.name,
          href: `/customers/${row.id}`,
          group: "Customers",
        })),
        ...((projects.data ?? []) as ProjectSearchRow[]).map((row) => ({
          id: `project-${row.id}`,
          label: row.name,
          href: `/projects/${row.id}`,
          group: "Projects",
        })),
        ...((invoices.data ?? []) as InvoiceSearchRow[]).map((row) => ({
          id: `invoice-${row.id}`,
          label: row.invoice_number,
          href: `/finance/invoices/${row.id}`,
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
  }, [query, supabase]);

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  const groupedHits = hits.reduce<Record<string, SearchHit[]>>((acc, hit) => {
    acc[hit.group] = acc[hit.group] ? [...acc[hit.group], hit] : [hit];
    return acc;
  }, {});

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
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
          <CommandItem onSelect={() => go("/finance/invoices/new")}>
            <Plus className="size-4" />
            New invoice
          </CommandItem>
          <CommandItem onSelect={() => go("/finance/transactions")}>
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
          <CommandItem onSelect={() => go("/projects")}>
            <FolderKanban className="size-4" />
            Projects
          </CommandItem>
          <CommandItem onSelect={() => go("/customers")}>
            <Users className="size-4" />
            Customers
          </CommandItem>
          <CommandItem onSelect={() => go("/finance")}>
            <Wallet className="size-4" />
            Finance
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
  );
}
