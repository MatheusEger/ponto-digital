// lib/pdf.tsx
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import * as path from 'path';
import { formatInTz } from './timezone';

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: 'Helvetica' },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  titleIcon: { width: 22, height: 22, marginRight: 6 },
  titleText: { fontSize: 18, fontWeight: 700, color: '#1d4ed8' },
  sub: { fontSize: 11, marginBottom: 16, color: '#334155' },
  section: { marginTop: 12, marginBottom: 4, fontSize: 12, fontWeight: 700 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#cbd5e1', paddingVertical: 4 },
  headerRow: { backgroundColor: '#eef7ff', fontWeight: 700 },
  cellDate: { width: '20%' },
  cellEvent: { width: '30%' },
  cellIp: { width: '30%' },
  cellDevice: { width: '20%' },
  footer: { marginTop: 32 },
  sigLine: { borderTopWidth: 0.5, borderTopColor: '#000', marginTop: 40, width: '70%', alignSelf: 'center', textAlign: 'center', paddingTop: 4 }
});

export type MonthlyPdfData = {
  employee: { name: string; email: string; phone: string };
  month: string;
  records: Array<{ eventType: string; timestamp: string; ip: string; deviceHash: string }>;
  totalWorkedHours: number;
  anomalies: string[];
};

function MonthlyReport({ data }: { data: MonthlyPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.titleRow}>
          <Image style={styles.titleIcon} src={path.join(process.cwd(), 'public', 'icon.png')} />
          <Text style={styles.titleText}>Ponto Digital — Relatório Mensal</Text>
        </View>
        <Text style={styles.sub}>
          {data.employee.name} ({data.employee.email}) — {data.month.split('-').reverse().join('/')}
        </Text>

        <Text style={styles.section}>Registros</Text>
        <View style={[styles.row, styles.headerRow]}>
          <Text style={styles.cellDate}>Data/Hora</Text>
          <Text style={styles.cellEvent}>Evento</Text>
          <Text style={styles.cellIp}>IP</Text>
          <Text style={styles.cellDevice}>Device</Text>
        </View>
        {data.records.map((r, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.cellDate}>{formatInTz(r.timestamp)}</Text>
            <Text style={styles.cellEvent}>{r.eventType}</Text>
            <Text style={styles.cellIp}>{r.ip}</Text>
            <Text style={styles.cellDevice}>{r.deviceHash.slice(0, 10)}…</Text>
          </View>
        ))}

        <Text style={styles.section}>Total de horas trabalhadas: {data.totalWorkedHours.toFixed(2)}h</Text>

        {data.anomalies.length > 0 && (
          <>
            <Text style={styles.section}>Anomalias</Text>
            {data.anomalies.map((a, i) => (
              <Text key={i}>• {a}</Text>
            ))}
          </>
        )}

        <View style={styles.footer}>
          <Text style={styles.sigLine}>Assinatura do funcionário</Text>
          <Text style={styles.sigLine}>Assinatura do gestor</Text>
          <Text style={styles.sigLine}>Assinatura do contador</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderMonthlyPdf(data: MonthlyPdfData): Promise<Buffer> {
  return renderToBuffer(<MonthlyReport data={data} />);
}
