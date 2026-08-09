/**
 * Inventory + cleanup of test finance data.
 * Keeps accounts (opening balances) and master data; removes invoices, payments, txs.
 *
 * Usage:
 *   node scripts/cleanup-test-finance.mjs           # dry-run inventory
 *   node scripts/cleanup-test-finance.mjs --execute # actually delete
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
}

const execute = process.argv.includes("--execute");
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function count(table, filter) {
  let q = sb.from(table).select("id", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count, error } = await q;
  if (error) return { error: error.message, count: null };
  return { count: count ?? 0 };
}

async function inventory() {
  const tables = [
    "stripe_invoice_payments",
    "invoice_payment_links",
    "invoice_line_items",
    "invoices",
    "transactions",
    "reconciliation_items",
    "reconciliations",
    "accounts",
  ];
  console.log("=== Inventory ===");
  for (const t of tables) {
    const { count: n, error } = await count(t);
    console.log(`  ${t}: ${error ?? n}`);
  }

  const { data: accounts } = await sb
    .from("accounts")
    .select("id, name, type, opening_balance, is_active")
    .order("name");
  console.log("\nAccounts:");
  for (const a of accounts ?? []) {
    console.log(
      `  ${a.name} (${a.type}) opening=${a.opening_balance} active=${a.is_active}`
    );
  }

  const { data: invoices } = await sb
    .from("invoices")
    .select("id, invoice_number, status, total, customers(name)")
    .order("invoice_number");
  console.log("\nInvoices:");
  for (const inv of invoices ?? []) {
    console.log(
      `  ${inv.invoice_number} ${inv.status} $${inv.total} ${(inv.customers)?.name ?? ""}`
    );
  }

  const { data: txs } = await sb
    .from("transactions")
    .select("id, type, amount, description, date")
    .order("date");
  console.log("\nTransactions:");
  for (const t of txs ?? []) {
    console.log(
      `  ${t.date} ${t.type} $${t.amount} ${t.description ?? ""}`
    );
  }
}

async function delAll(table, label = table) {
  // Delete all rows — service role bypasses RLS
  const { data, error } = await sb.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000").select("id");
  if (error) {
    console.error(`  FAIL ${label}:`, error.message);
    return 0;
  }
  console.log(`  deleted ${data?.length ?? 0} from ${label}`);
  return data?.length ?? 0;
}

async function cleanup() {
  console.log("\n=== Cleanup (execute) ===");
  // Order matters for FKs
  const order = [
    "reconciliation_items",
    "reconciliations",
    "stripe_invoice_payments",
    "invoice_payment_links",
    "transactions", // may reference invoices
    "invoice_line_items",
    "invoices",
  ];

  // Also check for other payment-related tables
  const optional = [
    "stripe_checkout_sessions", // may not exist
  ];

  for (const t of order) {
    await delAll(t);
  }

  for (const t of optional) {
    const { error } = await sb.from(t).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error && !error.message.includes("schema cache") && !error.message.includes("does not exist")) {
      console.log(`  optional ${t}:`, error.message);
    } else if (!error) {
      console.log(`  deleted optional ${t}`);
    }
  }

  console.log("\n=== After cleanup ===");
  await inventory();
}

await inventory();
if (execute) {
  await cleanup();
} else {
  console.log("\nDry-run only. Re-run with --execute to delete.");
}
