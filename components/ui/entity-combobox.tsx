"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type ComboboxOption = {
  id: string;
  label: string;
  keywords?: string;
};

export function EntityCombobox({
  name,
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyLabel = "No results",
  allowNone = false,
  noneLabel = "None",
  required = false,
  disabled = false,
  className,
  onCreate,
  createLabel = "Add new",
}: {
  name?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  allowNone?: boolean;
  noneLabel?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  /** Shown when search has no matches (and optionally always at bottom). Receives current search query. */
  onCreate?: (query: string) => void;
  createLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const selected = options.find((option) => option.id === value);
  const normalized = query.trim().toLowerCase();
  const filtered = options.filter((option) => {
    if (!normalized) return true;
    const haystack = `${option.label} ${option.keywords ?? ""}`.toLowerCase();
    return haystack.includes(normalized);
  });
  const showCreate =
    Boolean(onCreate) &&
    (filtered.length === 0 ||
      (normalized.length > 0 &&
        !filtered.some((option) => option.label.toLowerCase() === normalized)));

  return (
    <div className={cn("w-full", className)}>
      {name ? (
        <input type="hidden" name={name} value={value} required={required} />
      ) : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              className="h-8 w-full justify-between bg-background px-2.5 font-normal text-foreground dark:bg-input/30"
              aria-expanded={open}
            >
              <span className="truncate">
                {selected?.label ||
                  (allowNone && value === "" ? noneLabel : null) ||
                  placeholder}
              </span>
              <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
            </Button>
          }
        />
        <PopoverContent
          align="start"
          sideOffset={4}
          className="min-w-[16rem] border border-border bg-popover p-0 text-popover-foreground shadow-md"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={searchPlaceholder}
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {filtered.length === 0 && !showCreate ? (
                <CommandEmpty>{emptyLabel}</CommandEmpty>
              ) : null}
              <CommandGroup>
                {allowNone ? (
                  <CommandItem
                    value="__none__"
                    data-checked={value === "" || undefined}
                    onSelect={() => {
                      onValueChange("");
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <Check
                      className={cn(
                        "size-4",
                        value === "" ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {noneLabel}
                  </CommandItem>
                ) : null}
                {filtered.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={option.id}
                    data-checked={value === option.id || undefined}
                    onSelect={() => {
                      onValueChange(option.id);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <Check
                      className={cn(
                        "size-4",
                        value === option.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{option.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              {showCreate && onCreate ? (
                <CommandGroup>
                  <CommandItem
                    value="__create__"
                    onSelect={() => {
                      setOpen(false);
                      onCreate(query.trim());
                      setQuery("");
                    }}
                  >
                    <Plus className="size-4" />
                    {query.trim()
                      ? `${createLabel} “${query.trim()}”`
                      : createLabel}
                  </CommandItem>
                </CommandGroup>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
