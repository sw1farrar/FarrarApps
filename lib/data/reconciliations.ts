"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  amountForAccount,
  calculateAccountBalance,
} from "@/lib/data/account-balances";
import type { ActionResult } from "@/lib/data/customers";
import type {
  Account,
  Reconciliation,
  Transaction,
} from "@/lib/types/database";

function revalidateFinance() {
  revalidatePath("/finance");
  revalidatePath("/finance/reconcile", "layout");
  revalidatePath("/finance/transactions");
  revalidatePath("/finance/accounts", "layout");
}

export async function listReconciliations(): Promise<Reconciliation[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reconciliations")
    .select(
      "id, account_id, statement_date, statement_balance, status, started_by, completed_at, notes, created_at, updated_at, accounts(id, name, type)"
    )
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as Reconciliation[];
}

export async function getReconciliation(
  id: string
): Promise<
  | {
      ok: true;
      reconciliation: Reconciliation;
      account: Account;
      candidates: Transaction[];
      selectedIds: string[];
      clearedTotal: number;
      bookBalance: number;
      difference: number;
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data: rec, error } = await supabase
    .from("reconciliations")
    .select(
      "id, account_id, statement_date, statement_balance, status, started_by, completed_at, notes, created_at, updated_at, accounts(id, name, type)"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !rec) {
    return { ok: false, error: error?.message || "Reconciliation not found" };
  }

  const reconciliation = rec as unknown as Reconciliation;
  const { data: accountRow } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", reconciliation.account_id)
    .single();

  if (!accountRow) return { ok: false, error: "Account not found" };
  const account = accountRow as Account;

  const [{ data: allTx }, { data: items }] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "id, account_id, transfer_account_id, category_id, customer_id, project_id, invoice_id, type, amount, date, description, reference, receipt_path, reconciled_at, reconciled_by, created_by, created_at, updated_at, accounts!transactions_account_id_fkey(id, name), transfer_accounts:accounts!transactions_transfer_account_id_fkey(id, name), categories(id, name, type), customers(id, name), invoices(id, invoice_number)"
      )
      .or(
        `account_id.eq.${account.id},transfer_account_id.eq.${account.id}`
      )
      .lte("date", reconciliation.statement_date)
      .order("date", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("reconciliation_items")
      .select("transaction_id")
      .eq("reconciliation_id", id),
  ]);

  const transactions = (allTx ?? []) as unknown as Transaction[];
  const selectedIds = (items ?? []).map((i) => i.transaction_id as string);
  const selectedSet = new Set(selectedIds);

  const candidates = transactions.filter((tx) => {
    if (selectedSet.has(tx.id)) return true;
    if (reconciliation.status === "completed") return false;
    return !tx.reconciled_at;
  });

  const clearedTotal = selectedIds.reduce((sum, txId) => {
    const tx = transactions.find((t) => t.id === txId);
    if (!tx) return sum;
    return sum + amountForAccount(account, tx);
  }, 0);

  // Book balance through statement date = opening + all effects ≤ date
  const bookBalance = calculateAccountBalance(account, transactions);

  // Difference: statement should match opening + only CLEARED lines in session
  // Starting point: balance of already-reconciled txns as of statement date
  // + opening, then add currently selected (not yet marked reconciled if in progress)
  const priorReconciled = transactions.filter(
    (tx) => tx.reconciled_at && !selectedSet.has(tx.id)
  );
  const baseBalance = calculateAccountBalance(account, priorReconciled);
  const sessionBalance = baseBalance + clearedTotal;
  const difference =
    Number(reconciliation.statement_balance) - sessionBalance;

  return {
    ok: true,
    reconciliation,
    account,
    candidates,
    selectedIds,
    clearedTotal,
    bookBalance,
    difference,
  };
}

