import type { Account, TransactionType } from "@/lib/types/database";

type BalanceTransaction = {
  account_id: string;
  transfer_account_id?: string | null;
  type: TransactionType;
  amount: number;
};

export function calculateAccountBalance(
  account: Pick<Account, "id" | "type" | "opening_balance">,
  transactions: BalanceTransaction[]
): number {
  return transactions.reduce((balance, transaction) => {
    const amount = Number(transaction.amount) || 0;

    if (transaction.type === "transfer") {
      if (transaction.account_id === account.id) {
        return balance - amount;
      }
      if (transaction.transfer_account_id === account.id) {
        return account.type === "credit_card"
          ? balance - amount
          : balance + amount;
      }
      return balance;
    }

    if (transaction.account_id !== account.id) return balance;

    if (account.type === "credit_card") {
      return transaction.type === "expense"
        ? balance + amount
        : balance - amount;
    }

    // checking + stripe (cash-like assets)
    return transaction.type === "income"
      ? balance + amount
      : balance - amount;
  }, Number(account.opening_balance) || 0);
}

/** Signed amount effect for an account (for running balances / recon). */
export function isCashLikeAccount(
  type: Pick<Account, "type">["type"] | string
) {
  return type === "checking" || type === "stripe";
}

export function amountForAccount(
  account: Pick<Account, "id" | "type">,
  transaction: BalanceTransaction
): number {
  const amount = Number(transaction.amount) || 0;

  if (transaction.type === "transfer") {
    if (transaction.account_id === account.id) return -amount;
    if (transaction.transfer_account_id === account.id) {
      return account.type === "credit_card" ? -amount : amount;
    }
    return 0;
  }

  if (transaction.account_id !== account.id) return 0;
  if (account.type === "credit_card") {
    return transaction.type === "expense" ? amount : -amount;
  }
  return transaction.type === "income" ? amount : -amount;
}
