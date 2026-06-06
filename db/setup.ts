// db/setup.ts
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();
import { createClient } from '@libsql/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import bcrypt from 'bcryptjs';

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) throw new Error('TURSO_DATABASE_URL is required');

  const db = createClient({ url, authToken });

  const schemaRaw = readFileSync(join(process.cwd(), 'db', 'schema.sql'), 'utf8');
  const schema = schemaRaw
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  const statements = schema
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    await db.execute(stmt);
  }
  console.log(`[db:setup] Applied ${statements.length} SQL statements.`);

  const existing = await db.execute("SELECT id FROM admin_config WHERE id = 'singleton'");
  if (existing.rows.length === 0) {
    const passwordHash = await bcrypt.hash('admin123', 12);
    const adminEmail = process.env.GMAIL_USER ?? 'admin@example.com';
    await db.execute({
      sql: `INSERT INTO admin_config (id, password_hash, admin_email, report_schedule, timezone)
            VALUES ('singleton', ?, ?, '23:00', 'America/Sao_Paulo')`,
      args: [passwordHash, adminEmail]
    });
    console.log('[db:setup] Seeded admin_config with default password "admin123".');
    console.log('[db:setup] CHANGE THE PASSWORD AFTER FIRST LOGIN.');
  } else {
    console.log('[db:setup] admin_config already exists; skipping seed.');
  }

  console.log('[db:setup] Done.');
}

main().catch((err) => {
  console.error('[db:setup] Error:', err);
  process.exit(1);
});
