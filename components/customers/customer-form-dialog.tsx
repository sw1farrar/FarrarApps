"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { createCustomer, updateCustomer } from "@/lib/data/customers";
import type { Customer } from "@/lib/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function CustomerFormDialog({
  customer,
  trigger,
  onCreated,
  redirectOnCreate = true,
  open: openControlled,
  onOpenChange,
  defaultName,
}: {
  customer?: Customer;
  trigger?: React.ReactNode;
  onCreated?: (customer: { id: string; name: string }) => void;
  redirectOnCreate?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Prefill name when opening from a search-with-no-results flow. */
  defaultName?: string;
}) {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [emailValue, setEmailValue] = React.useState(customer?.email ?? "");
  const [sendPortalInvite, setSendPortalInvite] = React.useState(false);
  const isEdit = Boolean(customer);
  const open = openControlled ?? uncontrolledOpen;

  function setOpen(next: boolean) {
    onOpenChange?.(next);
    if (openControlled === undefined) setUncontrolledOpen(next);
    if (!next) {
      setSendPortalInvite(false);
      setEmailValue(customer?.email ?? "");
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation();
    setPending(true);
    const formData = new FormData(e.currentTarget);
    if (!isEdit && sendPortalInvite) {
      formData.set("send_portal_invite", "true");
    }
    const name = String(formData.get("name") || "").trim();
    const result = isEdit
      ? await updateCustomer(customer!.id, formData)
      : await createCustomer(formData);
    setPending(false);

    if (!result.ok) {
      toast.error(result.error || "Could not save customer");
      return;
    }

    if (isEdit) {
      toast.success("Customer updated");
    } else if ("inviteSent" in result && result.inviteSent) {
      toast.success("Customer created · portal invite sent");
    } else if ("inviteError" in result && result.inviteError) {
      toast.success("Customer created");
      toast.error(String(result.inviteError));
    } else {
      toast.success("Customer created");
    }
    setOpen(false);

    if (!isEdit && result.id) {
      onCreated?.({ id: result.id, name });
      if (redirectOnCreate) {
        router.push(`/customers/${result.id}`);
      } else {
        router.refresh();
      }
      return;
    }

    router.refresh();
  }

  const dialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger render={trigger as React.ReactElement} />
      ) : openControlled === undefined ? (
        <DialogTrigger
          render={
            <Button size="sm" type="button">
              <Plus className="size-4" />
              Add customer
            </Button>
          }
        />
      ) : null}
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0" showCloseButton>
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3 sm:px-5">
          <DialogTitle>{isEdit ? "Edit customer" : "New customer"}</DialogTitle>
          <DialogDescription>
            Contact details, billing address, and notes.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={onSubmit}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5"
        >
          <div className="space-y-1.5">
            <Label htmlFor="customer-name">Name</Label>
            <Input
              id="customer-name"
              name="name"
              required
              defaultValue={customer?.name ?? defaultName ?? ""}
              key={`name-${customer?.id ?? defaultName ?? "new"}-${open}`}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="customer-email">Email</Label>
              <Input
                id="customer-email"
                name="email"
                type="email"
                defaultValue={customer?.email ?? ""}
                onChange={(e) => setEmailValue(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customer-phone">Phone</Label>
              <Input
                id="customer-phone"
                name="phone"
                defaultValue={customer?.phone ?? ""}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="customer-company">Company</Label>
            <Input
              id="customer-company"
              name="company"
              defaultValue={customer?.company ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="customer-address">Address</Label>
            <Input
              id="customer-address"
              name="address"
              defaultValue={customer?.address ?? ""}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-6">
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="customer-city">City</Label>
              <Input
                id="customer-city"
                name="city"
                defaultValue={customer?.city ?? ""}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-1">
              <Label htmlFor="customer-state">State</Label>
              <Input
                id="customer-state"
                name="state"
                defaultValue={customer?.state ?? ""}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="customer-zip">ZIP</Label>
              <Input
                id="customer-zip"
                name="zip"
                defaultValue={customer?.zip ?? ""}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="customer-notes">Notes</Label>
            <Textarea
              id="customer-notes"
              name="notes"
              rows={3}
              defaultValue={customer?.notes ?? ""}
            />
          </div>
          {!isEdit ? (
            <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  className="mt-0.5 size-3.5 rounded border-border"
                  checked={sendPortalInvite}
                  disabled={!emailValue.trim()}
                  onChange={(e) => setSendPortalInvite(e.target.checked)}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    Send portal invite
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    Optional. Leave off to add as a CRM contact only — invite
                    later from the customer page.
                  </span>
                </span>
              </label>
            </div>
          ) : null}
          <DialogFooter className="mx-0 mb-0 border-0 bg-transparent p-0 pt-2">
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Save changes" : "Create customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  return dialog;
}
