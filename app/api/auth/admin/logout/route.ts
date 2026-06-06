// app/api/auth/admin/logout/route.ts
import { clearAdminCookie, requireAdmin } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/utils';

export async function POST() {
  try {
    await requireAdmin();
  } catch {
    return jsonError('UNAUTHORIZED', 'Sessão inválida', 401);
  }
  clearAdminCookie();
  return jsonOk({});
}
