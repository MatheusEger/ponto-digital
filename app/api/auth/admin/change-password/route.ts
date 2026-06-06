// app/api/auth/admin/change-password/route.ts
import { changePasswordSchema } from '@/lib/validation';
import { getAdminConfig, invalidateCaches } from '@/lib/queries';
import { requireAdmin, verifyPassword, hashPassword } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { enqueueWrite } from '@/lib/writeQueue';
import { jsonError, jsonOk, newId } from '@/lib/utils';
import { getClientIp } from '@/lib/ip';

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return jsonError('UNAUTHORIZED', 'Sessão inválida', 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('INVALID_JSON', 'Corpo inválido', 400);
  }
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? 'Dados inválidos';
    return jsonError('INVALID_INPUT', msg, 400);
  }

  const config = await getAdminConfig();
  const ok = await verifyPassword(parsed.data.current, config.password_hash);
  if (!ok) return jsonError('INVALID_CURRENT', 'Senha atual incorreta', 400);

  const newHash = await hashPassword(parsed.data.next);
  const ip = getClientIp();
  await enqueueWrite(async () => {
    const db = getDb();
    await db.batch(
      [
        {
          sql: "UPDATE admin_config SET password_hash = ?, updated_at = datetime('now') WHERE id = 'singleton'",
          args: [newHash]
        },
        {
          sql: 'INSERT INTO audit_log (id, action, payload, actor, ip) VALUES (?, ?, ?, ?, ?)',
          args: [newId('aud'), 'PASSWORD_CHANGED', JSON.stringify({}), 'admin', ip]
        }
      ],
      'write'
    );
    invalidateCaches();
  });

  return jsonOk({});
}
