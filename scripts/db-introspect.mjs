// List existing public tables and their columns (read-only).
import pg from "pg";

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000
});

await client.connect();
try {
  const t = await client.query(
    `select table_name from information_schema.tables
     where table_schema = 'public' order by table_name`
  );
  if (t.rows.length === 0) {
    console.log("public schema: (no tables yet)");
  } else {
    for (const { table_name } of t.rows) {
      const c = await client.query(
        `select column_name, data_type from information_schema.columns
         where table_schema='public' and table_name=$1 order by ordinal_position`,
        [table_name]
      );
      console.log(`\n• ${table_name}`);
      for (const col of c.rows) console.log(`    ${col.column_name} :: ${col.data_type}`);
    }
  }
} finally {
  await client.end().catch(() => {});
}
