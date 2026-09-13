"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/data/activity";
import { businessCalendarDate } from "@/lib/format";
import type { ActionResult } from "@/lib/data/customers";
import type { TransactionType } from "@/lib/types/database";

const TRANSACTION_TYPES = new Set<TransactionType>([
  "income",
  "expense",
  "transfer",
]);

type Check = { ok: true } | { ok: false; error: string };

function revalidateTransactionPaths(
  accountId?: string | null,
  transferAccountId?: string | null
) {
  revalidatePath("/finance/transactions");
  revalidatePath("/finance/accounts");
  revalidatePath("/finance");
  revalidatePath("/finance/reconcile", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/finance/reports");
  if (accountId) revalidatePath(`/finance/accounts/${accountId}`);
  if (transferAccountId) {
    revalidatePath(`/finance/accounts/${transferAccountId}`);
  }
}

function moneyCents(value: unknown) {
  return Math.round(Number(value) * 100);
}

function hasField(formData: FormData, key: string) {
  return formData.has(key);
}

function mergeText(
  formData: FormData,
  key: string,
  fallback: string | null
): string | null {
  if (!hasField(formData, key)) return fallback;
  return String(formData.get(key) || "").trim() || null;
}

function mergeId(
  formData: FormData,
  key: string,
  fallback: string | null
): string | null {
  return mergeText(formData, key, fallback);
}

async function assertTransferAccounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  accountId: string,
  transferAccountId: string | null
): Promise<Check> {
  if (!transferAccountId) {
    return { ok: false, error: "Destination account is required" };
  }
  if (accountId === transferAccountId) {
    return { ok: false, error: "Choose two different accounts" };
  }
  const { data: transferAccounts } = await supabase
    .from("accounts")
    .select("id, type")
    .in("id", [accountId, transferAccountId]);
  const source = transferAccounts?.find((account) => account.id === accountId);
  const destination = transferAccounts?.find(
    (account) => account.id === transferAccountId
  );
  const cashLike = (t?: string) => t === "checking" || t === "stripe";
  const allowed =
    (cashLike(source?.type) && destination?.type === "credit_card") ||
    (cashLike(source?.type) && cashLike(destination?.type));
  if (!allowed) {
    return {
      ok: false,
      error:
        "Transfers must move between cash/Stripe accounts, or pay a credit card from checking/Stripe",
    };
  }
  return { ok: true };
}

export async function createTransaction(
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const amount = Number(formData.get("amount") || 0);
  const payload = {
    type: String(formData.get("type") || "expense") as TransactionType,
    amount,
    date: String(formData.get("date") || businessCalendarDate()),
    description: String(formData.get("description") || "").trim() || null,
    reference: String(formData.get("reference") || "").trim() || null,
    account_id: String(formData.get("account_id") || ""),
    transfer_account_id:
      String(formData.get("transfer_account_id") || "") || null,
    category_id: String(formData.get("category_id") || "") || null,
    customer_id: String(formData.get("customer_id") || "") || null,
    project_id: String(formData.get("project_id") || "") || null,
    invoice_id: String(formData.get("invoice_id") || "") || null,
    receipt_path: String(formData.get("receipt_path") || "") || null,
    created_by: user?.id ?? null,
  };

  if (!payload.account_id) return { ok: false, error: "Account is required" };
  if (!(amount > 0)) return { ok: false, error: "Amount must be greater than 0" };
  if (payload.type === "transfer") {
    const transferCheck = await assertTransferAccounts(
      supabase,
      payload.account_id,
      payload.transfer_account_id
    );
    if (!transferCheck.ok) return transferCheck;
    payload.category_id = null;
    payload.customer_id = null;
    payload.project_id = null;
    payload.invoice_id = null;
  } else {
    payload.transfer_account_id = null;
  }

  const { data, error } = await supabase
    .from("transactions")
    .insert(payload)
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  await logActivity({
    action: "created",
    entity_type: "transaction",
    entity_id: data.id,
    meta: { type: payload.type, amount: payload.amount },
  });

  revalidateTransactionPaths(payload.account_id, payload.transfer_account_id);
  return { ok: true, id: data.id };
}

