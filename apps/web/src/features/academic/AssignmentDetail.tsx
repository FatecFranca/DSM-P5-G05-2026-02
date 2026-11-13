import { useState, type FormEvent } from 'react';
import { useSession } from '../../auth/Session';
import { Empty, Panel, formatDate, formatNumber } from '../../components/UI';
import type { AcademicFile, AcademicSnapshot } from '../../services/contracts';

interface Props { snapshot: AcademicSnapshot; activityId: string; closed: boolean; onChanged: () => void; onBack: () => void }
type Activity = AcademicSnapshot['atividades'][number];
type Delivery = AcademicSnapshot['entregas'][number];
const message = (cause: unknown) => cause instanceof Error ? cause.message : 'Não foi possível concluir a operação.';

async function download(request: ReturnType<typeof useSession>['request'], file: AcademicFile) {
  const bytes = await request<ArrayBuffer>(`/arquivos/${file.id}`, { binary: true });
  const url = URL.createObjectURL(new Blob([bytes], { type: file.mime }));
  const link = document.createElement('a'); link.href = url; link.download = file.nome; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function Correction({ activity, delivery, onSaved, closed }: { activity: Activity; delivery: Delivery; onSaved: () => void; closed: boolean }) {
  const { request } = useSession();
  const [score, setScore] = useState(delivery.nota === null ? '' : String(delivery.nota));
  const [feedback, setFeedback] = useState(delivery.feedback ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const nota = Number(score.replace(',', '.'));
    if (!Number.isFinite(nota) || nota < 0 || nota > activity.notaMaxima) { setError(`Informe uma nota entre 0 e ${activity.notaMaxima}.`); setBusy(false); return; }
    try { await request(`/atividades/${activity.id}/entregas/${delivery.matriculaId}/correcao`, { method: 'PUT', body: { nota, feedback: feedback.trim() } }); onSaved(); }
    catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  }
  if (closed) return null;
  return <form className="action-form" onSubmit={(event) => void submit(event)}><label>Nota (até {activity.notaMaxima})<input required type="number" min="0" max={activity.notaMaxima} step="any" value={score} onChange={(event) => setScore(event.target.value)} /></label><label>Comentário para o estudante<textarea maxLength={2000} value={feedback} onChange={(event) => setFeedback(event.target.value)} /></label><button className="secondary-button" disabled={busy}>{busy ? 'Salvando…' : delivery.corrigidaEm ? 'Atualizar correção' : 'Salvar correção'}</button>{error && <p className="form-error" role="alert">{error}</p>}</form>;
}

export function AssignmentDetail({ snapshot, activityId, closed, onChanged, onBack }: Props) {
  const { request, session } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const activity = snapshot.atividades.find((item) => item.id === activityId);
  if (!activity) return <><button type="button" className="back-button" onClick={onBack}>‹ Voltar à turma</button><Empty title="Atividade indisponível" detail="Ela pode ter sido removida ou você não tem acesso." /></>;
  const selectedActivity = activity;
  const student = session?.user.perfil === 'ALUNO';
  const teacher = session?.user.perfil === 'PROFESSOR';
  const ownId = snapshot.matriculas.find((item) => item.alunoId === session?.user.id)?.id;
  const delivery = student ? snapshot.entregas.find((item) => item.atividadeId === activityId && item.matriculaId === ownId) : undefined;
  const canSubmit = student && activity.estado === 'PUBLICADA' && !closed && Date.parse(activity.prazo) > Date.now() && !delivery?.corrigidaEm;

  async function run(work: () => Promise<unknown>, success: string) {
    setBusy(true); setError(''); setNotice('');
    try { await work(); setNotice(success); onChanged(); }
    catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!file) { setError('Selecione um arquivo para entregar.'); return; }
    await run(async () => {
      const form = new FormData(); form.append('arquivo', file, file.name);
      const uploaded = await request<AcademicFile>('/arquivos', { method: 'POST', body: form });
      await request(`/atividades/${selectedActivity.id}/entrega`, { method: 'PUT', body: { arquivoId: uploaded.id } });
      setFile(null); formElement.reset();
    }, 'Entrega enviada.');
  }

  return <>
    <button type="button" className="back-button" onClick={onBack}>‹ Voltar à turma</button>
    <div className="page-heading"><div><p className="section-label">{snapshot.disciplinas.find((item) => item.id === activity.disciplinaId)?.nome ?? 'Disciplina'}</p><h1>{activity.titulo}</h1><p>Prazo: {formatDate(activity.prazo)} · Nota máxima: {formatNumber(activity.notaMaxima)}</p></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}
    <Panel title="Instruções"><div className="panel-body"><p>{activity.descricao.trim() || 'O docente não incluiu instruções.'}</p><span className="status">{activity.estado === 'RASCUNHO' ? 'Rascunho' : activity.estado === 'ENCERRADA' ? 'Encerrada' : 'Publicada'}</span></div></Panel>
    {teacher && activity.estado === 'RASCUNHO' && !closed && <button type="button" className="primary-button" disabled={busy} onClick={() => void run(() => request(`/atividades/${activity.id}/publicar`, { method: 'POST' }), 'Atividade publicada.')}>Publicar atividade</button>}
    {student && <Panel title="Minha entrega"><div className="panel-body">{delivery ? <><p><button type="button" className="text-button" onClick={() => void download(request, delivery.arquivo).catch((cause: unknown) => setError(message(cause)))}>{delivery.arquivo.nome} ↓</button> · enviada em {formatDate(delivery.enviadaEm)}</p>{delivery.corrigidaEm ? <p>Nota: {formatNumber(delivery.nota)} de {formatNumber(activity.notaMaxima)}. {delivery.feedback || 'Sem comentário.'}</p> : <p>Aguardando correção do professor.</p>}</> : <p>Você ainda não enviou esta atividade.</p>}{canSubmit ? <form className="action-form" onSubmit={(event) => void submit(event)}><label>Arquivo da entrega<input type="file" required onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)} /></label><button className="primary-button" disabled={busy}>{busy ? 'Enviando…' : delivery ? 'Substituir entrega' : 'Enviar entrega'}</button></form> : <p className="muted">{closed ? 'Período fechado.' : delivery?.corrigidaEm ? 'A entrega já foi corrigida.' : Date.parse(activity.prazo) <= Date.now() ? 'O prazo terminou.' : ''}</p>}</div></Panel>}
    {!student && activity.estado !== 'RASCUNHO' && <Panel title={`Entregas · ${snapshot.entregas.filter((item) => item.atividadeId === activityId).length} de ${snapshot.matriculas.length}`}><div className="record-list">{snapshot.matriculas.map((item) => { const sent = snapshot.entregas.find((entry) => entry.atividadeId === activityId && entry.matriculaId === item.id); return <div className="record" key={item.id}><div className="record-heading"><strong>{item.aluno.nome}</strong><span className="status">{!sent ? 'Não entregou' : sent.corrigidaEm ? `Nota ${formatNumber(sent.nota)}` : 'Aguardando correção'}</span></div>{sent && <div className="record-body"><button type="button" className="text-button" onClick={() => void download(request, sent.arquivo).catch((cause: unknown) => setError(message(cause)))}>{sent.arquivo.nome} ↓</button>{teacher && <Correction key={`${sent.matriculaId}:${sent.corrigidaEm ?? ''}`} activity={activity} delivery={sent} closed={closed} onSaved={() => { setNotice('Correção salva.'); onChanged(); }} />}</div>}</div>; })}</div></Panel>}
  </>;
}
