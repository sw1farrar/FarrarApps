"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type FormSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

/**
 * Themed select that keeps closed trigger + open menu on the same
 * popover/foreground tokens (native <select> option menus ignore CSS themes).
 */
export function FormSelect({
  name,
  value,
  defaultValue,
  onValueChange,
  options,
  placeholder = "Select…",
  required = false,
  disabled = false,
  className,
  triggerClassName,
  size = "default",
  id,
  "aria-label": ariaLabel,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: FormSelectOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  size?: "sm" | "default";
  id?: string;
  "aria-label"?: string;
}) {
  const [uncontrolled, setUncontrolled] = React.useState(
    defaultValue ?? ""
  );
  const isControlled = value !== undefined;
  const current = isControlled ? value : uncontrolled;
  const selectedLabel =
    options.find((option) => option.value === current)?.label ?? "";

  // Base UI uses this map so the closed trigger shows labels, not raw values.
  const items = React.useMemo(
    () =>
      Object.fromEntries(options.map((option) => [option.value, option.label])),
    [options]
  );

  function handleChange(next: string | null) {
    const resolved = next ?? "";
    if (!isControlled) setUncontrolled(resolved);
    onValueChange?.(resolved);
  }

  return (
    <div className={cn("w-full", className)}>
      {name ? (
        <input
          type="hidden"
          name={name}
          value={current}
          required={required && !current}
        />
      ) : null}
      <Select
        value={current || null}
        onValueChange={handleChange}
        disabled={disabled}
        items={items}
      >
        <SelectTrigger
          id={id}
          size={size}
          aria-label={ariaLabel}
          className={cn(
            "w-full bg-background text-foreground dark:bg-input/30",
            triggerClassName
          )}
        >
          <SelectValue placeholder={placeholder}>
            {selectedLabel || undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-popover text-popover-foreground">
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
