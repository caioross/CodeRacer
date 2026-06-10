// Quick connectivity check for the Supabase Postgres (uses DATABASE_URL from env).
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("no DATABASE_URL in env");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000
});

try {
  await client.connect();
  const r = await client.query("select current_database() as db, version() as version");
  console.log("CONNECTED", JSON.stringify(r.rows[0]));
} catch (e) {
  console.error("FAIL", e.code || "", e.message);
  process.exitCode = 2;
} finally {
  await client.end().catch(() => {});
}
