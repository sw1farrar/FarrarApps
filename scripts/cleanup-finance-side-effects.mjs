import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const { data: logs } = await sb
  .from("activity_logs")
  .select("id, action, entity_type")
  .in("entity_type", ["invoice", "transaction"]);
console.log("activity invoice/tx:", logs?.length ?? 0);
if (logs?.length) {
  const { data, error } = await sb
    .from("activity_logs")
    .delete()
    .in(
      "id",
      logs.map((l) => l.id)
    )
    .select("id");
  console.log("deleted activity:", error?.message ?? data?.length);
}

const { data: notifs } = await sb
  .from("notifications")
  .select("id, title")
  .or("title.ilike.%Invoice%,title.ilike.%payment%,body.ilike.%Stripe%");
console.log("related notifications:", notifs?.length ?? 0);
if (notifs?.length) {
  const { data, error } = await sb
    .from("notifications")
    .delete()
    .in(
      "id",
      notifs.map((n) => n.id)
    )
    .select("id");
  console.log("deleted notifications:", error?.message ?? data?.length);
}

const { count: inv } = await sb
  .from("invoices")
  .select("id", { count: "exact", head: true });
const { count: tx } = await sb
  .from("transactions")
  .select("id", { count: "exact", head: true });
const { count: pay } = await sb
  .from("stripe_invoice_payments")
  .select("id", { count: "exact", head: true });
const { count: links } = await sb
  .from("invoice_payment_links")
  .select("id", { count: "exact", head: true });
const { count: lines } = await sb
  .from("invoice_line_items")
  .select("id", { count: "exact", head: true });
const { data: accts } = await sb
  .from("accounts")
  .select("name, type, opening_balance");

console.log("\nFinal state:");
console.log({
  invoices: inv,
  invoice_line_items: lines,
  transactions: tx,
  stripe_invoice_payments: pay,
  invoice_payment_links: links,
  accounts: accts,
});
