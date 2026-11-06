import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSession } from '@/auth/session';
import { Screen } from '@/components/primitives';
import { TopBar } from '@/components/top-bar';
import { ActionButton, BodyText, Chip, Feedback, FormField, Panel, PanelTitle, academicStyles } from '@/demo/academic-ui';
import { Editor, type EditorConfig } from '@/features/academic/editor';
import { formatCents, parseMoneyToCents } from '@/features/finance/money';

type Enrollment = { id: string; registro: string; aluno: { nome: string }; turma: { id: string; curso: string; duracaoSemestres: number } };
type Invoice = { id: string; competencia: string; semestre: number | null; vencimento: string; valorCentavos: number; pagoCentavos: number; situacao: 'ABERTA' | 'VENCIDA' | 'QUITADA' };
type Semester = { semestre: number; situacao: string; devidoCentavos: number; pagoCentavos: number; saldoCentavos: number };
type Scholarship = { inicio: string; fim: string | null; ativa: boolean; vigente: boolean } | null;
type MonthlyPlan = { inicioCompetencia: string; fimCompetencia: string | null; proximaCompetencia: string; valorCentavos: number; diaVencimento: number; ativo: boolean } | null;
const isoMonth = () => new Date().toISOString().slice(0, 7);

export default function FinanceScreen() {
  const { request, state } = useSession();
  const admin = state.status === 'signedIn' && state.user.perfil === 'COORDENACAO';
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Enrollment[]>([]);
  const [selected, setSelected] = useState<Enrollment | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [scholarship, setScholarship] = useState<Scholarship>(null);
  const [plan, setPlan] = useState<MonthlyPlan>(null);
  const [recordReady, setRecordReady] = useState(false);
  const [editor, setEditor] = useState<EditorConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    void Promise.all([
      request<Invoice[]>(`/faturas/matriculas/${selected.id}`),
      request<Scholarship>(`/bolsas/matriculas/${selected.id}`),
      request<MonthlyPlan>(`/faturas/matriculas/${selected.id}/plano`),
      request<Semester[]>(`/faturas/matriculas/${selected.id}/semestres`),
    ]).then(([nextInvoices, nextScholarship, nextPlan, nextSemesters]) => {
      if (active) { setInvoices(nextInvoices); setScholarship(nextScholarship); setPlan(nextPlan); setSemesters(nextSemesters); setRecordReady(true); }
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar as cobranças.'); });
    return () => { active = false; };
  }, [request, selected, revision]);

  async function search() {
    if (query.trim().length < 2) { setError('Informe ao menos 2 caracteres do registro.'); return; }
    setBusy(true); setError('');
    try { setMatches(await request<Enrollment[]>(`/faturas/matriculas?registro=${encodeURIComponent(query.trim())}`)); }
    catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Busca indisponível.'); }
    finally { setBusy(false); }
  }

  function openPlan() {
    if (!selected) return;
    setEditor({ title: 'Plano mensal automático', fields: [
      { key: 'inicio', label: 'Primeira competência (AAAA-MM)', initial: plan?.inicioCompetencia.slice(0, 7) ?? isoMonth() },
      { key: 'fim', label: 'Última competência (opcional)', optional: true, initial: plan?.fimCompetencia?.slice(0, 7) ?? '' },
      { key: 'valor', label: 'Mensalidade em reais', initial: plan ? (plan.valorCentavos / 100).toFixed(2).replace('.', ',') : '' },
      { key: 'dia', label: 'Dia do vencimento (1–31)', type: 'number', initial: String(plan?.diaVencimento ?? 10) },
      { key: 'ativo', label: 'Situação', options: [{ id: 'true', label: 'Ativo' }, { id: 'false', label: 'Inativo' }], initial: plan?.ativo === false ? 'false' : 'true' },
    ], submit: async (values) => {
      const diaVencimento = Number(values.dia);
      if (!Number.isInteger(diaVencimento) || diaVencimento < 1 || diaVencimento > 31) throw new Error('O dia de vencimento deve estar entre 1 e 31.');
      await request(`/faturas/matriculas/${selected.id}/plano`, { method: 'PUT', body: {
        inicioCompetencia: values.inicio, ...(values.fim ? { fimCompetencia: values.fim } : {}),
        valorCentavos: parseMoneyToCents(values.valor), diaVencimento, ativo: values.ativo === 'true',
      } });
      setNotice('Plano salvo. As faturas são geradas automaticamente a cada mês.'); setRecordReady(false); setRevision((value) => value + 1);
    } });
  }

  function openDuration() {
    if (!selected) return;
    setEditor({ title: 'Duração do curso', fields: [
      { key: 'semestres', label: 'Número de semestres (1–20)', type: 'number', initial: String(selected.turma.duracaoSemestres) },
    ], submit: async (values) => {
      const duracaoSemestres = Number(values.semestres);
      if (!Number.isInteger(duracaoSemestres) || duracaoSemestres < 1 || duracaoSemestres > 20) throw new Error('Informe entre 1 e 20 semestres.');
      await request(`/turmas/${selected.turma.id}/duracao`, { method: 'PUT', body: { duracaoSemestres } });
      setSelected({ ...selected, turma: { ...selected.turma, duracaoSemestres } });
      setNotice('Duração do curso atualizada.');
      setRevision((value) => value + 1);
    } });
  }

  function openInvoice() {
    if (!selected) return;
    setEditor({ title: 'Criar fatura avulsa', fields: [
      { key: 'competencia', label: 'Competência (AAAA-MM)', initial: isoMonth() },
      ...(!plan ? [{ key: 'semestre', label: 'Semestre do curso', type: 'number' as const, initial: '1' }] : []),
      { key: 'vencimento', label: 'Vencimento (AAAA-MM-DD)', type: 'date', initial: new Date().toISOString().slice(0, 10) },
      { key: 'valor', label: 'Valor em reais' },
    ], submit: async (values) => {
      const semestre = plan ? undefined : Number(values.semestre);
      if (semestre !== undefined && (!Number.isInteger(semestre) || semestre < 1 || semestre > selected.turma.duracaoSemestres)) throw new Error('Semestre inválido para a duração do curso.');
      await request('/faturas', { method: 'POST', body: {
        matriculaId: selected.id, competencia: values.competencia, ...(semestre ? { semestre } : {}), vencimento: values.vencimento,
        valorCentavos: parseMoneyToCents(values.valor),
      } });
      setNotice('Fatura registrada.'); setRecordReady(false); setRevision((value) => value + 1);
    } });
  }

  function openPayment(invoice: Invoice) {
    setEditor({ title: `Registrar pagamento · ${invoice.competencia.slice(0, 7)}`, fields: [
      { key: 'referencia', label: 'Referência única do comprovante' },
      { key: 'valor', label: `Valor em reais (saldo ${formatCents(invoice.valorCentavos - invoice.pagoCentavos)})`, initial: ((invoice.valorCentavos - invoice.pagoCentavos) / 100).toFixed(2).replace('.', ',') },
    ], submit: async (values) => {
      const valorCentavos = parseMoneyToCents(values.valor);
      if (valorCentavos > invoice.valorCentavos - invoice.pagoCentavos) throw new Error('Pagamento acima do saldo da fatura.');
      await request(`/faturas/${invoice.id}/pagamentos`, { method: 'POST', body: { referencia: values.referencia.trim(), valorCentavos } });
      setNotice('Pagamento registrado; os atributos financeiros foram atualizados.'); setRecordReady(false); setRevision((value) => value + 1);
    } });
  }

  function openScholarship() {
    if (!selected) return;
    setEditor({ title: 'Bolsa institucional', fields: [
      { key: 'inicio', label: 'Início (AAAA-MM-DD)', type: 'date', initial: scholarship?.inicio.slice(0, 10) ?? new Date().toISOString().slice(0, 10) },
      { key: 'fim', label: 'Fim (opcional)', type: 'date', optional: true, initial: scholarship?.fim?.slice(0, 10) ?? '' },
      { key: 'ativa', label: 'Situação', options: [{ id: 'true', label: 'Ativa' }, { id: 'false', label: 'Inativa' }], initial: scholarship?.ativa === false ? 'false' : 'true' },
    ], submit: async (values) => {
      await request(`/bolsas/matriculas/${selected.id}`, { method: 'PUT', body: {
        inicio: values.inicio, ...(values.fim ? { fim: values.fim } : {}), ativa: values.ativa === 'true',
      } });
      setNotice('Bolsa atualizada.'); setRecordReady(false); setRevision((value) => value + 1);
    } });
  }

  return <Screen>
    <TopBar />
    <Panel><PanelTitle>Financeiro · mensalidades</PanelTitle>
      <BodyText>Localize uma matrícula para configurar o plano mensal, consultar faturas e registrar pagamentos. Vencimentos são processados automaticamente pelo servidor.</BodyText>
      <FormField label="Registro do aluno" value={query} onChangeText={setQuery} placeholder="Digite ao menos 2 caracteres" />
      <ActionButton title="Buscar registro" disabled={busy} onPress={() => void search()} />
      <View style={academicStyles.chips}>{matches.map((item) => <Chip key={item.id} label={`${item.aluno.nome} · ${item.registro}`} selected={selected?.id === item.id} onPress={() => { setSelected(item); setInvoices([]); setScholarship(null); setPlan(null); setRecordReady(false); setEditor(null); setError(''); setNotice(''); }} />)}</View>
      {matches.length === 20 && <BodyText>Mostrando os 20 primeiros registros. Refine a busca.</BodyText>}
    </Panel>
    {!!error && <Feedback error message={error} />}
    {!!notice && <Feedback message={notice} />}
    {editor && <Editor config={editor} close={() => setEditor(null)} />}
    {selected && !recordReady && <Panel><BodyText>{error ? 'Dados financeiros indisponíveis.' : 'Carregando dados financeiros…'}</BodyText><ActionButton title="Tentar novamente" secondary onPress={() => setRevision((value) => value + 1)} /></Panel>}
    {selected && !editor && recordReady && <>
      <Panel><PanelTitle>{selected.aluno.nome} · {selected.registro}</PanelTitle>
        <BodyText>{selected.turma.curso} · {selected.turma.duracaoSemestres} semestres</BodyText>
        {admin && <ActionButton title="Configurar duração do curso" secondary onPress={openDuration} />}
        <ActionButton title="Configurar plano mensal" onPress={openPlan} />
        <BodyText>Plano: {plan ? `${formatCents(plan.valorCentavos)} no dia ${plan.diaVencimento} · ${plan.ativo ? 'ativo' : 'inativo'} · próxima competência ${plan.proximaCompetencia.slice(0, 7)}` : 'não configurado'}</BodyText>
        <ActionButton title="Criar fatura avulsa" secondary onPress={openInvoice} />
        <ActionButton title="Configurar bolsa" secondary onPress={openScholarship} />
        <BodyText>Bolsa: {scholarship ? scholarship.vigente ? 'vigente' : scholarship.ativa ? 'agendada ou encerrada' : 'inativa' : 'não cadastrada'}</BodyText>
        <ActionButton title="Atualizar faturas" secondary onPress={() => setRevision((value) => value + 1)} />
      </Panel>
      <Panel><PanelTitle>Pagamentos por semestre</PanelTitle>
        {semesters.map((semester) => <BodyText key={semester.semestre}>{semester.semestre}º · {semester.situacao.replace('_', ' ').toLowerCase()} · pago {formatCents(semester.pagoCentavos)} · saldo emitido {formatCents(semester.saldoCentavos)}</BodyText>)}
      </Panel>
      {invoices.map((invoice) => <Panel key={invoice.id}>
        <PanelTitle>{invoice.competencia.slice(0, 7)} · {invoice.semestre ? `${invoice.semestre}º semestre · ` : ''}{invoice.situacao === 'VENCIDA' ? 'Vencida' : invoice.situacao === 'QUITADA' ? 'Quitada' : 'Aberta'}</PanelTitle>
        <BodyText>Vence em {invoice.vencimento.slice(0, 10)} · valor {formatCents(invoice.valorCentavos)} · pago {formatCents(invoice.pagoCentavos)}</BodyText>
        {invoice.situacao !== 'QUITADA' && <ActionButton title="Registrar pagamento" onPress={() => openPayment(invoice)} />}
      </Panel>)}
      {!invoices.length && <Panel><BodyText>Nenhuma fatura nesta matrícula.</BodyText></Panel>}
    </>}
  </Screen>;
}
