// app/api/auth/me/route.ts
import { getSessionCookie, verifySessionJwt } from '@/lib/auth';
import { getEmployeeById } from '@/lib/queries';
import { jsonError, jsonOk } from '@/lib/utils';

export async function GET() {
  const token = getSessionCookie();
  if (!token) return jsonError('NO_SESSION', 'Sem sessão', 401);
  const payload = await verifySessionJwt(token);
  if (!payload) return jsonError('INVALID_SESSION', 'Sessão inválida', 401);
  const emp = await getEmployeeById(payload.sub);
  if (!emp || !emp.active) return jsonError('NOT_FOUND', 'Funcionário não encontrado', 404);
  if (!emp.device_hash) return jsonError('DEVICE_RESET', 'Dispositivo resetado pelo administrador', 403);
  return jsonOk({ employee: { id: emp.id, name: emp.name, email: emp.email } });
}