export async function updateTransaction(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: existing, error: loadError } = await supabase
    .from("transactions")
    .select(
      "id, type, amount, date, description, reference, account_id, transfer_account_id, category_id, customer_id, project_id, invoice_id, receipt_path, reconciled_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (loadError) return { ok: false, error: loadError.message };
  if (!existing) return { ok: false, error: "Transaction not found" };

  let type = existing.type as TransactionType;
  if (hasField(formData, "type")) {
    const nextType = String(formData.get("type") || "") as TransactionType;
    if (!TRANSACTION_TYPES.has(nextType)) {
      return { ok: false, error: "Type must be income, expense, or transfer" };
    }
    type = nextType;
  }

  let amount = Number(existing.amount);
  if (hasField(formData, "amount")) {
    amount = Number(formData.get("amount"));
  }
  if (!Number.isFinite(amount)) {
    return { ok: false, error: "Amount must be greater than 0" };
  }

  let date = String(existing.date).slice(0, 10);
  if (hasField(formData, "date")) {
    date = String(formData.get("date") || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { ok: false, error: "Date must be YYYY-MM-DD" };
    }
  }

  const payload = {
    type,
    amount,
    date,
    description: mergeText(formData, "description", existing.description),
    reference: mergeText(formData, "reference", existing.reference),
    account_id:
      mergeId(formData, "account_id", existing.account_id) ?? "",
    transfer_account_id: mergeId(
      formData,
      "transfer_account_id",
      existing.transfer_account_id
    ),
    category_id: mergeId(formData, "category_id", existing.category_id),
    customer_id: mergeId(formData, "customer_id", existing.customer_id),
    project_id: mergeId(formData, "project_id", existing.project_id),
    invoice_id: mergeId(formData, "invoice_id", existing.invoice_id),
    receipt_path: mergeText(formData, "receipt_path", existing.receipt_path),
  };

  if (!payload.account_id) return { ok: false, error: "Account is required" };
  if (!(payload.amount > 0)) {
    return { ok: false, error: "Amount must be greater than 0" };
  }

  if (payload.type === "transfer") {
    const transferCheck = await assertTransferAccounts(
      supabase,
      payload.account_id,
      payload.transfer_account_id
    );
    if (!transferCheck.ok) return transferCheck;
    payload.category_id = null;
    payload.customer_id = null;
    payload.project_id = null;
    payload.invoice_id = null;
  } else {
    payload.transfer_account_id = null;
  }

  const financialChanged =
    payload.type !== existing.type ||
    moneyCents(payload.amount) !== moneyCents(existing.amount) ||
    payload.account_id !== existing.account_id ||
    (payload.transfer_account_id ?? null) !==
      (existing.transfer_account_id ?? null);

  if (existing.reconciled_at && financialChanged) {
    return {
      ok: false,
      error:
        "Reconciled transactions cannot change amount, account, or type. Reopen the transaction first, or update category, description, date, or reference without reopening.",
    };
  }

  const { error } = await supabase
    .from("transactions")
    .update(payload)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    action: "updated",
    entity_type: "transaction",
    entity_id: id,
    meta: {
      type: payload.type,
      amount: payload.amount,
      reconciled: Boolean(existing.reconciled_at),
    },
  });

  revalidateTransactionPaths(payload.account_id, payload.transfer_account_id);
  if (existing.account_id !== payload.account_id) {
    revalidatePath(`/finance/accounts/${existing.account_id}`);
  }
  if (
    existing.transfer_account_id &&
    existing.transfer_account_id !== payload.transfer_account_id
  ) {
    revalidatePath(`/finance/accounts/${existing.transfer_account_id}`);
  }
  return { ok: true, id };
}

export async function getReceiptSignedUrl(
  storagePath: string
): Promise<ActionResult & { url?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("receipts")
    .createSignedUrl(storagePath, 60 * 60);

  if (error || !data?.signedUrl) {
    return { ok: false, error: error?.message || "Could not create receipt link" };
  }

  return { ok: true, url: data.signedUrl };
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .is("reconciled_at", null)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) {
    return { ok: false, error: "Reconciled transactions cannot be deleted" };
  }

  await logActivity({
    action: "deleted",
    entity_type: "transaction",
    entity_id: id,
  });

  revalidatePath("/finance/transactions");
  revalidatePath("/finance/accounts");
  revalidatePath("/finance");
  revalidatePath("/dashboard");
  revalidatePath("/finance/reports");
  return { ok: true };
}

export async function setTransactionReconciled(
  id: string,
  reconciled: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("transactions")
    .update({
      reconciled_at: reconciled ? new Date().toISOString() : null,
      reconciled_by: reconciled ? user?.id ?? null : null,
    })
    .eq("id", id)
    .select("id, account_id, transfer_account_id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Transaction not found" };

  await logActivity({
    action: reconciled ? "reconciled" : "reopened",
    entity_type: "transaction",
    entity_id: id,
  });

  revalidateTransactionPaths(data.account_id, data.transfer_account_id);
  return { ok: true, id };
}
