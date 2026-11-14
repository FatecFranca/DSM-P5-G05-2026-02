import { useEffect, useState, type FormEvent } from 'react';
import { useSession } from '../../auth/Session';
import { Empty, Metric, Panel, StateMessage, formatDate, formatNumber } from '../../components/UI';
import type { AcademicFile, AcademicSnapshot, AttendanceStatus } from '../../services/contracts';
import { type ClassView, type Overview } from './overview-model';
import { ClassManagement } from './ClassManagement';
import { TeachingActions } from './TeachingActions';
import { AcademicFeed } from './AcademicFeed';
import { EnrollmentAnalysis } from './EnrollmentAnalysis';

interface PageProps { data: Overview; navigate: (path: string) => void; refresh: () => void }
const subjectName = (snapshot: AcademicSnapshot, id: string) => snapshot.disciplinas.find((item) => item.id === id)?.nome ?? 'Disciplina';

export function ClassesPage({ data, navigate, refresh }: PageProps) {
  const { session, request } = useSession();
  const manager = session!.user.perfil === 'COORDENACAO';
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [course, setCourse] = useState('');
  const [period, setPeriod] = useState(`${new Date().getFullYear()}/${new Date().getMonth() < 6 ? 1 : 2}`);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setBusy(true);
    try { const item = await request<{ id: string }>('/turmas', { method: 'POST', body: { nome: name.trim(), curso: course.trim(), periodo: period.trim() } }); refresh(); navigate(`/turmas/${item.id}`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível criar a turma.'); }
    finally { setBusy(false); }
  }
  return <>
    <div className="page-heading"><div><p className="section-label">Estrutura acadêmica</p><h1>Turmas</h1><p>Disciplinas, estudantes e registros de cada turma.</p></div>{manager && <button type="button" className="primary-button compact" onClick={() => setCreating((value) => !value)}>{creating ? 'Cancelar' : 'Nova turma'}</button>}</div>
    {creating && <Panel title="Criar turma"><form className="inline-form" onSubmit={(event) => void create(event)}><label>Nome<input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: DSM 5º semestre" /></label><label>Curso<input required maxLength={120} value={course} onChange={(event) => setCourse(event.target.value)} /></label><label>Período letivo<input required maxLength={30} value={period} onChange={(event) => setPeriod(event.target.value)} /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button compact" disabled={busy}>Criar turma</button></form></Panel>}
    {data.classes.length ? <div className="class-grid">{data.classes.map((item) => {
      const students = data.enrollments.filter((entry) => entry.classId === item.id);
      return <button type="button" className="class-card" key={item.id} onClick={() => navigate(`/turmas/${item.id}`)}><span className="class-card-top"><span className="class-monogram">{item.name.slice(0, 2).toUpperCase()}</span><span className={`status ${item.closed ? 'muted-status' : ''}`}>{item.closed ? 'Período fechado' : 'Em andamento'}</span></span><strong>{item.name}</strong><span>{item.course} · {item.period}</span><span className="class-card-footer">{session!.user.perfil === 'ALUNO' ? `${item.snapshot.disciplinas.length} disciplinas` : `${students.length} estudantes · ${item.snapshot.disciplinas.length} disciplinas`}<b aria-hidden="true">›</b></span></button>;
    })}</div> : <Empty title="Nenhuma turma disponível" detail="Confira os vínculos acadêmicos da sua conta." />}
  </>;
}

export function ActivitiesPage({ data, navigate }: PageProps) {
  const { session } = useSession();
  const student = session!.user.perfil === 'ALUNO';
  const items = data.classes.flatMap((turma) => {
    const ownEnrollmentId = student ? turma.snapshot.matriculas.find((value) => value.alunoId === session!.user.id)?.id : undefined;
    return turma.snapshot.atividades.filter((activity) => !student || activity.estado === 'PUBLICADA').map((activity) => ({ ...activity, turma, subject: subjectName(turma.snapshot, activity.disciplinaId), delivery: turma.snapshot.entregas.find((entry) => entry.atividadeId === activity.id && (!student || entry.matriculaId === ownEnrollmentId)) }));
  }).sort((a, b) => Date.parse(a.prazo) - Date.parse(b.prazo));
  return <><div className="page-heading"><div><p className="section-label">Ensino e aprendizagem</p><h1>Atividades</h1><p>{student ? 'Acompanhe prazos e entregas publicadas.' : 'Acompanhe as atividades das turmas vinculadas.'}</p></div></div><Panel>{items.length ? <div className="rows">{items.map((item) => <button type="button" className="row-button" key={item.id} onClick={() => navigate(`/turmas/${item.turma.id}/atividades/${item.id}`)}><span className="date-tile"><strong>{new Date(item.prazo).toLocaleDateString('pt-BR', { day: '2-digit' })}</strong><small>{new Date(item.prazo).toLocaleDateString('pt-BR', { month: 'short' })}</small></span><span className="row-copy"><strong>{item.titulo}</strong><small>{item.subject} · {item.turma.name} · prazo {formatDate(item.prazo)}</small></span><span className="row-end">{item.delivery ? item.delivery.corrigidaEm ? 'Corrigida' : 'Entregue' : item.estado === 'RASCUNHO' ? 'Rascunho' : 'Pendente'}</span></button>)}</div> : <Empty title="Nenhuma atividade disponível" detail="Atividades das suas turmas aparecem aqui." />}</Panel></>;
}

export function ClassDetail({ item, navigate, refresh }: { item: ClassView; navigate: (path: string) => void; refresh: () => void }) {
  const { session, request } = useSession();
  const role = session!.user.perfil;
  const student = role === 'ALUNO';
  const teacher = role === 'PROFESSOR';
  const [tab, setTab] = useState<'resumo' | 'pessoas' | 'frequencia' | 'notas' | 'atividades' | 'materiais' | 'calendario' | 'avisos' | 'analise'>('resumo');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const snapshot = item.snapshot;
  const studentEnrollmentId = student ? snapshot.matriculas.find((value) => value.alunoId === session!.user.id)?.id : undefined;
  const indicator = student ? snapshot.indicadores.find((value) => value.matriculaId === studentEnrollmentId) : null;
  async function update(path: string, body?: object, method: 'POST' | 'PUT' = 'PUT') {
    setError(''); setNotice(''); setBusy(true);
    try { await request(path, { method, body }); setNotice('Registro salvo.'); refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar.'); }
    finally { setBusy(false); }
  }
  async function download(file: AcademicFile) {
    setError('');
    try {
      const bytes = await request<ArrayBuffer>(`/arquivos/${file.id}`, { binary: true });
      const url = URL.createObjectURL(new Blob([bytes], { type: file.mime }));
      const link = document.createElement('a'); link.href = url; link.download = file.nome; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível baixar o arquivo.'); }
  }
  return <>
    <button type="button" className="back-button" onClick={() => navigate('/turmas')}>‹ Todas as turmas</button>
    <div className="page-heading"><div><p className="section-label">{item.course} · {item.period}</p><h1>{item.name}</h1><p>{item.closed ? 'Período fechado' : 'Turma em andamento'} · {snapshot.disciplinas.length} disciplinas</p></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}
    <div className="tabs" role="tablist" aria-label="Dados da turma">{(['resumo', ...(student ? [] : ['pessoas'] as const), 'frequencia', 'notas', 'atividades', 'materiais', 'calendario', 'avisos', ...(['COORDENACAO', 'PROFESSOR', 'TUTOR'].includes(role) ? ['analise'] as const : [])] as const).map((key) => <button type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'selected' : ''} key={key} onClick={() => setTab(key)}>{({ resumo: 'Visão geral', pessoas: 'Pessoas', frequencia: 'Frequência', notas: 'Notas', atividades: 'Atividades', materiais: 'Materiais', calendario: 'Calendário', avisos: 'Avisos', analise: 'Análise' })[key]}</button>)}</div>
    {tab === 'pessoas' && !student && <ClassManagement turmaId={item.id} onChanged={refresh} />}
    {tab === 'resumo' && <><div className="metrics"><Metric label="Disciplinas" value={String(snapshot.disciplinas.length)} /><Metric label={student ? 'Minha média' : 'Estudantes'} value={student ? formatNumber(indicator?.media ?? null) : String(snapshot.matriculas.length)} /><Metric label={student ? 'Minha frequência' : 'Aulas'} value={student ? indicator?.frequencia == null ? '—' : `${formatNumber(indicator.frequencia, 0)}%` : String(snapshot.aulas.length)} /></div><Panel title="Disciplinas">{snapshot.disciplinas.length ? <div className="rows">{snapshot.disciplinas.map((discipline) => <div className="plain-row" key={discipline.id}><span className="row-symbol">D</span><span className="row-copy"><strong>{discipline.nome}</strong><small>{snapshot.aulas.filter((lesson) => lesson.disciplinaId === discipline.id).length} aulas · {snapshot.avaliacoes.filter((assessment) => assessment.disciplinaId === discipline.id).length} avaliações</small></span></div>)}</div> : <Empty title="Nenhuma disciplina" detail="As disciplinas aparecem depois do cadastro acadêmico." />}</Panel></>}
    {tab === 'frequencia' && <>{teacher && !item.closed && <TeachingActions snapshot={snapshot} kind="frequencia" onChanged={refresh} />}<Panel title={student ? 'Minhas presenças' : 'Chamadas'}>{snapshot.aulas.length ? <div className="record-list">{snapshot.aulas.map((lesson) => <AttendanceRow key={lesson.id} lesson={lesson} snapshot={snapshot} student={student} studentEnrollmentId={studentEnrollmentId} teacher={teacher && !item.closed} busy={busy} onSave={(matriculaId, situacao) => void update(`/aulas/${lesson.id}/frequencia`, { itens: [{ matriculaId, situacao }] })} />)}</div> : <Empty title="Nenhuma aula registrada" detail="As chamadas aparecem quando uma aula é cadastrada." />}</Panel></>}
    {tab === 'notas' && <>{teacher && !item.closed && <TeachingActions snapshot={snapshot} kind="notas" onChanged={refresh} />}<Panel title={student ? 'Minhas notas' : 'Avaliações'}>{snapshot.avaliacoes.filter((assessment) => !student || assessment.publicada).length ? <div className="record-list">{snapshot.avaliacoes.filter((assessment) => !student || assessment.publicada).map((assessment) => <GradeRow key={assessment.id} assessment={assessment} snapshot={snapshot} student={student} studentEnrollmentId={studentEnrollmentId} teacher={teacher && !item.closed} busy={busy} onSave={(matriculaId, valor) => void update(`/avaliacoes/${assessment.id}/notas`, { itens: [{ matriculaId, valor }] })} onPublish={() => void update(`/avaliacoes/${assessment.id}/publicar`, undefined, 'POST')} />)}</div> : <Empty title="Nenhuma avaliação disponível" detail="Notas publicadas aparecem aqui." />}</Panel></>}
    {tab === 'atividades' && <>{teacher && !item.closed && <TeachingActions snapshot={snapshot} kind="atividades" onChanged={refresh} />}<Panel title="Atividades da turma">{snapshot.atividades.filter((activity) => !student || activity.estado === 'PUBLICADA').length ? <div className="record-list">{snapshot.atividades.filter((activity) => !student || activity.estado === 'PUBLICADA').map((activity) => <div className="record" key={activity.id}><div className="record-heading"><div><strong>{activity.titulo}</strong><small>{subjectName(snapshot, activity.disciplinaId)} · prazo {formatDate(activity.prazo)}</small></div><span className="status">{activity.estado === 'RASCUNHO' ? 'Rascunho' : activity.estado === 'ENCERRADA' ? 'Encerrada' : 'Publicada'}</span></div><p>{activity.descricao}</p><button type="button" className="text-button" onClick={() => navigate(`/turmas/${item.id}/atividades/${activity.id}`)}>{student ? 'Abrir entrega' : 'Ver entregas e correções'}</button></div>)}</div> : <Empty title="Nenhuma atividade" detail="As atividades publicadas aparecem aqui." />}</Panel></>}
    {tab === 'materiais' && <>{teacher && !item.closed && <TeachingActions snapshot={snapshot} kind="materiais" onChanged={refresh} />}<Panel title="Materiais de aula">{snapshot.materiais.length ? <div className="rows">{snapshot.materiais.map((material) => <div className="plain-row" key={material.id}><span className="row-symbol">▤</span><span className="row-copy"><strong>{material.titulo}</strong><small>{subjectName(snapshot, material.disciplinaId)} · {material.arquivo.nome}</small></span><button type="button" className="text-button" onClick={() => void download(material.arquivo)}>Baixar</button></div>)}</div> : <Empty title="Nenhum material" detail="Arquivos publicados para a turma aparecem aqui." />}</Panel></>}
    {(tab === 'calendario' || tab === 'avisos') && <AcademicFeed kind={tab} turmaId={item.id} subjects={snapshot.disciplinas} />}
    {tab === 'analise' && ['COORDENACAO', 'PROFESSOR', 'TUTOR'].includes(role) && <EnrollmentAnalysis enrollments={snapshot.matriculas} />}
  </>;
}

function AttendanceRow({ lesson, snapshot, student, studentEnrollmentId, teacher, busy, onSave }: { lesson: AcademicSnapshot['aulas'][number]; snapshot: AcademicSnapshot; student: boolean; studentEnrollmentId?: string; teacher: boolean; busy: boolean; onSave: (id: string, status: AttendanceStatus) => void }) {
  const [enrollment, setEnrollment] = useState('');
  const [status, setStatus] = useState<AttendanceStatus>('PRESENTE');
  const records = snapshot.presencas.filter((item) => item.aulaId === lesson.id && (!student || item.matriculaId === studentEnrollmentId));
  const labels: Record<AttendanceStatus, string> = { PRESENTE: 'Presente', FALTA: 'Falta', FALTA_JUSTIFICADA: 'Falta justificada' };
  return <details className="record"><summary><span><strong>{lesson.tema}</strong><small>{subjectName(snapshot, lesson.disciplinaId)} · {formatDate(lesson.data)}</small></span><span className="status">{student ? labels[records[0]?.situacao] ?? 'Sem registro' : `${records.length} registros`}</span></summary>{!student && <div className="record-body">{records.length ? <div className="mini-list">{records.map((item) => <div key={item.matriculaId}><span>{snapshot.matriculas.find((value) => value.id === item.matriculaId)?.aluno.nome ?? 'Estudante'}</span><strong>{labels[item.situacao]}</strong></div>)}</div> : <p className="muted">Chamada ainda não registrada.</p>}{teacher && <form className="action-form" onSubmit={(event) => { event.preventDefault(); onSave(enrollment, status); }}><label>Estudante<select required value={enrollment} onChange={(event) => setEnrollment(event.target.value)}><option value="">Selecione</option>{snapshot.matriculas.map((item) => <option key={item.id} value={item.id}>{item.aluno.nome}</option>)}</select></label><label>Situação<select value={status} onChange={(event) => setStatus(event.target.value as AttendanceStatus)}>{Object.entries(labels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label><button type="submit" className="secondary-button" disabled={busy}>Salvar frequência</button></form>}</div>}</details>;
}

function GradeRow({ assessment, snapshot, student, studentEnrollmentId, teacher, busy, onSave, onPublish }: { assessment: AcademicSnapshot['avaliacoes'][number]; snapshot: AcademicSnapshot; student: boolean; studentEnrollmentId?: string; teacher: boolean; busy: boolean; onSave: (id: string, value: number) => void; onPublish: () => void }) {
  const [enrollment, setEnrollment] = useState('');
  const [grade, setGrade] = useState('');
  const grades = snapshot.notas.filter((item) => item.avaliacaoId === assessment.id && (!student || item.matriculaId === studentEnrollmentId));
  return <details className="record"><summary><span><strong>{assessment.titulo}</strong><small>{subjectName(snapshot, assessment.disciplinaId)} · {formatDate(assessment.data)} · peso {assessment.peso}</small></span><span className="status">{student ? grades[0] ? `${formatNumber(grades[0].valor)} / ${assessment.notaMaxima}` : 'Sem nota' : assessment.publicada ? 'Publicada' : 'Rascunho'}</span></summary>{!student && <div className="record-body"><div className="mini-list">{snapshot.matriculas.map((item) => <div key={item.id}><span>{item.aluno.nome}</span><strong>{formatNumber(grades.find((entry) => entry.matriculaId === item.id)?.valor ?? null)}</strong></div>)}</div>{teacher && <><form className="action-form" onSubmit={(event) => { event.preventDefault(); const value = Number(grade.replace(',', '.')); if (Number.isFinite(value) && value >= 0 && value <= assessment.notaMaxima) onSave(enrollment, value); }}><label>Estudante<select required value={enrollment} onChange={(event) => setEnrollment(event.target.value)}><option value="">Selecione</option>{snapshot.matriculas.map((item) => <option key={item.id} value={item.id}>{item.aluno.nome}</option>)}</select></label><label>Nota<input required type="number" min="0" max={assessment.notaMaxima} step="any" value={grade} onChange={(event) => setGrade(event.target.value)} /></label><button type="submit" className="secondary-button" disabled={busy}>Salvar nota</button></form>{!assessment.publicada && <button type="button" className="text-button publish-button" onClick={onPublish} disabled={busy}>Publicar notas</button>}</>}</div>}</details>;
}

export function SecretaryPage({ route, navigate }: { route: string; navigate: (path: string) => void }) {
  const { request } = useSession();
  const [classes, setClasses] = useState<{ id: string; nome: string; curso: string; periodo: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => { let active = true; setLoading(true); request<typeof classes>('/turmas').then((items) => { if (active) setClasses(items); }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar as turmas.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [request, revision]);
  const home = route === '/';
  return <>
    <div className="page-heading"><div><p className="section-label">Secretaria acadêmica</p><h1>{home ? 'Visão da secretaria' : 'Turmas da instituição'}</h1><p>{home ? 'Acesso aos cadastros e à estrutura acadêmica.' : 'Consulte as turmas cadastradas na instituição.'}</p></div></div>
    <StateMessage loading={loading} error={error} retry={() => setRevision((value) => value + 1)} />
    {!loading && !error && <>
      {home && <><div className="metrics"><Metric label="Turmas cadastradas" value={String(classes.length)} detail="na instituição" /></div><Panel title="Rotinas da secretaria"><div className="rows"><button type="button" className="row-button" onClick={() => navigate('/pessoas')}><span className="row-copy"><strong>Pessoas</strong><small>Consulte estudantes e demais usuários permitidos</small></span><span className="row-end">Abrir</span></button><button type="button" className="row-button" onClick={() => navigate('/turmas')}><span className="row-copy"><strong>Turmas</strong><small>Consulte a estrutura acadêmica cadastrada</small></span><span className="row-end">Abrir</span></button></div></Panel></>}
      <Panel title={home ? 'Turmas recentes' : 'Turmas'}>{classes.length ? <div className="rows">{(home ? classes.slice(0, 5) : classes).map((item) => <button type="button" className="row-button" key={item.id} onClick={() => navigate(`/turmas/${item.id}`)}><span className="row-symbol">{item.nome.slice(0, 2).toUpperCase()}</span><span className="row-copy"><strong>{item.nome}</strong><small>{item.curso} · {item.periodo}</small></span><span className="row-end">Abrir</span></button>)}</div> : <Empty title="Nenhuma turma" detail="As turmas cadastradas aparecem aqui." />}</Panel>
    </>}
  </>;
}
