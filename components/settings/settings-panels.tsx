"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createAccount,
  createCategory,
  deleteCategory,
  setAccountActive,
  uploadCompanyLogo,
  updateCompanySettings,
  updateUserRole,
} from "@/lib/data/settings";
import { inviteStaffMember } from "@/lib/data/staff";
import type {
  Account,
  Category,
  CompanySettings,
  Profile,
  UserRole,
} from "@/lib/types/database";
import { FormSelect } from "@/components/ui/form-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function CompanySettingsForm({
  settings,
  logoUrl,
}: {
  settings: CompanySettings | null;
  logoUrl?: string | null;
}) {
  const router = useRouter();
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(
    logoUrl ?? null
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = await updateCompanySettings(new FormData(e.currentTarget));
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Company settings saved");
      router.refresh();
    }
  }

  async function onLogoUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = await uploadCompanyLogo(new FormData(e.currentTarget));
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Logo uploaded");
      router.refresh();
    }
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-sm">Company information</CardTitle>
        <CardDescription className="text-xs">
          Used on invoices and PDFs.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <form onSubmit={onLogoUpload} className="mb-3 space-y-2 rounded-lg border border-border p-2">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl || "/farrar_apps_logo.png"}
              alt="Company logo preview"
              className="h-12 w-20 rounded-md border border-border object-contain"
            />
            <div className="min-w-0 flex-1">
              <Label htmlFor="logo" className="text-xs">
                Logo
              </Label>
              <Input
                id="logo"
                name="logo"
                type="file"
                accept="image/*"
                className="mt-1"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setPreviewUrl(URL.createObjectURL(file));
                }}
              />
            </div>
            <Button type="submit" size="sm" variant="outline">
              Upload
            </Button>
          </div>
        </form>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="name">Company name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={settings?.name ?? "Farrar Apps"}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              name="address"
              rows={3}
              defaultValue={settings?.address ?? ""}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={settings?.email ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={settings?.phone ?? ""}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invoice_terms">Invoice terms</Label>
            <Textarea
              id="invoice_terms"
              name="invoice_terms"
              rows={3}
              defaultValue={settings?.invoice_terms ?? ""}
            />
          </div>
          <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
            <div>
              <p className="text-sm font-medium">Online card payments</p>
              <p className="text-[11px] text-muted-foreground">
                Pass-through fee so card payments net about the full invoice
                amount after Stripe. Shown as a separate line at checkout.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="stripe_fee_percent">Fee percent (%)</Label>
                <Input
                  id="stripe_fee_percent"
                  name="stripe_fee_percent"
                  type="number"
                  min={0}
                  max={99.99}
                  step={0.01}
                  defaultValue={
                    settings?.stripe_fee_percent != null
                      ? Number(settings.stripe_fee_percent)
                      : 2.9
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stripe_fee_fixed">Fixed fee ($)</Label>
                <Input
                  id="stripe_fee_fixed"
                  name="stripe_fee_fixed"
                  type="number"
                  min={0}
                  step={0.01}
                  defaultValue={
                    settings?.stripe_fee_fixed != null
                      ? Number(settings.stripe_fee_fixed)
                      : 0.3
                  }
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Default US card rate is 2.9% + $0.30. On a $100 invoice the
              customer is charged about $103.40 so you receive ~$100 after
              fees.
            </p>
          </div>
          <Button type="submit" size="sm">
            Save company
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function CategoriesManager({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [categoryType, setCategoryType] = React.useState("expense");

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("type", categoryType);
    const result = await createCategory(formData);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Category added");
      e.currentTarget.reset();
      setCategoryType("expense");
      router.refresh();
    }
  }

  async function onDelete(id: string) {
    const result = await deleteCategory(id);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Category deleted");
      router.refresh();
    }
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-sm">Categories</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-3 pt-0">
        <form onSubmit={onCreate} className="flex flex-wrap gap-2">
          <Input name="name" placeholder="Category name" required className="min-w-40 flex-1" />
          <FormSelect
            name="type"
            value={categoryType}
            onValueChange={setCategoryType}
            className="w-32"
            options={[
              { value: "expense", label: "Expense" },
              { value: "income", label: "Income" },
            ]}
          />
          <Button type="submit" size="sm">
            Add
          </Button>
        </form>
        <ul className="space-y-1">
          {categories.length === 0 ? (
            <li className="rounded-md border border-dashed border-border px-2 py-3 text-xs text-muted-foreground">
              No categories yet. Add income and expense categories to classify
              transactions.
            </li>
          ) : (
            categories.map((category) => (
              <li
                key={category.id}
                className="flex items-center justify-between rounded-md border border-border px-2 py-1.5 text-sm"
              >
                <span>
                  {category.name}{" "}
                  <span className="text-xs text-muted-foreground">
                    ({category.type})
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDelete(category.id)}
                >
                  Delete
                </Button>
              </li>
            ))
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

const ACCOUNT_TYPE_LABELS: Record<Account["type"], string> = {
  checking: "Checking account",
  credit_card: "Credit card",
  stripe: "Stripe clearing",
};

export function AccountsManager({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [accountType, setAccountType] = React.useState("checking");

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("type", accountType);
    const result = await createAccount(formData);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Account added");
      e.currentTarget.reset();
      setAccountType("checking");
      router.refresh();
    }
  }

  async function onToggleActive(account: Account) {
    const result = await setAccountActive(account.id, !account.is_active);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success(account.is_active ? "Account archived" : "Account restored");
      router.refresh();
    }
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-sm">Accounts</CardTitle>
        <CardDescription className="text-xs">
          Bank accounts and cards for transactions and invoice payments.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-3 pt-0">
        <form
          onSubmit={onCreate}
          className="grid gap-2 sm:grid-cols-[1fr_minmax(8rem,10rem)_auto_auto]"
        >
          <Input name="name" placeholder="Account name" required />
          <FormSelect
            name="type"
            value={accountType}
            onValueChange={setAccountType}
            options={[
              { value: "checking", label: "Checking account" },
              { value: "credit_card", label: "Credit card" },
              { value: "stripe", label: "Stripe clearing" },
            ]}
          />
          <Input
            name="opening_balance"
            type="number"
            step="0.01"
            defaultValue="0"
            className="w-28"
            aria-label="Opening balance"
          />
          <Button type="submit" size="sm">
            Add
          </Button>
        </form>
        <ul className="space-y-1">
          {accounts.length === 0 ? (
            <li className="rounded-md border border-dashed border-border px-2 py-3 text-xs text-muted-foreground">
              No accounts yet. Add checking, credit card, or Stripe clearing.
            </li>
          ) : (
            accounts.map((account) => (
              <li
                key={account.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {account.name}
                    {!account.is_active ? (
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        (archived)
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ACCOUNT_TYPE_LABELS[account.type]} · opening{" "}
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                    }).format(Number(account.opening_balance || 0))}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onToggleActive(account)}
                >
                  {account.is_active ? "Archive" : "Restore"}
                </Button>
              </li>
            ))
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

export function UsersManager({
  users,
  canManage,
  clientLinks = {},
}: {
  users: Profile[];
  canManage: boolean;
  /** For client-role users: linked CRM customers (portal membership). */
  clientLinks?: Record<
    string,
    { customerIds: string[]; customerNames: string[] }
  >;
}) {
  const router = useRouter();
  const [inviteRole, setInviteRole] = React.useState<UserRole>("staff");

  async function onInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const result = await inviteStaffMember({
      email: String(formData.get("email") || ""),
      fullName: String(formData.get("full_name") || "") || undefined,
      role: inviteRole,
    });
    if (!result.ok) toast.error(result.error);
    else {
      toast.success(result.message || "Invite sent");
      e.currentTarget.reset();
      setInviteRole("staff");
      router.refresh();
    }
  }

  async function onRoleChange(userId: string, role: UserRole) {
    const result = await updateUserRole(userId, role);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Role updated");
      router.refresh();
    }
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-sm">Users</CardTitle>
        <CardDescription className="text-xs">
          Invite people with a role, or change roles for existing accounts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-3 pt-0">
        {canManage ? (
          <form onSubmit={onInvite} className="space-y-2 rounded-lg border border-border p-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="invite_email" className="text-xs">
                  Email
                </Label>
                <Input
                  id="invite_email"
                  name="email"
                  type="email"
                  placeholder="name@example.com"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="invite_name" className="text-xs">
                  Name
                </Label>
                <Input
                  id="invite_name"
                  name="full_name"
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[10rem] flex-1 space-y-1">
                <Label htmlFor="invite_role" className="text-xs">
                  Role
                </Label>
                <FormSelect
                  id="invite_role"
                  value={inviteRole}
                  onValueChange={(value) => setInviteRole(value as UserRole)}
                  options={[
                    { value: "owner", label: "Owner" },
                    { value: "staff", label: "Staff" },
                    { value: "client", label: "Client" },
                  ]}
                  aria-label="Invite role"
                />
              </div>
              <Button type="submit" size="sm" className="shrink-0">
                Send invite
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Clients use the portal. Staff and owners use the workspace. For a
              customer already in CRM, prefer Invite to portal on their profile.
            </p>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            Only owners can invite users or change roles.
          </p>
        )}
        <ul className="space-y-2">
          {users.map((user) => {
            const link = clientLinks[user.id];
            const isClient = user.role === "client";
            const hasPortal =
              isClient && (link?.customerIds?.length ?? 0) > 0;
            return (
              <li
                key={user.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border px-2 py-1.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {user.full_name || user.email}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </p>
                  {isClient ? (
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {hasPortal
                        ? `Portal · ${link!.customerNames.join(", ")}`
                        : "Client account · no customer linked"}
                    </p>
                  ) : null}
                </div>
                {canManage ? (
                  <FormSelect
                    className="w-28 shrink-0"
                    value={user.role}
                    onValueChange={(value) =>
                      onRoleChange(user.id, value as UserRole)
                    }
                    options={[
                      { value: "owner", label: "Owner" },
                      { value: "staff", label: "Staff" },
                      { value: "client", label: "Client" },
                    ]}
                    aria-label={`Role for ${user.email}`}
                  />
                ) : (
                  <span className="shrink-0 text-xs capitalize text-muted-foreground">
                    {user.role}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
