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

console.log("=== Env (presence only) ===");
console.log({
  BREVO_API_KEY: process.env.BREVO_API_KEY ? `set (${process.env.BREVO_API_KEY.slice(0, 12)}…)` : "MISSING",
  BREVO_SENDER_EMAIL: process.env.BREVO_SENDER_EMAIL || "MISSING",
  BREVO_SENDER_NAME: process.env.BREVO_SENDER_NAME || "MISSING",
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "MISSING",
});

const { data: invoices, error: invErr } = await sb
  .from("invoices")
  .select(
    "id, invoice_number, status, total, customer_id, created_at, customers(id, name, email)"
  )
  .order("created_at", { ascending: false })
  .limit(5);

console.log("\n=== Recent invoices ===");
if (invErr) console.log("error:", invErr.message);
for (const inv of invoices ?? []) {
  const c = inv.customers;
  console.log({
    number: inv.invoice_number,
    status: inv.status,
    total: inv.total,
    created: inv.created_at,
    customer: c?.name,
    customerEmail: c?.email || "(none)",
  });
}

const { data: activity } = await sb
  .from("activity_logs")
  .select("action, entity_type, entity_id, meta, created_at")
  .eq("entity_type", "invoice")
  .order("created_at", { ascending: false })
  .limit(15);

console.log("\n=== Recent invoice activity ===");
for (const a of activity ?? []) {
  console.log(a.created_at, a.action, JSON.stringify(a.meta));
}

const { data: links } = await sb
  .from("invoice_payment_links")
  .select("id, invoice_id, created_at, revoked_at")
  .order("created_at", { ascending: false })
  .limit(5);
console.log("\n=== Payment links ===", links?.length ?? 0, links);

// Test Brevo account without sending if possible
const apiKey = process.env.BREVO_API_KEY;
if (apiKey) {
  console.log("\n=== Brevo account check ===");
  const acc = await fetch("https://api.brevo.com/v3/account", {
    headers: { accept: "application/json", "api-key": apiKey },
  });
  const accText = await acc.text();
  console.log("status", acc.status);
  console.log(accText.slice(0, 800));

  console.log("\n=== Brevo senders ===");
  const senders = await fetch("https://api.brevo.com/v3/senders", {
    headers: { accept: "application/json", "api-key": apiKey },
  });
  console.log("status", senders.status);
  console.log((await senders.text()).slice(0, 1200));
}
