import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text } from 'react-native';
import { useSession } from '@/auth/session';
import { Screen } from '@/components/primitives';
import { AcademicHeader, ActionButton, Badge, EmptyState, Feedback, ListRow, Panel, PanelHeader, RowList, SegmentTabs, TypeIcon, academicStyles } from '@/demo/academic-ui';
import { saveFile } from '@/features/academic/files';
import type { AcademicFile, AcademicSnapshot } from '@/services/academic';
import { useAvisos } from './activity';
import { EventGroups } from './activity-screen';
import { TaskList, buildTaskRows, type TaskRow } from './assignments';
import { ClassParticipants, type Indicators } from './class-participants';
import { formatFileSize } from './collaboration';
import { AttendanceRecords, GradesRecords, OwnIndicators } from './records';
import { RequestState } from './ui';
import { useNow } from './use-now';

type Section = 'posts' | 'tasks' | 'grades' | 'attendance' | 'files' | 'people';

const sectionLabels: Record<Section, string> = {
  posts: 'Publicações', tasks: 'Tarefas', grades: 'Notas', attendance: 'Frequência', files: 'Arquivos', people: 'Pessoas',
};

/** Ordem de leitura para o estudante: o que pede ação primeiro, o que já terminou por último. */
const stateRank: Record<TaskRow['state'], number> = { assigned: 0, late: 1, submitted: 2, graded: 3 };

function ClassPosts({ turmaId }: { turmaId: string }) {
  const feed = useAvisos(turmaId);
  return <>
    <RequestState loading={feed.loading} error={feed.error} onRetry={feed.refresh} />
    {!feed.loading && !feed.error && !feed.items.length
      ? <EmptyState title="Nenhuma publicação ainda" detail="Tarefas, notas, materiais e aulas desta turma aparecem aqui conforme forem registrados." />
      : null}
    {!feed.loading && !feed.error ? <EventGroups items={feed.items} /> : null}
    {!feed.loading && !feed.error && feed.hasMore ? <ActionButton secondary title={feed.loadingMore ? 'Carregando…' : 'Carregar mais'} disabled={feed.loadingMore} onPress={() => void feed.loadMore()} /> : null}
  </>;
}

