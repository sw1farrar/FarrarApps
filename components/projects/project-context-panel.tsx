"use client";

import Link from "next/link";
import { ProjectForm } from "@/components/projects/project-form";
import {
  ProjectFilesPanel,
  ProjectMilestonesPanel,
} from "@/components/projects/project-panels";
import { InvoiceFormDialog } from "@/components/invoices/invoice-form-dialog";
import type {
  Customer,
  Invoice,
  Project,
  ProjectFile,
  ProjectMilestone,
  Transaction,
} from "@/lib/types/database";
import { formatCurrency, formatDate, titleCase } from "@/lib/format";
import {
  displayInvoiceStatus,
  invoiceStatusBadgeClass,
} from "@/lib/invoices/status";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function PanelSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border px-3 py-3 last:border-b-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ProjectContextPanel({
  project,
  customers,
  files,
  milestones,
  invoices,
  transactions,
  compact = false,
}: {
  project: Project;
  customers: Customer[];
  files: ProjectFile[];
  milestones: ProjectMilestone[];
  invoices: Invoice[];
  transactions: Transaction[];
  compact?: boolean;
}) {
  return (
    <div className="divide-y divide-border">
      <PanelSection title="Details">
        <ProjectForm
          customers={customers}
          project={project}
          compact={compact}
        />
      </PanelSection>

      <PanelSection title="Files">
        <ProjectFilesPanel projectId={project.id} files={files} compact />
      </PanelSection>

      <PanelSection title="Milestones">
        <ProjectMilestonesPanel
          projectId={project.id}
          milestones={milestones}
          compact
        />
      </PanelSection>

      <PanelSection
        title="Invoices"
        action={
          <InvoiceFormDialog
            defaultCustomerId={project.customer_id}
            defaultProjectId={project.id}
            trigger={
              <button
                type="button"
                className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
              >
                New
              </button>
            }
          />
        }
      >
        {invoices.length ? (
          <ul className="space-y-1">
            {invoices.map((invoice) => {
              const label = displayInvoiceStatus(
                invoice.status,
                invoice.due_date
              );
              return (
                <li key={invoice.id}>
                  <Link
                    href={`/finance/invoices/${invoice.id}`}
                    className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-xs hover:bg-muted/40"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {invoice.invoice_number}
                      </span>
                      <Badge
                        className={cn(
                          "mt-0.5 h-4 px-1.5 text-[10px]",
                          invoiceStatusBadgeClass(
                            invoice.status,
                            invoice.due_date
                          )
                        )}
                      >
                        {label}
                      </Badge>
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {formatCurrency(invoice.total)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            No invoices for this project yet.
          </p>
        )}
      </PanelSection>

      <PanelSection
        title="Payments"
        action={
          <Link
            href={`/finance/transactions?q=${encodeURIComponent(project.name)}`}
            className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            Finance
          </Link>
        }
      >
        {transactions.length ? (
          <ul className="space-y-1">
            {transactions.map((tx) => (
              <li
                key={tx.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-xs"
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium">
                    {titleCase(tx.type)}
                  </span>
                  {tx.description ? (
                    <span className="text-muted-foreground">
                      {" "}
                      · {tx.description}
                    </span>
                  ) : null}
                  {tx.date ? (
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      {formatDate(tx.date)}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatCurrency(tx.amount)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            No payments linked to this project.
          </p>
        )}
      </PanelSection>
    </div>
  );
}
