import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useSession } from '@/auth/session';
import { Screen } from '@/components/primitives';
import { AcademicHeader, ActionButton, Disclosure, EmptyState, Feedback, FormField, ListRow, Meter, Panel, PanelHeader, RowList, TypeIcon, academicStyles, formatAcademicDate, formatAcademicNumber } from '@/demo/academic-ui';
import { chooseFile, saveFile } from '@/features/academic/files';
import type { AcademicFile, AcademicSnapshot } from '@/services/academic';
import { assignmentState, capitalize, isDueSoon, relativeDay } from './collaboration';
import { RequestState } from './ui';
import { useNow } from './use-now';
import type { Activity, Delivery } from './assignments';

const shortDate = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Correção de uma entrega: nota de 0 até o máximo da atividade e comentário opcional. */
function CorrectionForm({ activity, delivery, onSaved }: { activity: Activity; delivery: Delivery; onSaved: () => void }) {
  const { request } = useSession();
  const [score, setScore] = useState(delivery.nota === null ? '' : String(delivery.nota).replace('.', ','));
  const [feedback, setFeedback] = useState(delivery.feedback ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    const value = Number(score.trim().replace(',', '.'));
    if (!score.trim() || !Number.isFinite(value) || value < 0 || value > activity.notaMaxima) {
      setError(`Informe uma nota de 0 a ${formatAcademicNumber(activity.notaMaxima)}.`);
      return;
    }
    setBusy(true); setError('');
    try {
      await request(`/atividades/${activity.id}/entregas/${delivery.matriculaId}/correcao`, { method: 'PUT', body: { nota: value, feedback } });
      onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a correção.'); } finally { setBusy(false); }
  }
  return <>
    <FormField label={`Nota (0 a ${formatAcademicNumber(activity.notaMaxima)})`} value={score} onChangeText={setScore} keyboardType="decimal-pad" />
    <FormField label="Comentário para o estudante" value={feedback} onChangeText={setFeedback} multiline />
    {error ? <Feedback error message={error} /> : null}
    <ActionButton title={busy ? 'Salvando…' : delivery.corrigidaEm ? 'Atualizar correção' : 'Salvar correção'} disabled={busy} onPress={() => void save()} />
  </>;
}

/** Tarefa: instruções, a entrega do estudante e o retorno do professor; para a docência, as entregas da turma. */
export function ConnectedAssignmentDetail() {
  const { id, turmaId } = useLocalSearchParams<{ id: string; turmaId?: string }>();
  const { state, request } = useSession();
  const [snapshot, setSnapshot] = useState<AcademicSnapshot | null>(null);
  const [loading, setLoading] = useState(Boolean(turmaId));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const perfil = state.status === 'signedIn' ? state.user.perfil : null;
  const student = perfil === 'ALUNO';
  const professor = perfil === 'PROFESSOR';

  useEffect(() => {
    if (!turmaId) return;
    let active = true;
    void request<AcademicSnapshot>(`/academico/resumo?turmaId=${encodeURIComponent(turmaId)}`)
      .then((value) => { if (!active) return; if (value.truncated) throw new Error('A consulta da turma está incompleta.'); setSnapshot(value); setError(''); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar a tarefa.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [turmaId, revision, request]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const activity = snapshot?.atividades.find((item) => item.id === id);
  const turma = snapshot?.turmas.find((item) => item.id === turmaId);
  const closed = turma?.fechada ?? false;
  const now = useNow();

  async function download(file: AcademicFile) {
    setActionError('');
    try { await saveFile(file, await request<ArrayBuffer>(`/arquivos/${file.id}`, { binary: true })); }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Não foi possível baixar o arquivo.'); }
  }

  async function run(work: () => Promise<string | null>) {
    setBusy(true); setActionError(''); setNotice('');
    try { const message = await work(); if (message) { setNotice(message); reload(); } }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Não foi possível concluir.'); }
    finally { setBusy(false); }
  }

  const header = <AcademicHeader back fallbackHref="/connected/assignments" title={activity?.titulo ?? 'Tarefa'} subtitle={activity && snapshot ? `${snapshot.disciplinas.find((item) => item.id === activity.disciplinaId)?.nome ?? 'Disciplina'} · ${turma?.nome ?? ''}` : undefined} />;
  if (loading || error || !activity || !snapshot) {
    return <Screen>{header}
      <RequestState loading={loading} error={error} onRetry={() => { setLoading(true); setError(''); reload(); }} />
      {!loading && !error ? <EmptyState title="Tarefa não encontrada" detail="Ela pode ter sido removida ou você não tem acesso a esta turma." /> : null}
    </Screen>;
  }

  const delivery = snapshot.entregas.find((item) => item.atividadeId === activity.id);
  const situation = assignmentState(activity, delivery, now);
  const canSubmit = student && activity.estado === 'PUBLICADA' && !closed && Date.parse(activity.prazo) > now && !delivery?.corrigidaEm;
  const canCorrect = professor && !closed;
  const dueTone = situation === 'late' ? 'danger' : isDueSoon(activity.prazo, now) && !delivery ? 'attention' : 'neutral';
  const blocker = closed ? 'Período fechado para alterações.' : delivery?.corrigidaEm ? 'Esta entrega já foi corrigida e não pode ser substituída.' : Date.parse(activity.prazo) <= now ? 'O prazo terminou.' : null;

  async function submit() {
    await run(async () => {
      const form = await chooseFile();
      if (!form) return null;
      const file = await request<AcademicFile>('/arquivos', { method: 'POST', body: form });
      await request(`/atividades/${activity!.id}/entrega`, { method: 'PUT', body: { arquivoId: file.id } });
      return 'Entrega enviada.';
    });
  }

  const enrollments = [...snapshot.matriculas].sort((a, b) => {
    const rank = (id: string) => { const d = snapshot.entregas.find((item) => item.atividadeId === activity.id && item.matriculaId === id); return !d ? 1 : d.corrigidaEm ? 2 : 0; };
    return rank(a.id) - rank(b.id) || a.aluno.nome.localeCompare(b.aluno.nome, 'pt-BR');
  });

  // Quem já tem nota quer vê-la antes de qualquer outra coisa; por isso o retorno abre a tela.
  const feedbackPanel = delivery?.corrigidaEm ? <Panel>
    <PanelHeader title="Retorno do professor" />
    {delivery.nota !== null ? <Meter label="Nota" value={delivery.nota / activity.notaMaxima} valueLabel={`${formatAcademicNumber(delivery.nota)} de ${formatAcademicNumber(activity.notaMaxima)}`} /> : null}
    <Text style={academicStyles.prose}>{delivery.feedback?.trim() || 'O professor não deixou comentário.'}</Text>
    <Text style={academicStyles.meta}>Corrigida em {formatAcademicDate(delivery.corrigidaEm)}</Text>
  </Panel> : null;

  const details = <Panel>
    <PanelHeader title="Detalhes" />
    <RowList>
      <ListRow title="Prazo" meta={shortDate(activity.prazo)} badge={{ text: situation === 'late' ? `Venceu ${relativeDay(activity.prazo, now)}` : capitalize(relativeDay(activity.prazo, now)), tone: dueTone }} />
      <ListRow title="Nota máxima" value={formatAcademicNumber(activity.notaMaxima)} />
      {activity.estado === 'RASCUNHO' ? <ListRow title="Situação" meta="Ainda não publicada para os estudantes" badge={{ text: 'Rascunho', tone: 'neutral' }} /> : null}
    </RowList>
    <View style={academicStyles.stack}>
      <Text style={academicStyles.strong}>Instruções</Text>
      <Text style={academicStyles.prose}>{activity.descricao.trim() || 'O docente não incluiu instruções.'}</Text>
    </View>
  </Panel>;

  return <Screen>
    {header}
    {student ? <>
      {feedbackPanel}
      {details}
      <Panel>
        <PanelHeader title="Sua entrega" />
        {delivery
          ? <RowList><ListRow leading={<TypeIcon name="folder" />} title={delivery.arquivo.nome} meta={`Enviada ${relativeDay(delivery.enviadaEm, now)} · ${shortDate(delivery.enviadaEm)}`} onPress={() => void download(delivery.arquivo)} /></RowList>
          : <Text style={academicStyles.meta}>Você ainda não enviou esta tarefa.</Text>}
        {delivery && !delivery.corrigidaEm ? <Text style={academicStyles.meta}>Aguardando correção do professor.</Text> : null}
        {canSubmit
          ? <ActionButton title={busy ? 'Enviando…' : delivery ? 'Substituir entrega' : 'Enviar entrega'} disabled={busy} onPress={() => void submit()} />
          : blocker ? <Text style={academicStyles.meta}>{blocker}</Text> : null}
        {notice ? <Feedback message={notice} /> : null}
        {actionError ? <Feedback error message={actionError} /> : null}
      </Panel>
    </> : <>
      {details}
      {professor && activity.estado === 'RASCUNHO' && !closed
        ? <ActionButton title={busy ? 'Publicando…' : 'Publicar atividade'} disabled={busy} onPress={() => void run(async () => { await request(`/atividades/${activity.id}/publicar`, { method: 'POST' }); return 'Atividade publicada.'; })} />
        : null}
      {notice ? <Feedback message={notice} /> : null}
      {actionError ? <Feedback error message={actionError} /> : null}
      {activity.estado !== 'RASCUNHO' ? <Panel>
        <PanelHeader title={`Entregas · ${snapshot.entregas.filter((item) => item.atividadeId === activity.id).length} de ${snapshot.matriculas.length}`} />
        {enrollments.length ? <RowList>{enrollments.map((enrollment) => {
          const own = snapshot.entregas.find((item) => item.atividadeId === activity.id && item.matriculaId === enrollment.id);
          return <Disclosure
            key={enrollment.id}
            alignValues={false}
            title={enrollment.aluno.nome}
            meta={own ? `${enrollment.registro} · enviada ${relativeDay(own.enviadaEm, now)}` : enrollment.registro}
            value={own?.corrigidaEm && own.nota !== null ? formatAcademicNumber(own.nota) : undefined}
            badge={!own ? { text: 'Não entregou', tone: 'quiet' } : own.corrigidaEm ? undefined : { text: 'Aguardando', tone: 'attention' }}>
            {own ? <>
              <RowList><ListRow leading={<TypeIcon name="folder" size={36} />} title={own.arquivo.nome} meta={`Enviada ${shortDate(own.enviadaEm)}`} onPress={() => void download(own.arquivo)} /></RowList>
              {own.feedback ? <Text style={academicStyles.prose}>Comentário atual: {own.feedback}</Text> : null}
              {canCorrect ? <CorrectionForm activity={activity} delivery={own} onSaved={() => { setNotice('Correção salva.'); reload(); }} /> : null}
            </> : <Text style={academicStyles.meta}>Ainda não entregou.</Text>}
          </Disclosure>;
        })}</RowList> : <Text style={academicStyles.meta}>Nenhum estudante matriculado.</Text>}
      </Panel> : null}
    </>}
  </Screen>;
}
