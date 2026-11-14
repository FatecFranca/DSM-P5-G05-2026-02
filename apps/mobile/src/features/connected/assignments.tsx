import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useSession } from '@/auth/session';
import { Screen } from '@/components/primitives';
import { AcademicHeader, ActionButton, EmptyState, ListRow, Panel, RowList, SegmentTabs, formatAcademicNumber } from '@/demo/academic-ui';
import type { AcademicSnapshot } from '@/services/academic';
import { assignmentState, capitalize, deliverySummary, isDueSoon, relativeDay, type AssignmentState, type DeliverySummary } from './collaboration';
import { useAcademicOverview, type ClassView } from './overview';
import { RequestState } from './ui';
import { useNow } from './use-now';

export type Activity = AcademicSnapshot['atividades'][number];
export type Delivery = AcademicSnapshot['entregas'][number];

export interface TaskRow {
  activity: Activity;
  classId: string;
  className: string;
  subject: string;
  delivery?: Delivery;
  state: AssignmentState;
  summary: DeliverySummary;
}

/** Uma linha por atividade visível. Estudante só vê publicadas, e a entrega que existe no recorte é a dele. */
export function buildTaskRows(classes: Pick<ClassView, 'id' | 'name' | 'snapshot'>[], student: boolean, now: number): TaskRow[] {
  return classes.flatMap((item) => item.snapshot.atividades
    .filter((activity) => !student || activity.estado === 'PUBLICADA')
    .map((activity) => {
      const delivery = item.snapshot.entregas.find((entry) => entry.atividadeId === activity.id);
      return {
        activity, classId: item.id, className: item.name,
        subject: item.snapshot.disciplinas.find((value) => value.id === activity.disciplinaId)?.nome ?? 'Disciplina',
        delivery,
        state: assignmentState(activity, delivery, now),
        summary: deliverySummary(item.snapshot.entregas, activity.id, item.snapshot.matriculas.length),
      };
    }));
}

type StudentTab = 'assigned' | 'late' | 'done';
type TeacherTab = 'grade' | 'published' | 'draft';

const byDue = (a: TaskRow, b: TaskRow) => Date.parse(a.activity.prazo) - Date.parse(b.activity.prazo);
const latestFirst = (a: TaskRow, b: TaskRow) => Date.parse(b.activity.prazo) - Date.parse(a.activity.prazo);

/** Uma linha de tarefa, no vocabulário do Teams: o estado vem no selo e o prazo, em dias. */
export function TaskList({ rows, student, now, onOpen }: { rows: TaskRow[]; student: boolean; now: number; onOpen: (row: TaskRow) => void }) {
  return <RowList>{rows.map((row) => {
    const { activity, delivery, summary } = row;
    const where = `${row.subject} · ${row.className}`;
    if (!student) {
      return <ListRow key={activity.id} title={activity.titulo} onPress={() => onOpen(row)}
        meta={activity.estado === 'RASCUNHO' ? `${where} · ainda não publicada` : `${where} · ${summary.delivered} de ${summary.total} entregaram`}
        badge={activity.estado === 'RASCUNHO' ? { text: 'Rascunho', tone: 'neutral' } : summary.toGrade > 0 ? { text: `${summary.toGrade} para corrigir`, tone: 'attention' } : { text: 'Em dia', tone: 'ok' }} />;
    }
    if (row.state === 'graded') {
      return <ListRow key={activity.id} title={activity.titulo} onPress={() => onOpen(row)}
        meta={`${row.subject} · corrigida ${relativeDay(delivery!.corrigidaEm!, now)} · máx. ${formatAcademicNumber(activity.notaMaxima)}`}
        value={formatAcademicNumber(delivery!.nota)} />;
    }
    if (row.state === 'submitted') {
      return <ListRow key={activity.id} title={activity.titulo} onPress={() => onOpen(row)} meta={`${row.subject} · enviada ${relativeDay(delivery!.enviadaEm, now)}, aguardando correção`} badge={{ text: 'Enviada', tone: 'neutral' }} />;
    }
    if (row.state === 'late') {
      return <ListRow key={activity.id} title={activity.titulo} onPress={() => onOpen(row)} meta={`${row.subject} · prazo ${relativeDay(activity.prazo, now)}`} badge={{ text: 'Atrasada', tone: 'danger' }} />;
    }
    return <ListRow key={activity.id} title={activity.titulo} onPress={() => onOpen(row)} meta={where}
      badge={{ text: capitalize(relativeDay(activity.prazo, now)), tone: isDueSoon(activity.prazo, now) ? 'attention' : 'neutral' }} />;
  })}</RowList>;
}

