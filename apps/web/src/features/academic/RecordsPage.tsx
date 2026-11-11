import { useSession } from '../../auth/Session';
import { Empty, Metric, Panel, formatDate, formatNumber } from '../../components/UI';
import type { AcademicSnapshot } from '../../services/contracts';
import type { ClassView, Overview } from './overview-model';

interface RecordsPageProps { data: Overview; kind: 'frequencia' | 'notas'; navigate: (path: string) => void }

function StudentRecords({ classes, kind, userId }: { classes: ClassView[]; kind: RecordsPageProps['kind']; userId: string }) {
  const rows = classes.flatMap((item) => {
    const enrollment = item.snapshot.matriculas.find((value) => value.alunoId === userId);
    if (!enrollment) return [];
    if (kind === 'frequencia') return item.snapshot.aulas.map((lesson) => ({
      id: `${item.id}:${lesson.id}`,
      title: lesson.tema,
      detail: `${item.name} · ${formatDate(lesson.data)}`,
      value: attendanceLabel(item.snapshot, lesson.id, enrollment.id),
    }));
    return item.snapshot.avaliacoes.filter((assessment) => assessment.publicada).map((assessment) => ({
      id: `${item.id}:${assessment.id}`,
      title: assessment.titulo,
      detail: `${item.name} · ${formatDate(assessment.data)}`,
      value: gradeLabel(item.snapshot, assessment.id, enrollment.id, assessment.notaMaxima),
    }));
  });
  return <Panel title={kind === 'frequencia' ? 'Minhas presenças e faltas' : 'Minhas avaliações publicadas'}>{rows.length ? <div className="rows">{rows.map((row) => <div className="plain-row" key={row.id}><span className="row-copy"><strong>{row.title}</strong><small>{row.detail}</small></span><span className="status record-value">{row.value}</span></div>)}</div> : <Empty title="Nenhum registro disponível" detail={kind === 'frequencia' ? 'Suas presenças aparecem após o registro da chamada.' : 'Suas notas aparecem após a publicação da avaliação.'} />}</Panel>;
}

function attendanceLabel(snapshot: AcademicSnapshot, lessonId: string, enrollmentId: string) {
  const status = snapshot.presencas.find((value) => value.aulaId === lessonId && value.matriculaId === enrollmentId)?.situacao;
  return status === 'PRESENTE' ? 'Presente' : status === 'FALTA' ? 'Falta' : status === 'FALTA_JUSTIFICADA' ? 'Falta justificada' : 'Sem registro';
}

function gradeLabel(snapshot: AcademicSnapshot, assessmentId: string, enrollmentId: string, maximum: number) {
  const grade = snapshot.notas.find((value) => value.avaliacaoId === assessmentId && value.matriculaId === enrollmentId)?.valor;
  return grade === undefined ? 'Sem nota' : `${formatNumber(grade)} / ${formatNumber(maximum)}`;
}

export function RecordsPage({ data, kind, navigate }: RecordsPageProps) {
  const { session } = useSession();
  const role = session!.user.perfil;
  const student = role === 'ALUNO';
  const teacher = role === 'PROFESSOR';
  const title = kind === 'frequencia' ? student ? 'Minha frequência' : teacher ? 'Chamada' : 'Frequência dos vinculados' : student ? 'Minhas notas' : teacher ? 'Notas das turmas' : 'Notas dos vinculados';
  const description = student ? 'Registros acadêmicos vinculados à sua matrícula.' : teacher ? 'Abra uma turma para consultar e registrar os dados da sua disciplina.' : 'Consulta dos registros dos estudantes vinculados à tutoria.';
  const total = data.classes.reduce((count, item) => count + (kind === 'frequencia' ? item.snapshot.aulas.length : item.snapshot.avaliacoes.length), 0);
  return <>
    <div className="page-heading"><div><p className="section-label">{student ? 'Área do estudante' : teacher ? 'Docência' : 'Tutoria'}</p><h1>{title}</h1><p>{description}</p></div></div>
    {student ? <StudentRecords classes={data.classes} kind={kind} userId={session!.user.id} /> : <>
      <div className="metrics"><Metric label="Turmas vinculadas" value={String(data.classes.length)} /><Metric label={kind === 'frequencia' ? 'Aulas registradas' : 'Avaliações'} value={String(total)} /><Metric label="Estudantes vinculados" value={String(data.enrollments.length)} /></div>
      <Panel title="Por turma">{data.classes.length ? <div className="rows">{data.classes.map((item) => {
        const records = kind === 'frequencia' ? item.snapshot.aulas.length : item.snapshot.avaliacoes.length;
        return <button type="button" className="row-button" key={item.id} onClick={() => navigate(`/turmas/${item.id}`)}><span className="row-symbol">{item.name.slice(0, 2).toUpperCase()}</span><span className="row-copy"><strong>{item.name}</strong><small>{records} {kind === 'frequencia' ? records === 1 ? 'aula' : 'aulas' : records === 1 ? 'avaliação' : 'avaliações'} · {item.course}</small></span><span className="row-end">{teacher ? 'Abrir para lançar' : 'Consultar'}</span></button>;
      })}</div> : <Empty title="Nenhuma turma vinculada" detail="As turmas disponíveis para sua conta aparecerão aqui." />}</Panel>
    </>}
  </>;
}
