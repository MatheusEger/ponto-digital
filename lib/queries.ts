// lib/queries.ts
import { getDb } from './db';
import { cacheGet, cacheSet, cacheInvalidateAll, CACHE_TTL } from './cache';

export type EmployeeRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
  active: number;
  device_hash: string | null;
  created_at: string;
  updated_at: string;
};

export type TimeRecordRow = {
  id: string;
  employee_id: string;
  event_type: string;
  timestamp: string;
  ip: string;
  user_agent: string;
  device_hash: string;
};

export type AdminConfigRow = {
  id: string;
  password_hash: string;
  admin_email: string;
  reply_to_email: string;
  report_schedule: string;
  timezone: string;
  last_report_sent_at: string | null;
  updated_at: string;
};

export async function getAdminConfig(): Promise<AdminConfigRow> {
  const cached = cacheGet<AdminConfigRow>('admin_config');
  if (cached) return cached;
  const db = getDb();
  const r = await db.execute("SELECT * FROM admin_config WHERE id = 'singleton'");
  if (r.rows.length === 0) throw new Error('admin_config not initialized');
  const row = r.rows[0] as unknown as AdminConfigRow;
  cacheSet('admin_config', row, CACHE_TTL.ADMIN_CONFIG);
  return row;
}

export async function listEmployees(opts?: { activeOnly?: boolean }): Promise<EmployeeRow[]> {
  const key = `employees:${opts?.activeOnly ? 'active' : 'all'}`;
  const cached = cacheGet<EmployeeRow[]>(key);
  if (cached) return cached;
  const db = getDb();
  const sql = opts?.activeOnly
    ? 'SELECT * FROM employees WHERE active = 1 ORDER BY name'
    : 'SELECT * FROM employees ORDER BY name';
  const r = await db.execute(sql);
  const rows = r.rows as unknown as EmployeeRow[];
  cacheSet(key, rows, CACHE_TTL.EMPLOYEES);
  return rows;
}

export async function getEmployeeByEmail(email: string): Promise<EmployeeRow | null> {
  const db = getDb();
  const r = await db.execute({ sql: 'SELECT * FROM employees WHERE email = ?', args: [email] });
  return (r.rows[0] as unknown as EmployeeRow) ?? null;
}

export async function getEmployeeById(id: string): Promise<EmployeeRow | null> {
  const db = getDb();
  const r = await db.execute({ sql: 'SELECT * FROM employees WHERE id = ?', args: [id] });
  return (r.rows[0] as unknown as EmployeeRow) ?? null;
}

export async function getEmployeeByDeviceHash(deviceHash: string): Promise<EmployeeRow | null> {
  const db = getDb();
  const r = await db.execute({
    sql: 'SELECT * FROM employees WHERE device_hash = ?',
    args: [deviceHash]
  });
  return (r.rows[0] as unknown as EmployeeRow) ?? null;
}

export function invalidateCaches(): void {
  cacheInvalidateAll();
}
