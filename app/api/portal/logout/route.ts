// app/api/portal/logout/route.ts
import { cookies } from 'next/headers';
import { jsonOk } from '@/lib/utils';

export async function POST() {
  // Apaga o cookie de sessão do portal
  cookies().delete('portal_token');
  return jsonOk({ success: true });
}