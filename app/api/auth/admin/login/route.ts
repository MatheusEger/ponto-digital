// app/api/auth/admin/login/route.ts
import { NextResponse } from 'next/server';
import { adminLoginSchema } from '@/lib/validation';
import { getAdminConfig } from '@/lib/queries';
import { verifyPassword, signAdminJwt } from '@/lib/auth';
import { jsonError } from '@/lib/utils';

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('INVALID_JSON', 'Corpo inválido', 400);
  }
  const parsed = adminLoginSchema.safeParse(body);
  if (!parsed.success) return jsonError('INVALID_INPUT', 'Dados inválidos', 400);

  const config = await getAdminConfig();
  const ok = await verifyPassword(parsed.data.password, config.password_hash);
  if (!ok) return jsonError('INVALID_CREDENTIALS', 'Credenciais inválidas', 401);

  const token = await signAdminJwt();
  const res = NextResponse.json({ success: true });
  res.cookies.set('pd_admin', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8
  });
  return res;
}
