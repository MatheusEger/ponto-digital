// app/admin/registros/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatInTz } from '@/lib/timezone';
import { EVENT_TYPES } from '@/lib/validation';

type Record = {
  id: string;
  employee_id: string;
  employee_name: string | null;
  employee_email: string | null;
  event_type: string;
  timestamp: string;
  ip: string;
  user_agent: string;
  device_hash: string;
  anexo_justificativa?: string | null;
  observacao?: string | null;
  horario_editado?: number;
};

type Employee = { id: string; name: string };

export default function RegistrosPage() {
  const [records, setRecords] = useState<Record[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filter, setFilter] = useState({ employeeId: '', eventType: '', from: '', to: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/employees')
      .then((r) => r.json())
      .then((d) => d.success && setEmployees(d.employees.map((e: Employee) => ({ id: e.id, name: e.name }))));
  }, []);

  async function load(p = page) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (filter.employeeId) params.set('employeeId', filter.employeeId);
      if (filter.eventType) params.set('eventType', filter.eventType);
      if (filter.from) params.set('from', filter.from + 'T00:00:00.000Z');
      if (filter.to) params.set('to', filter.to + 'T23:59:59.999Z');
      const res = await fetch(`/api/records?${params}`);
      const data = await res.json();
      if (data.success) {
        setRecords(data.records);
        setTotal(data.total);
        setPage(p);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1);
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / 50));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Registros</h1>
        <Button 
          onClick={() => window.open('/api/admin/relatorios/excel', '_blank')}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          📊 Baixar Excel Completo
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-4">
            <Select value={filter.employeeId} onChange={(e) => setFilter({ ...filter, employeeId: e.target.value })}>
              <option value="">Todos funcionários</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
            <Select value={filter.eventType} onChange={(e) => setFilter({ ...filter, eventType: e.target.value })}>
              <option value="">Todos eventos</option>
              {EVENT_TYPES.map((ev) => (
                <option key={ev} value={ev}>
                  {ev}
                </option>
              ))}
            </Select>
            <Input type="date" value={filter.from} onChange={(e) => setFilter({ ...filter, from: e.target.value })} />
            <Input type="date" value={filter.to} onChange={(e) => setFilter({ ...filter, to: e.target.value })} />
          </div>
          <Button onClick={() => load(1)}>Filtrar</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-slate-600">Carregando...</p>
          ) : records.length === 0 ? (
            <p className="p-6 text-sm text-slate-600">Nenhum registro.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="p-3">Data/Hora</th>
                    <th className="p-3">Funcionário</th>
                    <th className="p-3">Evento</th>
                    <th className="p-3">Observação</th>
                    <th className="p-3">Anexo</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-t border-slate-200">
                      <td className="p-3 whitespace-nowrap">{formatInTz(r.timestamp)}</td>
                      <td className="p-3 font-medium">{r.employee_name ?? '(desconhecido)'}</td>
                      <td className="p-3">
                        <Badge tone={['ATESTADO', 'ATRASO', 'FALTA'].includes(r.event_type) ? 'warning' : 'info'}>
                          {r.event_type.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="p-3 text-slate-600 max-w-[200px] truncate" title={r.observacao || ''}>
                        {r.observacao || '-'}
                      </td>
                      <td className="p-3">
                        {r.anexo_justificativa ? (
                          <a href={r.anexo_justificativa} target="_blank" className="text-blue-600 font-bold hover:underline">
                            📎 Ver
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="p-3">
                        {r.horario_editado === 1 ? (
                          <Badge tone="neutral">Editado</Badge>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between border-t border-slate-200 p-3 text-sm">
                <span>
                  Página {page} de {totalPages} ({total} registros)
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => load(page - 1)}>
                    Anterior
                  </Button>
                  <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => load(page + 1)}>
                    Próxima
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}