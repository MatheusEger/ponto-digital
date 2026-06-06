// app/api/config/route.ts
import { requireAdmin } from '@/lib/auth';
import { configSchema } from '@/lib/validation';
import { getDb } from '@/lib/db';
import { getAdminConfig, invalidateCaches } from '@/lib/queries';
import { enqueueWrite } from '@/lib/writeQueue';
import { jsonError, jsonOk } from '@/lib/utils';

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return jsonError('UNAUTHORIZED', 'Sessão inválida', 401);
  }
  const c = await getAdminConfig();
  return jsonOk({
    config: {
      adminEmail: c.admin_email,
      replyToEmail: c.reply_to_email,
      reportSchedule: c.report_schedule,
      timezone: c.timezone,
      lastReportSentAt: c.last_report_sent_at
    }
  });
}

export async function PUT(req: Request) {
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
  const parsed = configSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? 'Dados inválidos';
    return jsonError('INVALID_INPUT', msg, 400);
  }

  await enqueueWrite(async () => {
    const db = getDb();
    await db.execute({
      sql: `UPDATE admin_config SET admin_email = ?, reply_to_email = ?, report_schedule = ?, timezone = ?, updated_at = datetime('now') WHERE id = 'singleton'`,
      args: [parsed.data.adminEmail, parsed.data.replyToEmail, parsed.data.reportSchedule, parsed.data.timezone]
    });
    invalidateCaches();
  });
  return jsonOk({});
}
