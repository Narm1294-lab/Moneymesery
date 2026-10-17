import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";

const connectionString = process.env.SUPABASE_DB_URL;

if (!connectionString) {
  throw new Error("SUPABASE_DB_URL is required to apply the Supabase schema.");
}

const schemaPath = fileURLToPath(new URL("./supabase-core-schema.sql", import.meta.url));
const schema = await readFile(schemaPath, "utf8");
const pool = new pg.Pool({ connectionString, max: 1 });

try {
  await pool.query(schema);
  process.stdout.write("Supabase core schema applied successfully.\n");
} catch (error) {
  const rawMessage = error instanceof Error ? error.message : "Unknown database error";
  const safeMessage = rawMessage
    .replaceAll(connectionString, "[redacted]")
    .replace(/\/\/[^/\s:@]+:[^@\s]+@/g, "//[redacted]@")
    .slice(0, 240);
  const code =
    error && typeof error === "object" && "code" in error
      ? ` (${String(error.code)})`
      : "";
  process.stderr.write(
    `Could not apply the Supabase schema${code}: ${safeMessage}\n`,
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}