/** Arquivos da turma: os materiais publicados pelas disciplinas, com tamanho e download pela API. */
function ClassFiles({ snapshot }: { snapshot: AcademicSnapshot }) {
  const { request } = useSession();
  const [error, setError] = useState('');
  async function download(file: AcademicFile) {
    setError('');
    try { await saveFile(file, await request<ArrayBuffer>(`/arquivos/${file.id}`, { binary: true })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível baixar o arquivo.'); }
  }
  if (!snapshot.materiais.length) return <EmptyState title="Nenhum arquivo" detail="Os materiais que o docente publicar nas disciplinas desta turma ficam aqui." />;
  return <Panel>
    <PanelHeader title={`${snapshot.materiais.length} ${snapshot.materiais.length === 1 ? 'arquivo' : 'arquivos'}`} />
    <RowList>{snapshot.materiais.map((material) => <ListRow
      key={material.id}
      leading={<TypeIcon name="folder" />}
      title={material.titulo}
      meta={`${snapshot.disciplinas.find((item) => item.id === material.disciplinaId)?.nome ?? 'Disciplina'} · ${material.arquivo.nome} · ${formatFileSize(material.arquivo.tamanho)}`}
      onPress={() => void download(material.arquivo)} />)}</RowList>
    {error ? <Feedback error message={error} /> : null}
  </Panel>;
}

/** Média das notas por matrícula, para a lista de estudantes mostrar o número ao lado do nome. */
function indicatorsOf(snapshot: AcademicSnapshot): Indicators {
  return Object.fromEntries(snapshot.indicadores.map((value) => [value.matriculaId, { media: value.media, frequencia: value.frequencia }]));
}

/**
 * Equipe da turma: um lugar para tudo da turma, como o canal de uma equipe no Teams. As seções
 * reaproveitam os mesmos registros das telas por assunto, só que recortados pela turma aberta.
 */
export function ConnectedClassTeam() {
  const { id, secao } = useLocalSearchParams<{ id: string; secao?: string }>();
  const router = useRouter();
  const { state, request } = useSession();
  const [snapshot, setSnapshot] = useState<AcademicSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  // `secao=pessoas` abre direto a montagem da turma (depois de criar uma turma nova, por exemplo).
  const [section, setSection] = useState<Section>(secao === 'pessoas' ? 'people' : 'posts');
  const perfil = state.status === 'signedIn' ? state.user.perfil : null;
  const student = perfil === 'ALUNO';

  useEffect(() => {
    let active = true;
    void request<AcademicSnapshot>(`/academico/resumo?turmaId=${encodeURIComponent(id)}`)
      .then((value) => { if (active) { if (value.truncated) throw new Error('A consulta da turma está incompleta.'); setSnapshot(value); setError(''); } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar a turma.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, reload, request]);

  const selected = snapshot?.turmas.find((item) => item.id === id);
  const now = useNow();
  const rows = useMemo(() => selected && snapshot
    ? buildTaskRows([{ id: selected.id, name: selected.nome, snapshot }], student, now).sort((a, b) => stateRank[a.state] - stateRank[b.state] || Date.parse(a.activity.prazo) - Date.parse(b.activity.prazo))
    : [], [selected, snapshot, student, now]);

  const pending = student ? rows.filter((row) => row.state === 'assigned' || row.state === 'late').length : rows.reduce((sum, row) => sum + row.summary.toGrade, 0);
  const sections: Section[] = student ? ['posts', 'tasks', 'grades', 'attendance', 'files'] : ['posts', 'tasks', 'grades', 'attendance', 'files', 'people'];
  const gradeCount = snapshot?.avaliacoes.filter((value) => !student || value.publicada).length ?? 0;

  return <Screen>
    <AcademicHeader back fallbackHref="/connected/classes" title={selected?.nome ?? 'Turma'} subtitle={selected ? `${selected.curso} · ${selected.periodo}` : undefined} />
    {selected?.fechada ? <Badge text="Período fechado" tone="neutral" /> : null}
    <RequestState loading={loading} error={error} onRetry={() => { setLoading(true); setError(''); setSnapshot(null); setReload((value) => value + 1); }} />
    {!loading && !error && !selected ? <EmptyState title="Turma não encontrada" detail="Ela pode ter sido removida ou você não tem acesso a ela." /> : null}
    {selected && snapshot && !error ? <>
      <SegmentTabs label="Seções da turma" selected={section} onSelect={setSection} items={sections.map((key) => ({ key, label: sectionLabels[key], count: key === 'tasks' ? pending : undefined }))} />
      {section === 'posts' ? <ClassPosts turmaId={selected.id} /> : null}
      {section === 'tasks' ? (rows.length
        ? <Panel><TaskList rows={rows} student={student} now={now} onOpen={(row) => router.push({ pathname: '/connected/assignment/[id]', params: { id: row.activity.id, turmaId: row.classId } })} /></Panel>
        : <EmptyState title="Nenhuma tarefa" detail="As atividades publicadas nesta turma aparecem aqui." />) : null}
      {section === 'grades' ? (gradeCount
        ? <Panel><PanelHeader title="Notas" />{student ? <OwnIndicators snapshot={snapshot} show="media" /> : null}<GradesRecords snapshot={snapshot} student={student} />{gradeCount > 20 ? <Text style={academicStyles.meta}>Mostrando as 20 primeiras avaliações.</Text> : null}</Panel>
        : <EmptyState title="Nenhuma nota" detail={student ? 'As notas publicadas pelo docente aparecem aqui.' : 'Crie uma avaliação para lançar notas.'} />) : null}
      {section === 'attendance' ? (snapshot.aulas.length
        ? <Panel><PanelHeader title="Frequência" />{student ? <OwnIndicators snapshot={snapshot} show="frequencia" /> : null}<AttendanceRecords snapshot={snapshot} student={student} />{snapshot.aulas.length > 20 ? <Text style={academicStyles.meta}>Mostrando as 20 primeiras aulas.</Text> : null}</Panel>
        : <EmptyState title="Nenhuma aula registrada" detail="As aulas e chamadas desta turma aparecem aqui." />) : null}
      {section === 'files' ? <ClassFiles snapshot={snapshot} /> : null}
      {section === 'people' && !student ? <ClassParticipants
        key={selected.id}
        turmaId={selected.id}
        indicators={indicatorsOf(snapshot)}
        openPerson={perfil === 'COORDENACAO' || perfil === 'PROFESSOR' || perfil === 'TUTOR' ? (userId) => router.push({ pathname: '/person/[id]', params: { id: userId } }) : undefined}
        goToPeople={perfil === 'COORDENACAO' ? () => router.push('/connected/people') : undefined}
        onChanged={() => setReload((value) => value + 1)} /> : null}
    </> : null}
  </Screen>;
}
