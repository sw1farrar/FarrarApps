"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type StatusOption = {
  value: string;
  label: string;
};

const ALL = "__all__";

export function ListFilters({
  placeholder = "Search",
  statusOptions = [],
}: {
  placeholder?: string;
  statusOptions?: StatusOption[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "";
  const [statusValue, setStatusValue] = React.useState(status || ALL);

  React.useEffect(() => {
    setStatusValue(status || ALL);
  }, [status]);

  return (
    <form
      action={pathname}
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const nextQ = String(formData.get("q") || "").trim();
        const params = new URLSearchParams();
        if (nextQ) params.set("q", nextQ);
        if (statusValue && statusValue !== ALL) {
          params.set("status", statusValue);
        }
        const query = params.toString();
        router.push(query ? `${pathname}?${query}` : pathname);
      }}
    >
      <Input
        name="q"
        defaultValue={q}
        placeholder={placeholder}
        className="h-7 w-52 bg-background text-foreground"
      />
      {statusOptions.length ? (
        <FormSelect
          name="status"
          size="sm"
          value={statusValue}
          onValueChange={setStatusValue}
          className="w-44"
          options={[
            { value: ALL, label: "All statuses" },
            ...statusOptions,
          ]}
          placeholder="All statuses"
        />
      ) : null}
      <Button type="submit" size="sm" variant="outline">
        Filter
      </Button>
      {(q || status) && (
        <Link
          href={pathname}
          className={cn(buttonVariants({ size: "sm", variant: "ghost" }))}
        >
          Clear
        </Link>
      )}
    </form>
  );
}
