// Apply every .sql file in supabase/migrations (sorted) to DATABASE_URL.
// Migrations are written idempotently (IF NOT EXISTS / OR REPLACE).
import nextEnv from "@next/env";
import pg from "pg";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

nextEnv.loadEnvConfig(process.cwd()); // load .env.local → process.env

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Missing DATABASE_URL (export it from .env.local).");
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const migDir = join(here, "..", "supabase", "migrations");
const files = readdirSync(migDir).filter(f => f.endsWith(".sql")).sort();

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000
});

await client.connect();
try {
  for (const f of files) {
    process.stdout.write(`applying ${f} ... `);
    await client.query(readFileSync(join(migDir, f), "utf8"));
    console.log("ok");
  }
  const t = await client.query(
    `select table_name from information_schema.tables
     where table_schema='public' order by table_name`
  );
  console.log("public tables now:", t.rows.map(r => r.table_name).join(", ") || "(none)");
} catch (e) {
  console.error("\nMIGRATION FAILED:", e.message);
  process.exitCode = 2;
} finally {
  await client.end().catch(() => {});
}
