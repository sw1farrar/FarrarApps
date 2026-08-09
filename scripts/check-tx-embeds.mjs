import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const r = await sb
  .from("transactions")
  .select(
    "id, type, amount, projects(id, name), invoices(id, invoice_number), customers(id, name)"
  )
  .limit(3);

console.log("error:", r.error?.message ?? null);
console.log(JSON.stringify(r.data, null, 2));
