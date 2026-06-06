// app/api/banco-horas/route.ts
import { getAdminCookie, verifyAdminJwt } from '@/lib/auth';
import { listEmployees } from '@/lib/queries';
import { computeBancoHoras } from '@/lib/bancoHoras';
import { jsonError, jsonOk } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  const token = getAdminCookie();
  if (!token) return jsonError('UNAUTHORIZED', 'Não autorizado', 401);
  const payload = await verifyAdminJwt(token);
  if (!payload) return jsonError('UNAUTHORIZED', 'Sessão inválida', 401);

  const employees = await listEmployees();
  const bancoHoras = await computeBancoHoras(employees);
  return jsonOk({ bancoHoras });
}
