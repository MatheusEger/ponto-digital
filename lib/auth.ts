// lib/auth.ts
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

const ADMIN_COOKIE = 'pd_admin';
const SESSION_COOKIE = 'pd_session';

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 chars');
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export type AdminPayload = { role: 'admin'; iat: number };
export type SessionPayload = { sub: string; dh: string; iat: number };

export async function signAdminJwt(): Promise<string> {
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(getSecret());
}

export async function verifyAdminJwt(token: string): Promise<AdminPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.role !== 'admin') return null;
    return payload as unknown as AdminPayload;
  } catch {
    return null;
  }
}

export async function signSessionJwt(sub: string, dh: string): Promise<string> {
  return new SignJWT({ sub, dh })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecret());
}

export async function verifySessionJwt(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.sub !== 'string' || typeof payload.dh !== 'string') return null;
    return { sub: payload.sub, dh: payload.dh, iat: payload.iat ?? 0 };
  } catch {
    return null;
  }
}

export function setAdminCookie(token: string): void {
  cookies().set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8
  });
}

export function clearAdminCookie(): void {
  cookies().delete(ADMIN_COOKIE);
}

export function getAdminCookie(): string | undefined {
  return cookies().get(ADMIN_COOKIE)?.value;
}

export function setSessionCookie(token: string): void {
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30
  });
}

export function getSessionCookie(): string | undefined {
  return cookies().get(SESSION_COOKIE)?.value;
}

export function clearSessionCookie(): void {
  cookies().delete(SESSION_COOKIE);
}

export async function requireAdmin(): Promise<AdminPayload> {
  const token = getAdminCookie();
  if (!token) throw new Error('UNAUTHORIZED');
  const payload = await verifyAdminJwt(token);
  if (!payload) throw new Error('UNAUTHORIZED');
  return payload;
}

export { ADMIN_COOKIE, SESSION_COOKIE };
