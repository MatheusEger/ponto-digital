-- db/schema.sql
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  device_hash TEXT UNIQUE,
  pin_ponto TEXT,          -- COLUNA NOVA ADICIONADA
  senha_web_hash TEXT,     -- COLUNA NOVA ADICIONADA
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(active);

CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(active);

CREATE TABLE IF NOT EXISTS time_records (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'ENTRADA','INICIO_PAUSA_ALMOCO','FIM_PAUSA_ALMOCO',
    'INICIO_PAUSA_JANTA','FIM_PAUSA_JANTA','SAIDA',
    'ENTRADA_EXTRA','SAIDA_EXTRA', 
    'ATESTADO', 'DECLARACAO', 'ATRASO', 'FALTA'
  )),
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  ip TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  device_hash TEXT NOT NULL,
  anexo_justificativa TEXT,
  horario_editado INTEGER NOT NULL DEFAULT 0,
  observacao TEXT
);

CREATE INDEX IF NOT EXISTS idx_records_employee_time ON time_records(employee_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_records_time ON time_records(timestamp);

CREATE TABLE IF NOT EXISTS admin_config (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  password_hash TEXT NOT NULL,
  admin_email TEXT NOT NULL,
  reply_to_email TEXT NOT NULL DEFAULT '',
  report_schedule TEXT NOT NULL DEFAULT '23:00',
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  last_report_sent_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS device_link_codes (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  pending_device_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS exit_notes (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_exit_notes_expires ON exit_notes(expires_at);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  payload TEXT NOT NULL,
  actor TEXT NOT NULL,
  ip TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