export async function startReconciliation(input: {
  accountId: string;
  statementDate: string;
  statementBalance: number;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!input.accountId) return { ok: false, error: "Account is required" };
  if (!input.statementDate) {
    return { ok: false, error: "Statement date is required" };
  }
  if (!Number.isFinite(input.statementBalance)) {
    return { ok: false, error: "Statement balance must be a number" };
  }

  const { data: open } = await supabase
    .from("reconciliations")
    .select("id")
    .eq("account_id", input.accountId)
    .eq("status", "in_progress")
    .maybeSingle();

  if (open?.id) {
    // Return success with existing id so UI can navigate to it
    return {
      ok: true,
      id: open.id,
    };
  }

  const { data, error } = await supabase
    .from("reconciliations")
    .insert({
      account_id: input.accountId,
      statement_date: input.statementDate,
      statement_balance: input.statementBalance,
      status: "in_progress",
      started_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidateFinance();
  return { ok: true, id: data.id };
}

export async function setReconciliationItems(
  reconciliationId: string,
  transactionIds: string[]
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: rec } = await supabase
    .from("reconciliations")
    .select("id, status")
    .eq("id", reconciliationId)
    .maybeSingle();

  if (!rec) return { ok: false, error: "Reconciliation not found" };
  if (rec.status !== "in_progress") {
    return { ok: false, error: "Only open reconciliations can be edited" };
  }

  const { error: delError } = await supabase
    .from("reconciliation_items")
    .delete()
    .eq("reconciliation_id", reconciliationId);
  if (delError) return { ok: false, error: delError.message };

  const unique = [...new Set(transactionIds.filter(Boolean))];
  if (unique.length) {
    const { error: insError } = await supabase
      .from("reconciliation_items")
      .insert(
        unique.map((transaction_id) => ({
          reconciliation_id: reconciliationId,
          transaction_id,
        }))
      );
    if (insError) return { ok: false, error: insError.message };
  }

  revalidatePath(`/finance/reconcile/${reconciliationId}`);
  return { ok: true, id: reconciliationId };
}

export async function completeReconciliation(
  reconciliationId: string,
  opts?: { force?: boolean }
): Promise<ActionResult> {
  const detail = await getReconciliation(reconciliationId);
  if (!detail.ok) return detail;

  if (detail.reconciliation.status !== "in_progress") {
    return { ok: false, error: "Reconciliation is not open" };
  }

  if (!opts?.force && Math.abs(detail.difference) > 0.009) {
    return {
      ok: false,
      error: `Difference is ${detail.difference.toFixed(2)}. Adjust cleared items or force complete.`,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const now = new Date().toISOString();

  if (detail.selectedIds.length) {
    const { error: txError } = await supabase
      .from("transactions")
      .update({
        reconciled_at: now,
        reconciled_by: user?.id ?? null,
      })
      .in("id", detail.selectedIds)
      .is("reconciled_at", null);
    if (txError) return { ok: false, error: txError.message };
  }

  const { error } = await supabase
    .from("reconciliations")
    .update({
      status: "completed",
      completed_at: now,
      updated_at: now,
    })
    .eq("id", reconciliationId);

  if (error) return { ok: false, error: error.message };
  revalidateFinance();
  return { ok: true, id: reconciliationId };
}

export async function voidReconciliation(
  reconciliationId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: rec } = await supabase
    .from("reconciliations")
    .select("id, status")
    .eq("id", reconciliationId)
    .maybeSingle();

  if (!rec) return { ok: false, error: "Not found" };
  if (rec.status === "completed") {
    return {
      ok: false,
      error: "Completed reconciliations cannot be voided (reopen individual transactions instead)",
    };
  }

  const { error } = await supabase
    .from("reconciliations")
    .update({
      status: "void",
      updated_at: new Date().toISOString(),
    })
    .eq("id", reconciliationId);

  if (error) return { ok: false, error: error.message };

  await supabase
    .from("reconciliation_items")
    .delete()
    .eq("reconciliation_id", reconciliationId);

  revalidateFinance();
  return { ok: true, id: reconciliationId };
}
