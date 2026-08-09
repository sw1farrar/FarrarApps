import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import type { Customer } from "@/lib/types/database";
import {
  getPortalAccessStatuses,
  type PortalAccessStatus,
} from "@/lib/data/portal-status";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { PortalStatusBadge } from "@/components/customers/portal-status-badge";
import { ListFilters } from "@/components/filters/list-filters";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const statusFilter = params.status?.trim() ?? "";
  const supabase = await createClient();
  let query = supabase
    .from("customers")
    .select("id, name, company, email, portal_user_id, updated_at")
    .order("name", { ascending: true });

  if (q) {
    const pattern = `%${q.replace(/[%_,]/g, "")}%`;
    query = query.or(
      `name.ilike.${pattern},company.ilike.${pattern},email.ilike.${pattern},city.ilike.${pattern},state.ilike.${pattern},zip.ilike.${pattern},address.ilike.${pattern}`
    );
  }

  const { data } = await query;
  let customers = (data ?? []) as Customer[];

  const statusMap = await getPortalAccessStatuses(
    customers.map((c) => ({ id: c.id, portal_user_id: c.portal_user_id }))
  );

  if (statusFilter === "linked" || statusFilter === "pending" || statusFilter === "unlinked") {
    const want: PortalAccessStatus =
      statusFilter === "linked"
        ? "active"
        : statusFilter === "pending"
          ? "pending"
          : "none";
    customers = customers.filter((c) => statusMap[c.id] === want);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-3">
        <CustomerFormDialog />
      </div>

      <ListFilters
        placeholder="Search customers"
        statusOptions={[
          { value: "linked", label: "Portal active" },
          { value: "pending", label: "Invite pending" },
          { value: "unlinked", label: "No portal" },
        ]}
      />

      {customers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-16 text-center">
          <p className="text-sm font-medium">No customers yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your first client to start linking projects and invoices.
          </p>
          <div className="mt-4 flex justify-center">
            <CustomerFormDialog />
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Portal</TableHead>
                <TableHead className="text-right">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <Link
                      href={`/customers/${customer.id}`}
                      className="font-medium hover:underline"
                    >
                      {customer.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {customer.company || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {customer.email || "—"}
                  </TableCell>
                  <TableCell>
                    <PortalStatusBadge
                      status={statusMap[customer.id] ?? "none"}
                    />
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatDate(customer.updated_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
