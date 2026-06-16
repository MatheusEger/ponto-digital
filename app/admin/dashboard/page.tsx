// app/admin/dashboard/page.tsx
import { getDb } from '@/lib/db';
import { listEmployees } from '@/lib/queries';
import { currentDateInTz } from '@/lib/timezone';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SendReportButton } from '@/components/SendReportButton';
import { computeDailyRows, getAllRecordsBetween } from '@/lib/dailyReport';
import { computeBancoHoras, type BancoHorasEntry } from '@/lib/bancoHoras';

export const dynamic = 'force-dynamic';

async function getKpis() {
  const employees = await listEmployees();
  const activeCount = employees.filter((e) => e.active === 1).length;
  const today = currentDateInTz();
  const startIso = new Date(`${today}T00:00:00.000Z`).toISOString();
  const endDate = new Date(`${today}T00:00:00.000Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  const records = await getAllRecordsBetween(startIso, endDate.toISOString());
  const rows = computeDailyRows(employees, records);
  const anomalies = rows.reduce((acc, r) => acc + (r.anomalies.length > 0 ? 1 : 0), 0);

  const db = getDb();
  const audit = await db.execute({
    sql: "SELECT COUNT(*) AS c FROM audit_logs WHERE action = 'DEVICE_RESET' AND date(created_at) >= date('now', '-7 days')",
    args: []
  });
  const deviceResetsLast7d = Number((audit.rows[0] as unknown as { c: number }).c);

  const bancoHoras = await computeBancoHoras(employees);

  return {
    activeCount,
    totalEmployees: employees.length,
    todayRecords: records.length,
    anomalies,
    deviceResetsLast7d,
    bancoHoras
  };
}

function BancoHorasTable({ data }: { data: BancoHorasEntry[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-500">Nenhum funcionário ativo com registros.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="px-4 py-3 font-medium">Funcionário</th>
            <th className="px-4 py-3 font-medium">Dias trabalhados</th>
            <th className="px-4 py-3 font-medium">Horas trabalhadas</th>
            <th className="px-4 py-3 font-medium">Horas esperadas</th>
            <th className="px-4 py-3 font-medium">Saldo</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((entry) => (
            <tr key={entry.employee.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <div className="font-medium text-slate-900">{entry.employee.name}</div>
                <div className="text-xs text-slate-500">{entry.employee.email}</div>
              </td>
              <td className="px-4 py-3 text-slate-700">{entry.daysWorked}</td>
              <td className="px-4 py-3 text-slate-700">
                {Math.floor(entry.totalWorkedMinutes / 60)}h{(entry.totalWorkedMinutes % 60).toString().padStart(2, '0')}min
              </td>
              <td className="px-4 py-3 text-slate-700">
                {Math.floor(entry.expectedMinutes / 60)}h{(entry.expectedMinutes % 60).toString().padStart(2, '0')}min
              </td>
              <td className={`px-4 py-3 font-semibold ${entry.balanceMinutes >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {entry.balanceFormatted}
              </td>
              <td className="px-4 py-3">
                {entry.balanceMinutes >= 480 ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                    Pode folgar 1 dia
                  </span>
                ) : entry.balanceMinutes >= 0 ? (
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                    Crédito
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                    Débito
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function DashboardPage() {
  const kpis = await getKpis();
  const cards = [
    { label: 'Funcionários ativos', value: `${kpis.activeCount} / ${kpis.totalEmployees}` },
    { label: 'Registros hoje', value: String(kpis.todayRecords) },
    { label: 'Anomalias hoje', value: String(kpis.anomalies) },
    { label: 'Resets de dispositivo (7d)', value: String(kpis.deviceResetsLast7d) }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-600">Visão geral do dia.</p>
        </div>
        <SendReportButton />
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-slate-600">{c.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-brand-700">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-xl font-bold text-slate-900">Banco de Horas</h2>
        <p className="mb-4 text-sm text-slate-600">
          Saldo acumulado de cada funcionário. Jornada padrão: 8h/dia (09h às 18h). Crédito ≥ 8h = direito a 1 dia de folga.
        </p>
        <BancoHorasTable data={kpis.bancoHoras} />
      </div>
    </div>
  );
}
