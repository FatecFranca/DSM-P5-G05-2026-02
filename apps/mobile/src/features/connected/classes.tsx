import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useSession } from '@/auth/session';
import { Screen, TextButton } from '@/components/primitives';
import { AcademicHeader, ActionButton, Avatar, EmptyState, ListRow, Panel, RowList, formatAcademicNumber } from '@/demo/academic-ui';
import { Editor, type EditorConfig } from '@/features/academic/editor';
import { RequestState } from './ui';
import { summarizeEnrollments, useAcademicOverview } from './overview';

/** Período letivo sugerido para a turma nova: ano e semestre corrente (2026/2). */
function currentPeriod(date = new Date()): string {
  return `${date.getFullYear()}/${date.getMonth() < 6 ? 1 : 2}`;
}

/** Turmas: cada uma abre a equipe da turma, com publicações, tarefas, notas, frequência e arquivos. */
export function ConnectedClasses() {
  const router = useRouter();
  const { state, request } = useSession();
  const overview = useAcademicOverview();
  const [creating, setCreating] = useState(false);
  const student = state.status === 'signedIn' && state.user.perfil === 'ALUNO';
  const manager = state.status === 'signedIn' && state.user.perfil === 'COORDENACAO';
  // Cada perfil tem uma saída diferente: só a coordenação cria turmas.
  const emptyDetail = student ? 'Você ainda não está matriculado em nenhuma turma. Procure a secretaria da sua Fatec.'
    : manager ? 'Crie a primeira turma e depois monte-a: disciplinas, docentes e estudantes.'
      : 'Você ainda não está vinculado a nenhuma turma. O vínculo é feito pela coordenação.';
  // Depois de criar, a coordenação cai direto na montagem da turma: o próximo passo é vincular pessoas.
  const createConfig: EditorConfig = {
    title: 'Nova turma',
    fields: [
      { key: 'nome', label: 'Nome da turma (ex.: DSM 5º semestre)' },
      { key: 'curso', label: 'Curso' },
      { key: 'periodo', label: 'Período letivo', initial: currentPeriod() },
    ],
    submit: async (values) => {
      const created = await request<{ id: string }>('/turmas', { method: 'POST', body: { nome: values.nome.trim(), curso: values.curso.trim(), periodo: values.periodo.trim() } });
      overview.refresh();
      router.push({ pathname: '/connected/class/[id]', params: { id: created.id, secao: 'pessoas' } });
    },
  };
  return <Screen>
    <AcademicHeader back fallbackHref="/connected" title="Turmas" subtitle="Cada turma reúne publicações, tarefas, notas, frequência e arquivos" />
    {manager && !creating && overview.data?.classes.length ? <ActionButton compact title="Nova turma" onPress={() => setCreating(true)} /> : null}
    {manager && creating ? <Editor config={createConfig} close={() => setCreating(false)} /> : null}
    <RequestState loading={overview.loading} error={overview.error} onRetry={overview.refresh} />
    {overview.data ? <>
      {overview.data.classes.length ? <Panel>
        <RowList>{overview.data.classes.map((item) => {
          const summary = summarizeEnrollments(overview.data!.enrollments.filter((entry) => entry.classId === item.id));
          const detail = student
            ? item.snapshot.disciplinas.map((subject) => subject.nome).join(' · ')
            : `${summary.count} ${summary.count === 1 ? 'estudante' : 'estudantes'} · média ${formatAcademicNumber(summary.meanGrade)} · presença ${summary.meanAttendance === null ? '—' : `${summary.meanAttendance.toFixed(0)}%`}`;
          return <ListRow
            key={item.id}
            leading={<Avatar name={item.name} label={item.name.split(' ')[0]} square />}
            title={item.name}
            meta={`${item.course}${item.closed ? ' · período fechado' : ''}${detail ? `\n${detail}` : ''}`}
            onPress={() => router.push({ pathname: '/connected/class/[id]', params: { id: item.id } })} />;
        })}</RowList>
      </Panel> : <EmptyState title="Nenhuma turma disponível" detail={emptyDetail} action={manager && !creating ? <ActionButton compact title="Nova turma" onPress={() => setCreating(true)} /> : undefined} />}
      {student ? null : <TextButton title="Abrir gestão acadêmica" onPress={() => router.push('/workspace')} />}
      <TextButton title="Atualizar turmas" onPress={overview.refresh} />
    </> : null}
  </Screen>;
}
