// app/api/ponto/route.ts
import { pontoSchema, type EventType } from '@/lib/validation';
import { getSessionCookie, verifySessionJwt } from '@/lib/auth';
import { getEmployeeById } from '@/lib/queries';
import { getDb } from '@/lib/db';
import { enqueueWrite } from '@/lib/writeQueue';
import { getClientIp, getUserAgent } from '@/lib/ip';
import { jsonError, jsonOk, newId } from '@/lib/utils';
import { dayRangeUtc, currentDateInTz, currentHhMmInTz, nowUtcIso } from '@/lib/timezone';

const DEDUP_WINDOW_SECONDS = 60;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('INVALID_JSON', 'Corpo inválido', 400);
  }
  const parsed = pontoSchema.safeParse(body);
  if (!parsed.success) return jsonError('INVALID_INPUT', 'Dados inválidos', 400);

  const { eventType, deviceHash, exitNote } = parsed.data;

  const isExitEvent = eventType === 'SAIDA' || eventType === 'SAIDA_EXTRA';
  if (isExitEvent && (!exitNote || exitNote.trim().length < 2)) {
    return jsonError('EXIT_NOTE_REQUIRED', 'Informe uma observação de saída (mínimo 2 caracteres).', 400);
  }

  const token = getSessionCookie();
  if (!token) return jsonError('NO_SESSION', 'Sessão ausente. Faça primeiro acesso.', 401);
  const payload = await verifySessionJwt(token);
  if (!payload) return jsonError('INVALID_SESSION', 'Sessão inválida.', 401);

  const emp = await getEmployeeById(payload.sub);
  if (!emp || !emp.active) return jsonError('NOT_FOUND', 'Funcionário não encontrado.', 404);

  const ip = getClientIp();
  const userAgent = getUserAgent();
  const id = newId('rec');

  try {
    const record = await enqueueWrite(async () => {
      const db = getDb();
      const today = currentDateInTz();
      const { start, end } = dayRangeUtc(today);

      const dayRecs = await db.execute({
        sql: `SELECT event_type, timestamp FROM time_records
              WHERE employee_id = ?
                AND timestamp >= ? AND timestamp < ?
              ORDER BY timestamp ASC`,
        args: [emp.id, start, end]
      });
      const events = dayRecs.rows.map((r) => ({
        event_type: r.event_type as EventType,
        timestamp: r.timestamp as string
      }));

      const lastSame = events.filter((e) => e.event_type === eventType).pop();
      if (lastSame) {
        const diffSec = (Date.now() - new Date(lastSame.timestamp).getTime()) / 1000;
        if (diffSec < DEDUP_WINDOW_SECONDS) {
          throw new Error('DUP');
        }
      }

      const entradaCount = events.filter((e) => e.event_type === 'ENTRADA').length;
      const saidaCount = events.filter((e) => e.event_type === 'SAIDA').length;
      const hasEntrada = entradaCount > 0;
      const hasSaida = saidaCount > 0;
      const reopened = entradaCount > saidaCount;
      const hasEntradaExtra = events.some((e) => e.event_type === 'ENTRADA_EXTRA');
      const hasSaidaExtra = events.some((e) => e.event_type === 'SAIDA_EXTRA');

      if (eventType === 'ENTRADA' && hasEntrada) {
        if (hasSaida) {
          const firstEntrada = events.find((e) => e.event_type === 'ENTRADA');
          const lastSaida = [...events].reverse().find((e) => e.event_type === 'SAIDA');
          if (firstEntrada && lastSaida) {
            const workedMs = new Date(lastSaida.timestamp).getTime() - new Date(firstEntrada.timestamp).getTime();
            const workedMin = Math.round(workedMs / 60000);
            const nowHhMm = currentHhMmInTz();
            const nowMin = parseInt(nowHhMm.split(':')[0]) * 60 + parseInt(nowHhMm.split(':')[1]);
            const canReopen = workedMin < 3 || (workedMin < 480 && nowMin < 18 * 60);
            if (!canReopen) throw new Error('ENTRADA_EXISTS');
          }
        } else {
          throw new Error('ENTRADA_EXISTS');
        }
      }
      if (eventType === 'SAIDA' && !hasEntrada) throw new Error('NO_ENTRADA');
      if (eventType === 'SAIDA' && hasSaida && !reopened) throw new Error('SAIDA_EXISTS');

      if (eventType === 'ENTRADA_EXTRA') {
        if (!hasEntrada || !hasSaida) throw new Error('NO_SAIDA_FOR_EXTRA');
        if (hasEntradaExtra && !hasSaidaExtra) throw new Error('EXTRA_ALREADY_OPEN');
        if (hasEntradaExtra && hasSaidaExtra) throw new Error('EXTRA_ALREADY_DONE');
      }
      if (eventType === 'SAIDA_EXTRA') {
        if (!hasEntradaExtra) throw new Error('NO_ENTRADA_EXTRA');
        if (hasSaidaExtra) throw new Error('SAIDA_EXTRA_EXISTS');
      }

      if (eventType === 'FIM_PAUSA_ALMOCO' && !events.some((e) => e.event_type === 'INICIO_PAUSA_ALMOCO')) {
        throw new Error('UNPAIRED_PAUSE');
      }
      if (eventType === 'FIM_PAUSA_JANTA' && !events.some((e) => e.event_type === 'INICIO_PAUSA_JANTA')) {
        throw new Error('UNPAIRED_PAUSE');
      }
      if (
        (eventType === 'INICIO_PAUSA_ALMOCO' && events.some((e) => e.event_type === 'INICIO_PAUSA_ALMOCO')) ||
        (eventType === 'INICIO_PAUSA_JANTA' && events.some((e) => e.event_type === 'INICIO_PAUSA_JANTA')) ||
        (eventType === 'FIM_PAUSA_ALMOCO' && events.some((e) => e.event_type === 'FIM_PAUSA_ALMOCO')) ||
        (eventType === 'FIM_PAUSA_JANTA' && events.some((e) => e.event_type === 'FIM_PAUSA_JANTA'))
      ) {
        throw new Error('EVENT_EXISTS');
      }

      const ts = nowUtcIso();
      await db.execute({
        sql: `INSERT INTO time_records (id, employee_id, event_type, timestamp, ip, user_agent, device_hash)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [id, emp.id, eventType, ts, ip, userAgent, deviceHash]
      });
      return {
        id,
        eventType,
        timestamp: ts,
        displayTime: (() => {
          const d = new Date(ts);
          const dateParts = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(d);
          const day = dateParts.find(p => p.type === 'day')!.value;
          const month = dateParts.find(p => p.type === 'month')!.value;
          const year = dateParts.find(p => p.type === 'year')!.value;
          const timeParts = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
          const hour = timeParts.find(p => p.type === 'hour')!.value;
          const minute = timeParts.find(p => p.type === 'minute')!.value;
          return `${day}/${month}/${year}, às ${hour}:${minute}`;
        })(),
        ip
      };
    });
    if (isExitEvent && exitNote) {
      const noteId = newId('note');
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const db = getDb();
      db.execute({
        sql: `INSERT INTO exit_notes (id, employee_id, note, expires_at) VALUES (?, ?, ?, ?)`,
        args: [noteId, emp.id, exitNote.trim(), expiresAt]
      }).catch(() => {});
    }

    return jsonOk({ record });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'DB_ERROR';
    const map: Record<string, [string, number]> = {
      DUP: ['Aguarde antes de registrar novamente.', 429],
      ENTRADA_EXISTS: ['Já existe uma ENTRADA hoje.', 409],
      NO_ENTRADA: ['Você precisa registrar ENTRADA antes da SAÍDA.', 409],
      SAIDA_EXISTS: ['Já existe uma SAÍDA hoje.', 409],
      UNPAIRED_PAUSE: ['Pausa sem início correspondente.', 409],
      EVENT_EXISTS: ['Este evento já foi registrado hoje.', 409],
      NO_SAIDA_FOR_EXTRA: ['Registre a SAÍDA normal antes de iniciar período extra.', 409],
      EXTRA_ALREADY_OPEN: ['Já existe um período extra aberto. Registre a saída extra primeiro.', 409],
      EXTRA_ALREADY_DONE: ['O período extra de hoje já foi encerrado.', 409],
      NO_ENTRADA_EXTRA: ['Não há período extra aberto para encerrar.', 409],
      SAIDA_EXTRA_EXISTS: ['O período extra já foi encerrado hoje.', 409]
    };
    const known = map[code];
    if (known) return jsonError(code, known[0], known[1]);
    return jsonError('DB_ERROR', 'Erro ao registrar ponto.', 500);
  }
}
