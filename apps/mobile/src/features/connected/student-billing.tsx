import { useEffect, useState } from 'react';
import { useSession } from '@/auth/session';
import { confirmAction } from '@/components/dialogs';
import { ActionButton, BodyText, Feedback, Panel, PanelTitle } from '@/demo/academic-ui';
import { formatCents } from '@/features/finance/money';

type Invoice = { id: string; competencia: string; semestre: number | null; vencimento: string; valorCentavos: number; pagoCentavos: number; situacao: 'ABERTA' | 'VENCIDA' | 'QUITADA' };
type Semester = { semestre: number; situacao: 'ATRASADO' | 'NAO_INICIADO' | 'QUITADO' | 'EM_DIA'; devidoCentavos: number; pagoCentavos: number; saldoCentavos: number };

export function StudentBilling({ enrollments }: { enrollments: { id: string; registration: string }[] }) {
  const { request } = useSession();
  const [rows, setRows] = useState<{ registration: string; invoices: Invoice[]; semesters: Semester[] }[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.all(enrollments.map(async (item) => {
      const [invoices, semesters] = await Promise.all([
        request<Invoice[]>(`/faturas/matriculas/${item.id}`),
        request<Semester[]>(`/faturas/matriculas/${item.id}/semestres`),
      ]);
      return { registration: item.registration, invoices, semesters };
    })).then((result) => { if (active) { setRows(result); setError(''); } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível consultar as mensalidades.'); })
      .finally(() => { if (active) { setLoading(false); setBusy(false); } });
    return () => { active = false; };
  }, [enrollments, request, revision]);

  async function pay(invoice: Invoice) {
    if (busy || invoice.valorCentavos <= invoice.pagoCentavos) return;
    const confirmed = await confirmAction('Simular pagamento?', `Esta ação fictícia quitará ${formatCents(invoice.valorCentavos - invoice.pagoCentavos)} da fatura ${invoice.competencia.slice(0, 7)}. Nenhum dinheiro será movimentado.`, 'Simular pagamento');
    if (!confirmed) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await request(`/faturas/${invoice.id}/simular-pagamento`, { method: 'POST' });
      setNotice('Pagamento simulado registrado. Os indicadores financeiros foram atualizados.');
      setLoading(true);
      setRows([]);
      setRevision((value) => value + 1);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível simular o pagamento.');
      setBusy(false);
    }
  }

  return <Panel><PanelTitle>Minhas mensalidades</PanelTitle>
    <BodyText>Ambiente acadêmico de simulação: pagar uma mensalidade aqui não movimenta dinheiro real. Os vencimentos e pagamentos alteram automaticamente os indicadores financeiros.</BodyText>
    {!!error && <Feedback error message={error} />}
    {!!notice && <Feedback message={notice} />}
    {loading && <BodyText>Carregando mensalidades…</BodyText>}
    {rows.map(({ registration, invoices, semesters }) => <Panel key={registration}>
      <PanelTitle>{registration} · pagamentos por semestre</PanelTitle>
      {semesters.map((semester) => <BodyText key={semester.semestre}>{semester.semestre}º semestre · {semester.situacao.replace('_', ' ').toLowerCase()} · pago {formatCents(semester.pagoCentavos)} · saldo emitido {formatCents(semester.saldoCentavos)}</BodyText>)}
      {invoices.map((invoice) => <Panel key={invoice.id}>
        <BodyText>{invoice.competencia.slice(0, 7)} · {invoice.semestre ? `${invoice.semestre}º semestre · ` : ''}{invoice.situacao === 'VENCIDA' ? 'Vencida' : invoice.situacao === 'QUITADA' ? 'Quitada' : 'Aberta'} · vence {invoice.vencimento.slice(0, 10)} · saldo {formatCents(invoice.valorCentavos - invoice.pagoCentavos)}</BodyText>
        {invoice.valorCentavos > invoice.pagoCentavos && <ActionButton title={`Simular pagamento de ${formatCents(invoice.valorCentavos - invoice.pagoCentavos)}`} disabled={busy || loading} onPress={() => void pay(invoice)} />}
      </Panel>)}
    </Panel>)}
    {!loading && !rows.some((item) => item.invoices.length) && !error && <BodyText>Nenhuma fatura disponível. A coordenação ou a secretaria precisa configurar um plano mensal ou emitir uma fatura.</BodyText>}
    <ActionButton title="Atualizar mensalidades" secondary disabled={busy || loading} onPress={() => { setLoading(true); setRows([]); setError(''); setRevision((value) => value + 1); }} />
  </Panel>;
}
