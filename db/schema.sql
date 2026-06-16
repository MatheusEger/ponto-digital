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

-- Tabela de configurações atualizada com a Jornada de Trabalho Padrão
CREATE TABLE IF NOT EXISTS admin_config (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  password_hash TEXT NOT NULL,
  admin_email TEXT NOT NULL,
  reply_to_email TEXT NOT NULL DEFAULT '',
  report_schedule TEXT NOT NULL DEFAULT '23:00',
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  
  -- HORÁRIOS PADRÃO DO ESCRITÓRIO
  entrada_manha TEXT DEFAULT '07:30',
  saida_almoco TEXT DEFAULT '11:48',
  retorno_almoco TEXT DEFAULT '13:30',
  saida_tarde TEXT DEFAULT '18:00',
  trabalha_sabado INTEGER DEFAULT 0,
  trabalha_domingo INTEGER DEFAULT 0,
  
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

-- Tabela para guardar os atrasos que exigem justificativa do funcionário (Tolerância de 5 min)
CREATE TABLE IF NOT EXISTS pending_acknowledgments (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  type TEXT NOT NULL, -- Ex: 'ATRASO_ENTRADA', 'ATRASO_ALMOCO'
  minutes_late INTEGER NOT NULL,
  status TEXT DEFAULT 'PENDING', -- 'PENDING', 'ACKNOWLEDGED' (Ciente) ou 'JUSTIFIED' (Justificado)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pending_emp ON pending_acknowledgments(employee_id, status);

-- Tabela unificada de Auditoria (para logs de sistema e edições de ponto)
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,       -- Quem fez a ação (ex: admin_id ou 'SYSTEM')
  action TEXT NOT NULL,      -- 'EDIT_RECORD', 'DELETE_RECORD', 'LOGIN', etc.
  record_id TEXT,            -- ID do registro alterado (se aplicável)
  payload TEXT,              -- Detalhes adicionais / Descrição da ação
  old_value TEXT,            -- Valor antes da edição
  new_value TEXT,            -- Valor depois da edição
  ip TEXT NOT NULL DEFAULT '0.0.0.0',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);