"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Customer, Project } from "@/lib/types/database";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function InvoiceFormDialog({
  trigger,
  defaultCustomerId,
  defaultProjectId,
}: {
  trigger?: React.ReactNode;
  defaultCustomerId?: string;
  defaultProjectId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    if (!open || loaded) return;
    let cancelled = false;
    setLoading(true);
    const supabase = createClient();
    void Promise.all([
      supabase
        .from("customers")
        .select("id, name, company, email")
        .order("name"),
      supabase.from("projects").select("id, name, customer_id").order("name"),
    ]).then(([custRes, projRes]) => {
      if (cancelled) return;
      setCustomers((custRes.data ?? []) as Customer[]);
      setProjects((projRes.data ?? []) as Project[]);
      setLoaded(true);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, loaded]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger render={trigger as React.ReactElement} />
      ) : (
        <DialogTrigger
          render={
            <Button size="sm" type="button">
              <Plus className="size-4" />
              New invoice
            </Button>
          }
        />
      )}
      <DialogContent
        showCloseButton
        className="max-h-[min(92dvh,90vh)] w-[calc(100vw-2rem)] max-w-5xl gap-0 overflow-hidden p-0"
      >
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3 sm:px-5">
          <DialogTitle>New invoice</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5">
          {loading && !loaded ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <InvoiceForm
              key={open ? "open" : "closed"}
              customers={customers}
              projects={projects}
              defaultCustomerId={defaultCustomerId}
              defaultProjectId={defaultProjectId}
              className="mx-auto w-full max-w-none space-y-5"
              onSuccess={(id, mode) => {
                setOpen(false);
                setLoaded(false);
                router.refresh();
                if (mode === "close") {
                  router.push("/finance/invoices");
                  return;
                }
                // Open the send-email dialog so create can lead to customer delivery
                router.push(`/finance/invoices/${id}?email=1`);
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
