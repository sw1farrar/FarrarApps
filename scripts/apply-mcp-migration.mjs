import { readFileSync } from "fs";
import pg from "pg";

function loadEnv(path) {
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const env = loadEnv(".env.local");
const sql = readFileSync(
  "supabase/migrations/20260912010000_mcp_api_keys.sql",
  "utf8"
);
const client = new pg.Client({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
try {
  await client.query(sql);
  console.log("OK: mcp_access_tokens and mcp_oauth_jtis migration applied");
} catch (e) {
  console.error(e.message || e);
  process.exit(1);
} finally {
  await client.end();
}
