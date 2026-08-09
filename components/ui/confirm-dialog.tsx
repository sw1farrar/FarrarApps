"use client";

import * as React from "react";
import { AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive styling for delete/unlink actions */
  variant?: "default" | "destructive";
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = React.createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within ConfirmProvider");
  }
  return ctx;
}

type Pending = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = React.useState<Pending | null>(null);

  const confirm = React.useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  function finish(value: boolean) {
    pending?.resolve(value);
    setPending(null);
  }

  const isDestructive = pending?.variant === "destructive";
  const Icon = isDestructive ? AlertTriangle : Info;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={Boolean(pending)}
        onOpenChange={(open) => {
          if (!open) finish(false);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="max-h-[min(92dvh,90vh)] max-w-[24rem] gap-0 overflow-y-auto p-0 sm:rounded-2xl"
        >
          <div className="flex flex-col gap-5 p-5 sm:p-6">
            <div className="flex gap-3.5 sm:gap-4">
              <div
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-full",
                  isDestructive
                    ? "bg-destructive/10 text-destructive"
                    : "bg-primary/10 text-primary"
                )}
                aria-hidden
              >
                <Icon className="size-5" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5 pt-0.5 text-left">
                <DialogTitle className="text-base font-semibold leading-snug tracking-tight text-foreground">
                  {pending?.title}
                </DialogTitle>
                {pending?.description ? (
                  <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                    {pending.description}
                  </DialogDescription>
                ) : (
                  <DialogDescription className="sr-only">
                    Confirm this action
                  </DialogDescription>
                )}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2.5">
              <Button
                type="button"
                variant="outline"
                className="h-9 w-full rounded-lg sm:w-auto sm:min-w-[5.5rem]"
                onClick={() => finish(false)}
              >
                {pending?.cancelLabel ?? "Cancel"}
              </Button>
              <Button
                type="button"
                variant={isDestructive ? "destructive" : "default"}
                className={cn(
                  "h-9 w-full rounded-lg sm:w-auto sm:min-w-[5.5rem]",
                  isDestructive &&
                    "bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive dark:text-white dark:hover:bg-destructive/90"
                )}
                onClick={() => finish(true)}
                autoFocus
              >
                {pending?.confirmLabel ?? "Confirm"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
