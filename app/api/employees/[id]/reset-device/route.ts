// app/api/employees/[id]/reset-device/route.ts
import { requireAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { invalidateCaches } from '@/lib/queries';
import { enqueueWrite } from '@/lib/writeQueue';
import { getClientIp } from '@/lib/ip';
import { jsonError, jsonOk, newId } from '@/lib/utils';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
  } catch {
    return jsonError('UNAUTHORIZED', 'Sessão inválida', 401);
  }
  const ip = getClientIp();
  await enqueueWrite(async () => {
    const db = getDb();
    await db.batch(
      [
        {
          sql: "UPDATE employees SET device_hash = NULL, updated_at = datetime('now') WHERE id = ?",
          args: [params.id]
        },
        {
          sql: 'INSERT INTO audit_log (id, action, payload, actor, ip) VALUES (?, ?, ?, ?, ?)',
          args: [newId('aud'), 'DEVICE_RESET', JSON.stringify({ employeeId: params.id }), 'admin', ip]
        }
      ],
      'write'
    );
    invalidateCaches();
  });
  return jsonOk({});
}
