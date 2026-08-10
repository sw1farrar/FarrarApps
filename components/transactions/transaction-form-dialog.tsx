"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createTransaction } from "@/lib/data/transactions";
import { createCategory } from "@/lib/data/settings";
import { toCalendarDateString } from "@/lib/format";
import type {
  Account,
  Category,
  Customer,
  Project,
  TransactionType,
} from "@/lib/types/database";
import { AccountFormDialog } from "@/components/finance/account-form-dialog";
import { CustomerPicker } from "@/components/customers/customer-picker";
import { ProjectPicker } from "@/components/projects/project-picker";
import { EntityCombobox } from "@/components/ui/entity-combobox";
import { FormSelect } from "@/components/ui/form-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type FormOptions = {
  accounts: Account[];
  categories: Category[];
  customers: Customer[];
  projects: Project[];
};

/** Shortcut intent for transfer dialogs opened from account ledgers. */
export type TransferIntent = "card_payment" | "stripe_payout";

function isCashLike(type: Account["type"] | string) {
  return type === "checking" || type === "stripe";
}

function accountTypeLabel(type: Account["type"]) {
  if (type === "credit_card") return "Credit card";
  if (type === "stripe") return "Stripe";
  return "Checking";
}

export function TransactionFormDialog({
  accounts: initialAccounts,
  categories: initialCategories,
  customers: initialCustomers,
  projects: initialProjects,
  lazyLoad = false,
  initialAccountId = "",
  initialTransferAccountId = "",
  defaultType = "expense",
  transferIntent,
  defaultAmount,
  defaultDescription,
  trigger,
}: {
  accounts?: Account[];
  categories?: Category[];
  customers?: Customer[];
  projects?: Project[];
  lazyLoad?: boolean;
  initialAccountId?: string;
  initialTransferAccountId?: string;
  defaultType?: TransactionType;
  /**
   * When set, form is a transfer-only dialog with labels/filters for that workflow.
   * - card_payment: cash/Stripe → credit card
   * - stripe_payout: Stripe clearing → checking (bank deposit)
   */
  transferIntent?: TransferIntent;
  /** Prefill amount (e.g. Stripe clearing balance for a payout). */
  defaultAmount?: number;
  defaultDescription?: string;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const isTransferShortcut = Boolean(transferIntent);
  const resolvedDefaultType: TransactionType = isTransferShortcut
    ? "transfer"
    : defaultType;

  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [loadingOptions, setLoadingOptions] = React.useState(false);
  const [type, setType] = React.useState<TransactionType>(resolvedDefaultType);
  const [receiptPath, setReceiptPath] = React.useState("");
  const [customerId, setCustomerId] = React.useState("");
  const [projectId, setProjectId] = React.useState("");
  const [accountId, setAccountId] = React.useState(initialAccountId);
  const [transferAccountId, setTransferAccountId] = React.useState(
    initialTransferAccountId
  );
  const [categoryId, setCategoryId] = React.useState("");
  const [addingCategory, setAddingCategory] = React.useState(false);
  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [description, setDescription] = React.useState(
    defaultDescription ??
      (transferIntent === "stripe_payout"
        ? "Stripe payout to bank"
        : transferIntent === "card_payment"
          ? "Credit card payment"
          : "")
  );
  const [amount, setAmount] = React.useState(
    defaultAmount != null && defaultAmount > 0
      ? String(Math.round(defaultAmount * 100) / 100)
      : ""
  );
  const [options, setOptions] = React.useState<FormOptions>({
    accounts: initialAccounts ?? [],
    categories: initialCategories ?? [],
    customers: initialCustomers ?? [],
    projects: initialProjects ?? [],
  });
  const [loaded, setLoaded] = React.useState(!lazyLoad);

  function applyTransferDefaults(accounts: Account[]) {
    if (transferIntent === "stripe_payout") {
      const source =
        accounts.find((a) => a.id === initialAccountId) ??
        accounts.find((a) => a.type === "stripe");
      const dest =
        accounts.find((a) => a.id === initialTransferAccountId) ??
        accounts.find((a) => a.type === "checking");
      setAccountId(source?.id ?? "");
      setTransferAccountId(dest?.id ?? "");
      return;
    }

    if (transferIntent === "card_payment") {
      const dest =
        accounts.find((a) => a.id === initialTransferAccountId) ??
        accounts.find((a) => a.type === "credit_card");
      const source =
        accounts.find((a) => a.id === initialAccountId) ??
        accounts.find((a) => a.type === "checking") ??
        accounts.find((a) => a.type === "stripe");
      setAccountId(source?.id ?? "");
      setTransferAccountId(dest?.id ?? "");
      return;
    }

    // General form defaults
    setAccountId(
      initialAccountId ||
        accounts.find((a) => a.type === "checking")?.id ||
        accounts[0]?.id ||
        ""
    );
    if (resolvedDefaultType === "transfer" || type === "transfer") {
      setTransferAccountId(
        initialTransferAccountId ||
          accounts.find((a) => a.type === "checking" && a.id !== initialAccountId)
            ?.id ||
          accounts.find((a) => a.type === "credit_card")?.id ||
          ""
      );
    }
  }

  React.useEffect(() => {
    if (!lazyLoad) {
      setOptions({
        accounts: initialAccounts ?? [],
        categories: initialCategories ?? [],
        customers: initialCustomers ?? [],
        projects: initialProjects ?? [],
      });
      setLoaded(true);
    }
  }, [
    lazyLoad,
    initialAccounts,
    initialCategories,
    initialCustomers,
    initialProjects,
  ]);

  React.useEffect(() => {
    if (!open || !lazyLoad || loaded) return;

    let cancelled = false;
    setLoadingOptions(true);
    const supabase = createClient();
    void Promise.all([
      supabase
        .from("accounts")
        .select("id, name, type, opening_balance, is_active")
        .eq("is_active", true)
        .order("name"),
      supabase.from("categories").select("id, name, type").order("name"),
      supabase
        .from("customers")
        .select("id, name, company, email")
        .order("name"),
      supabase
        .from("projects")
        .select("id, name, customer_id")
        .order("name"),
    ]).then(([accounts, categories, customers, projects]) => {
      if (cancelled) return;
      const nextAccounts = (accounts.data ?? []) as Account[];
      setOptions({
        accounts: nextAccounts,
        categories: (categories.data ?? []) as Category[],
        customers: (customers.data ?? []) as Customer[],
        projects: (projects.data ?? []) as Project[],
      });
      applyTransferDefaults(nextAccounts);
      setLoaded(true);
      setLoadingOptions(false);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only load once per open
  }, [open, lazyLoad, loaded, initialAccountId, initialTransferAccountId]);

  React.useEffect(() => {
    if (!open || !loaded || !options.accounts.length) return;

    // Only fill empty fields — never clobber a choice the user already made
    if (!accountId || !options.accounts.some((a) => a.id === accountId)) {
      if (transferIntent === "stripe_payout") {
        setAccountId(
          initialAccountId ||
            options.accounts.find((a) => a.type === "stripe")?.id ||
            ""
        );
      } else if (transferIntent === "card_payment") {
        setAccountId(
          initialAccountId ||
            options.accounts.find((a) => a.type === "checking")?.id ||
            options.accounts.find((a) => a.type === "stripe")?.id ||
            ""
        );
      } else {
        setAccountId(
          initialAccountId ||
            options.accounts.find((a) => a.type === "checking")?.id ||
            options.accounts[0].id
        );
      }
    }

    if (
      (type === "transfer" || transferIntent) &&
      (!transferAccountId ||
        !options.accounts.some((a) => a.id === transferAccountId))
    ) {
      if (transferIntent === "stripe_payout") {
        setTransferAccountId(
          initialTransferAccountId ||
            options.accounts.find((a) => a.type === "checking")?.id ||
            ""
        );
      } else if (transferIntent === "card_payment") {
        setTransferAccountId(
          initialTransferAccountId ||
            options.accounts.find((a) => a.type === "credit_card")?.id ||
            ""
        );
      }
    }
  }, [
    open,
    loaded,
    options.accounts,
    accountId,
    transferAccountId,
    transferIntent,
    type,
    initialAccountId,
    initialTransferAccountId,
  ]);

  React.useEffect(() => {
    if (open) {
      setType(resolvedDefaultType);
      setDescription(
        defaultDescription ??
          (transferIntent === "stripe_payout"
            ? "Stripe payout to bank"
            : transferIntent === "card_payment"
              ? "Credit card payment"
              : "")
      );
      setAmount(
        defaultAmount != null && defaultAmount > 0
          ? String(Math.round(defaultAmount * 100) / 100)
          : ""
      );
    }
  }, [
    open,
    resolvedDefaultType,
    defaultDescription,
    defaultAmount,
    transferIntent,
  ]);

  const sourceAccount = options.accounts.find((a) => a.id === accountId);
  const destAccount = options.accounts.find((a) => a.id === transferAccountId);

  const sourceOptions = React.useMemo(() => {
    if (transferIntent === "stripe_payout") {
      return options.accounts.filter((a) => a.type === "stripe");
    }
    if (transferIntent === "card_payment") {
      return options.accounts.filter((a) => isCashLike(a.type));
    }
    // General transfer: money leaves cash-like accounts
    return options.accounts.filter((a) => isCashLike(a.type));
  }, [options.accounts, transferIntent]);

  const destOptions = React.useMemo(() => {
    if (transferIntent === "stripe_payout") {
      return options.accounts.filter(
        (a) => a.type === "checking" && a.id !== accountId
      );
    }
    if (transferIntent === "card_payment") {
      return options.accounts.filter((a) => a.type === "credit_card");
    }
    // General: cash destinations + credit cards (not same as source)
    return options.accounts.filter((a) => {
      if (a.id === accountId) return false;
      if (isCashLike(a.type)) return true;
      if (a.type === "credit_card" && isCashLike(sourceAccount?.type ?? "")) {
        return true;
      }
      return false;
    });
  }, [options.accounts, transferIntent, accountId, sourceAccount?.type]);

  const filteredCategories = options.categories.filter(
    (category) => category.type === type
  );

  const dialogTitle =
    transferIntent === "stripe_payout"
      ? "Record Stripe payout"
      : transferIntent === "card_payment"
        ? "Make credit card payment"
        : type === "transfer"
          ? "Transfer between accounts"
          : "New transaction";

  const descriptionPlaceholder =
    transferIntent === "stripe_payout"
      ? "Stripe payout to bank"
      : transferIntent === "card_payment" ||
          (type === "transfer" && destAccount?.type === "credit_card")
        ? "Credit card payment"
        : type === "transfer"
          ? "Transfer between accounts"
          : undefined;

  async function uploadReceipt(file: File | undefined) {
    if (!file) return;
    const supabase = createClient();
    const path = `${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("receipts").upload(path, file);
    if (error) {
      toast.error(error.message);
      return;
    }
    setReceiptPath(path);
    toast.success("Receipt uploaded");
  }

  async function onAddCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    setAddingCategory(true);
    const formData = new FormData();
    formData.set("name", name);
    formData.set("type", type);
    const result = await createCategory(formData);
    setAddingCategory(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Category added");
    const created = { id: result.id!, name, type } as Category;
    setOptions((prev) => ({
      ...prev,
      categories: [...prev.categories, created],
    }));
    setCategoryId(created.id);
    setNewCategoryName("");
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!options.accounts.length || !accountId) {
      toast.error("Add an account first", {
        action: {
          label: "Accounts",
          onClick: () => router.push("/finance/accounts"),
        },
      });
      return;
    }
    if (type === "transfer" && !transferAccountId) {
      toast.error(
        transferIntent === "stripe_payout"
          ? "Select the checking account that received the payout"
          : transferIntent === "card_payment"
            ? "Select the credit card receiving the payment"
            : "Select a destination account"
      );
      return;
    }
    const formData = new FormData(e.currentTarget);
    if (receiptPath) formData.set("receipt_path", receiptPath);
    formData.set("type", type);
    formData.set("account_id", accountId);
    formData.set("transfer_account_id", transferAccountId);
    formData.set("category_id", categoryId);
    formData.set("customer_id", customerId);
    formData.set("project_id", projectId);
    formData.set("description", description);
    formData.set("amount", amount);
    setPending(true);
    const result = await createTransaction(formData);
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(
      transferIntent === "stripe_payout"
        ? "Payout recorded — Stripe balance moved to bank"
        : "Transaction saved"
    );
    setOpen(false);
    setReceiptPath("");
    setCustomerId("");
    setProjectId("");
    setCategoryId("");
    setType(resolvedDefaultType);
    setDescription(
      defaultDescription ??
        (transferIntent === "stripe_payout"
          ? "Stripe payout to bank"
          : transferIntent === "card_payment"
            ? "Credit card payment"
            : "")
    );
    setAmount(
      defaultAmount != null && defaultAmount > 0
        ? String(Math.round(defaultAmount * 100) / 100)
        : ""
    );
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ? (
            (trigger as React.ReactElement)
          ) : (
            <Button size="sm" type="button">
              <Plus className="size-3.5" />
              Add transaction
            </Button>
          )
        }
      />
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3 sm:px-5">
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5">
          {loadingOptions ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Loading accounts…
            </div>
          ) : options.accounts.length === 0 ? (
            <div className="space-y-3 py-2 text-center">
              <p className="text-sm font-medium">No accounts yet</p>
              <p className="text-sm text-muted-foreground">
                Add a bank account before recording transactions.
              </p>
              <div className="flex justify-center gap-2">
                <AccountFormDialog
                  onCreated={(created) => {
                    setOptions((prev) => ({
                      ...prev,
                      accounts: [
                        ...prev.accounts,
                        {
                          id: created.id,
                          name: created.name,
                          type: "checking",
                          opening_balance: 0,
                          is_active: true,
                        } as Account,
                      ],
                    }));
                    setAccountId(created.id);
                  }}
                />
                <Link
                  href="/finance/accounts"
                  className="inline-flex h-8 items-center rounded-lg px-3 text-sm text-muted-foreground hover:text-foreground"
                >
                  Manage accounts
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-3">
              {transferIntent === "stripe_payout" ? (
                <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                  When Stripe deposits into your bank, record it here. This{" "}
                  <span className="font-medium text-foreground">
                    moves the balance
                  </span>{" "}
                  out of Stripe clearing and into your checking account. It is
                  not income and not a credit card payment — the money already
                  arrived when the customer paid the invoice.
                </p>
              ) : null}
              {transferIntent === "card_payment" ? (
                <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                  Pay down a credit card from checking or Stripe. Balance leaves
                  the cash account and reduces the card liability.
                </p>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                {!isTransferShortcut ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="type">Type</Label>
                    <FormSelect
                      id="type"
                      name="type"
                      value={type}
                      onValueChange={(value) => {
                        setType(value as TransactionType);
                        setCategoryId("");
                        if (value === "transfer") {
                          // Prefer checking destination for general transfers
                          const dest =
                            options.accounts.find(
                              (a) =>
                                a.type === "checking" && a.id !== accountId
                            ) ??
                            options.accounts.find(
                              (a) => a.type === "credit_card"
                            );
                          if (dest) setTransferAccountId(dest.id);
                        }
                      }}
                      options={[
                        { value: "expense", label: "Expense" },
                        { value: "income", label: "Payment received" },
                        {
                          value: "transfer",
                          label: "Transfer / pay card",
                        },
                      ]}
                    />
                  </div>
                ) : (
                  <input type="hidden" name="type" value="transfer" />
                )}
                <div
                  className={
                    isTransferShortcut ? "col-span-2 space-y-1.5" : "space-y-1.5"
                  }
                >
                  <Label htmlFor="amount">
                    {transferIntent === "stripe_payout"
                      ? "Payout amount"
                      : "Amount"}
                  </Label>
                  <Input
                    id="amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={
                      transferIntent === "stripe_payout"
                        ? "Amount Stripe deposited"
                        : undefined
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  defaultValue={toCalendarDateString()}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  name="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={descriptionPlaceholder}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reference">Reference</Label>
                <Input
                  id="reference"
                  name="reference"
                  placeholder={
                    transferIntent === "stripe_payout"
                      ? "Stripe payout ID or bank deposit reference"
                      : "Check, confirmation, or bank reference"
                  }
                />
              </div>
              {type === "transfer" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>
                      {transferIntent === "stripe_payout"
                        ? "From (Stripe clearing)"
                        : transferIntent === "card_payment"
                          ? "From (checking or Stripe)"
                          : "From account"}
                    </Label>
                    <EntityCombobox
                      value={accountId}
                      onValueChange={(next) => {
                        setAccountId(next);
                        // Clear invalid dest if same account
                        if (next === transferAccountId) {
                          setTransferAccountId("");
                        }
                      }}
                      options={sourceOptions.map((account) => ({
                        id: account.id,
                        label: `${account.name} (${accountTypeLabel(account.type)})`,
                      }))}
                      required
                      placeholder={
                        transferIntent === "stripe_payout"
                          ? "Select Stripe account"
                          : "Select source account"
                      }
                      searchPlaceholder="Search accounts…"
                      emptyLabel={
                        transferIntent === "stripe_payout"
                          ? "No Stripe accounts"
                          : "No cash accounts"
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>
                      {transferIntent === "stripe_payout"
                        ? "To (bank / checking)"
                        : transferIntent === "card_payment"
                          ? "To credit card"
                          : "To account"}
                    </Label>
                    <EntityCombobox
                      value={transferAccountId}
                      onValueChange={setTransferAccountId}
                      options={destOptions.map((account) => ({
                        id: account.id,
                        label: `${account.name} (${accountTypeLabel(account.type)})`,
                      }))}
                      required
                      placeholder={
                        transferIntent === "stripe_payout"
                          ? "Select checking account"
                          : transferIntent === "card_payment"
                            ? "Select credit card"
                            : "Select destination"
                      }
                      searchPlaceholder="Search accounts…"
                      emptyLabel={
                        transferIntent === "stripe_payout"
                          ? "No checking accounts — add one first"
                          : transferIntent === "card_payment"
                            ? "No credit cards"
                            : "No destination accounts"
                      }
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Account</Label>
                    <AccountFormDialog
                      onCreated={(created) => {
                        setOptions((prev) => ({
                          ...prev,
                          accounts: [
                            ...prev.accounts,
                            {
                              id: created.id,
                              name: created.name,
                              type: "checking",
                              opening_balance: 0,
                              is_active: true,
                            } as Account,
                          ],
                        }));
                        setAccountId(created.id);
                      }}
                      trigger={
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs"
                        >
                          + New account
                        </Button>
                      }
                    />
                  </div>
                  <EntityCombobox
                    value={accountId}
                    onValueChange={setAccountId}
                    options={options.accounts.map((account) => ({
                      id: account.id,
                      label: account.name,
                    }))}
                    required
                    placeholder="Select account"
                    searchPlaceholder="Search accounts…"
                    emptyLabel="No accounts match"
                  />
                </div>
              )}
              {type !== "transfer" ? (
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <EntityCombobox
                    value={categoryId}
                    onValueChange={setCategoryId}
                    options={filteredCategories.map((category) => ({
                      id: category.id,
                      label: category.name,
                    }))}
                    allowNone
                    noneLabel="None"
                    placeholder="Select category"
                    searchPlaceholder="Search categories…"
                    emptyLabel="No categories match"
                    createLabel={`Add ${type} category`}
                    onCreate={(query) => {
                      if (query.trim()) {
                        setNewCategoryName(query.trim());
                        void (async () => {
                          setAddingCategory(true);
                          const formData = new FormData();
                          formData.set("name", query.trim());
                          formData.set("type", type);
                          const result = await createCategory(formData);
                          setAddingCategory(false);
                          if (!result.ok) {
                            toast.error(result.error);
                            return;
                          }
                          toast.success("Category added");
                          const created = {
                            id: result.id!,
                            name: query.trim(),
                            type,
                          } as Category;
                          setOptions((prev) => ({
                            ...prev,
                            categories: [...prev.categories, created],
                          }));
                          setCategoryId(created.id);
                          setNewCategoryName("");
                        })();
                      }
                    }}
                  />
                  <div className="flex gap-2">
                    <Input
                      placeholder={`New ${type} category`}
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="h-8"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={addingCategory || !newCategoryName.trim()}
                      onClick={() => void onAddCategory()}
                    >
                      {addingCategory ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        "Add"
                      )}
                    </Button>
                  </div>
                </div>
              ) : null}
              {type !== "transfer" ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Customer</Label>
                    <CustomerPicker
                      value={customerId}
                      onValueChange={(next) => {
                        setCustomerId(next);
                        setProjectId("");
                      }}
                      customers={options.customers}
                      onCustomersChange={(next) =>
                        setOptions((prev) => ({
                          ...prev,
                          customers: next as Customer[],
                        }))
                      }
                      allowNone
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Project</Label>
                    <ProjectPicker
                      value={projectId}
                      onValueChange={setProjectId}
                      projects={options.projects}
                      customerId={customerId || undefined}
                      onCreateHref={
                        customerId
                          ? `/projects/new?customerId=${customerId}`
                          : null
                      }
                    />
                  </div>
                </div>
              ) : null}
              {type !== "transfer" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="receipt">Receipt</Label>
                  <label className="flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-input px-2 text-xs text-muted-foreground hover:bg-muted/40">
                    <Upload className="size-3.5" />
                    {receiptPath ? "Receipt attached" : "Upload receipt"}
                    <input
                      id="receipt"
                      type="file"
                      className="hidden"
                      accept="image/*,application/pdf"
                      onChange={(e) => uploadReceipt(e.target.files?.[0])}
                    />
                  </label>
                </div>
              ) : null}
              <DialogFooter className="mx-0 mb-0 border-0 bg-transparent p-0 pt-2">
                <Button type="submit" size="sm" disabled={pending}>
                  {pending && <Loader2 className="size-3.5 animate-spin" />}
                  {transferIntent === "stripe_payout"
                    ? "Record payout"
                    : transferIntent === "card_payment"
                      ? "Record payment"
                      : "Save"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
