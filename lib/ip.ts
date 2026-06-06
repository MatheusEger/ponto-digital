// lib/ip.ts
import { headers } from 'next/headers';

export function getClientIp(): string {
  const h = headers();
  const xff = h.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return h.get('x-real-ip') ?? 'unknown';
}

export function getUserAgent(): string {
  return headers().get('user-agent') ?? 'unknown';
}
