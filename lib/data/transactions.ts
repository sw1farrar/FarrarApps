"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/data/activity";
import { businessCalendarDate } from "@/lib/format";
import type { ActionResult } from "@/lib/data/customers";
import type { TransactionType } from "@/lib/types/database";

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
    if (!payload.transfer_account_id) {
      return { ok: false, error: "Destination account is required" };
    }
    if (payload.account_id === payload.transfer_account_id) {
      return { ok: false, error: "Choose two different accounts" };
    }
    const { data: transferAccounts } = await supabase
      .from("accounts")
      .select("id, type")
      .in("id", [payload.account_id, payload.transfer_account_id]);
    const source = transferAccounts?.find(
      (account) => account.id === payload.account_id
    );
    const destination = transferAccounts?.find(
      (account) => account.id === payload.transfer_account_id
    );
    const sourceType = source?.type;
    const destType = destination?.type;
    const cashLike = (t?: string) => t === "checking" || t === "stripe";
    // Allowed: cash/stripe → credit card (pay card), stripe → checking (payout),
    // checking ↔ stripe, checking ↔ checking.
    const allowed =
      (cashLike(sourceType) && destType === "credit_card") ||
      (cashLike(sourceType) && cashLike(destType));
    if (!allowed) {
      return {
        ok: false,
        error:
          "Transfers must move between cash/Stripe accounts, or pay a credit card from checking/Stripe",
      };
    }
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

  revalidatePath("/finance/transactions");
  revalidatePath("/finance/accounts");
  revalidatePath(`/finance/accounts/${payload.account_id}`);
  if (payload.transfer_account_id) {
    revalidatePath(`/finance/accounts/${payload.transfer_account_id}`);
  }
  revalidatePath("/finance");
  revalidatePath("/dashboard");
  revalidatePath("/finance/reports");
  return { ok: true, id: data.id };
}

export async function updateTransaction(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
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
  };

  if (!payload.account_id) return { ok: false, error: "Account is required" };
  if (!(amount > 0)) return { ok: false, error: "Amount must be greater than 0" };
  if (payload.type !== "transfer") payload.transfer_account_id = null;
  if (
    payload.type === "transfer" &&
    (!payload.transfer_account_id ||
      payload.account_id === payload.transfer_account_id)
  ) {
    return { ok: false, error: "Choose two different transfer accounts" };
  }

  const { data, error } = await supabase
    .from("transactions")
    .update(payload)
    .eq("id", id)
    .is("reconciled_at", null)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Reconciled transactions cannot be edited" };

  await logActivity({
    action: "updated",
    entity_type: "transaction",
    entity_id: id,
    meta: { type: payload.type, amount: payload.amount },
  });

  revalidatePath("/finance/transactions");
  revalidatePath("/finance/accounts");
  revalidatePath("/finance");
  revalidatePath("/dashboard");
  revalidatePath("/finance/reports");
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
  const { error } = await supabase
    .from("transactions")
    .update({
      reconciled_at: reconciled ? new Date().toISOString() : null,
      reconciled_by: reconciled ? user?.id ?? null : null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/finance/transactions");
  revalidatePath("/finance/accounts");
  return { ok: true, id };
}
