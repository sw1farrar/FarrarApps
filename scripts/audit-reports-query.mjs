import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { format, startOfMonth } from "date-fns";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  process.env[m[1].trim()] = m[2]
    .trim()
    .replace(/^["']|["']$/g, "");
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const from = format(startOfMonth(new Date()), "yyyy-MM-dd");
const to = format(new Date(), "yyyy-MM-dd");
console.log("Range (local):", from, "→", to);

const broken = await sb
  .from("transactions")
  .select(
    "date, type, amount, categories(id, name), customers(id, name), accounts(id, name)"
  )
  .gte("date", from)
  .lte("date", to);
console.log(
  "\n[BROKEN reports query] error:",
  broken.error?.message ?? "none",
  "| rows:",
  (broken.data || []).length
);

const fixed = await sb
  .from("transactions")
  .select(
    `
    id, date, type, description, amount,
    categories(id, name),
    customers(id, name),
    accounts!transactions_account_id_fkey(id, name),
    transfer_accounts:accounts!transactions_transfer_account_id_fkey(id, name),
    invoices(id, invoice_number)
  `
  )
  .gte("date", from)
  .lte("date", to)
  .order("date", { ascending: true });

console.log(
  "[FIXED reports query] error:",
  fixed.error?.message ?? "none",
  "| rows:",
  (fixed.data || []).length
);

let income = 0;
let expenses = 0;
let transfers = 0;
const byCustomer = new Map();
for (const t of fixed.data || []) {
  const amt = Number(t.amount) || 0;
  if (t.type === "income") {
    income += amt;
    const name = t.customers?.name || "Unassigned";
    byCustomer.set(name, (byCustomer.get(name) || 0) + amt);
  } else if (t.type === "expense") expenses += amt;
  else if (t.type === "transfer") transfers += amt;
}

console.log("\nCash-basis P&L:");
console.log("  Income:   ", income);
console.log("  Expenses: ", expenses);
console.log("  Profit:   ", income - expenses);
console.log("  Transfers (excluded from P&L):", transfers);
console.log("  Income by customer:", Object.fromEntries(byCustomer));

const ar = await sb
  .from("invoices")
  .select("status, total, due_date, customers(name)")
  .in("status", ["sent", "overdue"]);
console.log(
  "\nOpen AR invoices:",
  (ar.data || []).length,
  "total $",
  (ar.data || []).reduce((s, i) => s + Number(i.total), 0)
);

// Date display bug check
const sample = "2026-08-09";
const wrong = new Date(sample);
const right = new Date(`${sample}T00:00:00`);
console.log("\nDate display check for", sample);
console.log("  new Date(iso date):", wrong.toString());
console.log("  local midnight:    ", right.toString());