const emptyText: Record<StudentTab | TeacherTab, { title: string; detail: string }> = {
  assigned: { title: 'Nenhuma tarefa pendente', detail: 'Tarefas novas aparecem aqui quando o docente publicar.' },
  late: { title: 'Nada atrasado', detail: 'Você não tem tarefas com prazo vencido e sem entrega.' },
  done: { title: 'Nenhuma entrega ainda', detail: 'Tarefas enviadas e corrigidas ficam aqui.' },
  grade: { title: 'Nada para corrigir', detail: 'Quando alguém entregar, a tarefa aparece aqui.' },
  published: { title: 'Nenhuma atividade publicada', detail: 'Publique uma atividade para os estudantes a verem.' },
  draft: { title: 'Sem rascunhos', detail: 'Atividades ainda não publicadas ficam aqui.' },
};

/** Tarefas: abas Atribuídas / Atrasadas / Concluídas para o estudante e Para corrigir / Publicadas / Rascunhos para a docência. */
export function ConnectedAssignments() {
  const router = useRouter();
  const { state } = useSession();
  const overview = useAcademicOverview();
  const student = state.status === 'signedIn' && state.user.perfil === 'ALUNO';
  const professor = state.status === 'signedIn' && state.user.perfil === 'PROFESSOR';
  const [studentTab, setStudentTab] = useState<StudentTab>('assigned');
  const [teacherTab, setTeacherTab] = useState<TeacherTab>('grade');
  const now = useNow();
  const rows = useMemo(() => overview.data ? buildTaskRows(overview.data.classes, student, now) : [], [overview.data, student, now]);

  const studentGroups: Record<StudentTab, TaskRow[]> = {
    assigned: rows.filter((row) => row.state === 'assigned').sort(byDue),
    late: rows.filter((row) => row.state === 'late').sort(latestFirst),
    done: rows.filter((row) => row.state === 'submitted' || row.state === 'graded').sort((a, b) => Date.parse(b.delivery!.enviadaEm) - Date.parse(a.delivery!.enviadaEm)),
  };
  const teacherGroups: Record<TeacherTab, TaskRow[]> = {
    grade: rows.filter((row) => row.activity.estado !== 'RASCUNHO' && row.summary.toGrade > 0).sort((a, b) => b.summary.toGrade - a.summary.toGrade),
    published: rows.filter((row) => row.activity.estado !== 'RASCUNHO').sort(latestFirst),
    draft: rows.filter((row) => row.activity.estado === 'RASCUNHO'),
  };
  const tab = student ? studentTab : teacherTab;
  const current = student ? studentGroups[studentTab] : teacherGroups[teacherTab];
  const open = (row: TaskRow) => router.push({ pathname: '/connected/assignment/[id]', params: { id: row.activity.id, turmaId: row.classId } });

  return <Screen>
    <AcademicHeader back fallbackHref="/connected" title="Tarefas" subtitle={student ? 'O que entregar, o que atrasou e o que já foi corrigido' : 'Entregas para corrigir e atividades das suas turmas'} />
    {rows.length ? (student
      ? <SegmentTabs label="Situação das tarefas" selected={studentTab} onSelect={setStudentTab} items={[
        { key: 'assigned', label: 'Atribuídas', count: studentGroups.assigned.length }, { key: 'late', label: 'Atrasadas', count: studentGroups.late.length }, { key: 'done', label: 'Concluídas' }]} />
      : <SegmentTabs label="Situação das atividades" selected={teacherTab} onSelect={setTeacherTab} items={[
        { key: 'grade', label: 'Para corrigir', count: teacherGroups.grade.length }, { key: 'published', label: 'Publicadas' }, { key: 'draft', label: 'Rascunhos', count: teacherGroups.draft.length }]} />) : null}
    <RequestState loading={overview.loading} error={overview.error} onRetry={overview.refresh} />
    {overview.data ? (!rows.length
      ? <EmptyState title="Nenhuma tarefa ainda" detail={student ? 'Quando o docente publicar uma atividade, ela aparece aqui.' : 'Crie uma atividade para os estudantes a verem.'} />
      : current.length
        ? <Panel><TaskList rows={current} student={student} now={now} onOpen={open} /></Panel>
        : <EmptyState title={emptyText[tab].title} detail={emptyText[tab].detail} />) : null}
    {professor && overview.data ? <ActionButton secondary title="Criar ou gerenciar atividades" onPress={() => router.push({ pathname: '/workspace', params: { secao: 'Atividades' } })} /> : null}
  </Screen>;
}
