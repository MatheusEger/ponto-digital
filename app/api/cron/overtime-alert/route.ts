// app/api/cron/overtime-alert/route.ts
import { getEmployeesWithOpenShift, sendOvertimeAlertEmails } from '@/lib/overtimeAlert';
import { jsonError, jsonOk } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret) return jsonError('CONFIG', 'CRON_SECRET ausente', 500);
  if (auth !== `Bearer ${secret}`) return jsonError('UNAUTHORIZED', 'Token inválido', 401);

  const employees = await getEmployeesWithOpenShift();
  if (employees.length === 0) {
    return jsonOk({ skipped: true, reason: 'NO_OPEN_SHIFTS' });
  }

  const sent = await sendOvertimeAlertEmails(employees);
  return jsonOk({ sent, totalOpen: employees.length });
}

export async function GET(req: Request) {
  return POST(req);
}
