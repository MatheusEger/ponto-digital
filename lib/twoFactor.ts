// lib/twoFactor.ts
import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';

export const CODE_TTL_MINUTES = 10;
export const MAX_ATTEMPTS = 3;

export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export async function hashCode(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

export async function compareCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

export function expiryIso(): string {
  return new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();
}

export function isExpired(expiresAtIso: string): boolean {
  return new Date(expiresAtIso).getTime() < Date.now();
}

export function codeEmailHtml(code: string, appUrl: string): string {
  return `
  <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;background:#ffffff;">
    <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:24px;border-radius:12px 12px 0 0;">
      <h1 style="margin:0;font-size:20px;color:#fff;font-weight:700;"><img src="cid:ponto-digital-icon" width="22" height="22" style="vertical-align:middle;margin-right:8px;" alt="">Ponto Digital</h1>
    </div>
    <div style="padding:24px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
      <p style="margin:0 0 12px;font-size:14px;color:#334155;">Você está vinculando um novo dispositivo à sua conta.</p>
      <p style="margin:0 0 16px;font-size:14px;color:#334155;">Use o código abaixo para confirmar:</p>
      <div style="font-size:32px;font-weight:700;letter-spacing:8px;background:#fff;padding:16px;border-radius:8px;text-align:center;border:1px solid #d9ecff;">${code}</div>
      <p style="color:#64748b;margin-top:16px;font-size:13px;">Este código expira em ${CODE_TTL_MINUTES} minutos. Se você não solicitou, ignore este email.</p>
      <p style="color:#94a3b8;font-size:11px;margin-top:24px;text-align:center;">Gerado automaticamente pelo Ponto Digital · ${appUrl}</p>
    </div>
  </div>`;
}
