// lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function newId(prefix: string): string {
  const uuid = globalThis.crypto.randomUUID();
  return `${prefix}_${uuid.replace(/-/g, '').slice(0, 16)}`;
}

export function jsonError(code: string, message: string, status = 400, extra?: Record<string, unknown>) {
  return new Response(JSON.stringify({ success: false, error: code, message, ...extra }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

export function jsonOk<T extends object>(data: T, status = 200) {
  return new Response(JSON.stringify({ success: true, ...data }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}
