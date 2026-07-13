"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createCategory,
  deleteCategory,
  updateCompanySettings,
  updateUserRole,
} from "@/lib/data/settings";
import type {
  Category,
  CompanySettings,
  Profile,
  UserRole,
} from "@/lib/types/database";
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
}: {
  settings: CompanySettings | null;
}) {
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = await updateCompanySettings(new FormData(e.currentTarget));
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Company settings saved");
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

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = await createCategory(new FormData(e.currentTarget));
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Category added");
      e.currentTarget.reset();
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
        <form onSubmit={onCreate} className="flex gap-2">
          <Input name="name" placeholder="Category name" required />
          <select
            name="type"
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
            defaultValue="expense"
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
          <Button type="submit" size="sm">
            Add
          </Button>
        </form>
        <ul className="space-y-1">
          {categories.map((category) => (
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
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function UsersManager({
  users,
  canManage,
}: {
  users: Profile[];
  canManage: boolean;
}) {
  const router = useRouter();

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
          Owners can change roles. Invites arrive with portal email polish later.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 p-3 pt-0">
        {users.map((user) => (
          <div
            key={user.id}
            className="flex items-center justify-between gap-3 rounded-md border border-border px-2 py-1.5 text-sm"
          >
            <div>
              <p className="font-medium">{user.full_name || user.email}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            {canManage ? (
              <select
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
                value={user.role}
                onChange={(e) =>
                  onRoleChange(user.id, e.target.value as UserRole)
                }
              >
                <option value="owner">owner</option>
                <option value="staff">staff</option>
                <option value="client">client</option>
              </select>
            ) : (
              <span className="text-xs capitalize text-muted-foreground">
                {user.role}
              </span>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
