import { useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { useSession } from '@/auth/session';
import { Screen } from '@/components/primitives';
import { AcademicHeader, ActionButton, ListRow, Panel, PanelHeader, PanelTitle, RowList, academicStyles, pendingBadge } from '@/demo/academic-ui';
import { DataNotice, RequestState } from './ui';
import { useAcademicOverview } from './overview';

export function ConnectedHome() {
  const { state } = useSession();
  const router = useRouter();
  const overview = useAcademicOverview();
  const student = state.status === 'signedIn' && state.user.perfil === 'ALUNO';
  const tutor = state.status === 'signedIn' && state.user.perfil === 'TUTOR';
  const data = overview.data;
  const pending = data?.classes.flatMap((item) => item.snapshot.atividades.filter((activity) => activity.estado === 'PUBLICADA' && Date.parse(activity.prazo) > Date.now() && !item.snapshot.entregas.some((delivery) => delivery.atividadeId === activity.id)).map((activity) => ({ ...activity, className: item.name, classId: item.id }))) ?? [];
  const drafts = data?.classes.reduce((count, item) => count + item.snapshot.avaliacoes.filter((assessment) => !assessment.publicada).length, 0) ?? 0;
  const corrections = data?.classes.reduce((count, item) => count + item.snapshot.entregas.filter((delivery) => !delivery.corrigidaEm).length, 0) ?? 0;
  const rows = data?.classes.flatMap((item) => student
    ? item.snapshot.disciplinas.map((subject) => ({ id: subject.id, title: subject.nome, subtitle: `${item.course} · ${item.name}`, classId: item.id }))
    : [{ id: item.id, title: item.name, subtitle: `${item.course} · ${item.period}`, classId: item.id }]) ?? [];
  const openClass = (classId: string) => router.push({ pathname: '/connected/class/[id]', params: { id: classId } });

  return <Screen>
    <AcademicHeader title={student ? 'Meu desempenho' : tutor ? 'Acompanhamento' : 'Painel do professor'} subtitle={student ? 'Acompanhamento acadêmico individual' : data ? `${data.classes.length} ${data.classes.length === 1 ? 'turma' : 'turmas'} · ${data.enrollments.length} ${data.enrollments.length === 1 ? 'matrícula' : 'matrículas'}` : 'Suas turmas e tarefas acadêmicas em um só lugar.'} />
    <DataNotice>Dados acadêmicos registrados na API. As previsões da planilha Excel são consultadas pela coordenação nas análises individuais.</DataNotice>
    <RequestState loading={overview.loading} error={overview.error} onRetry={overview.refresh} />
    {student && <Panel><PanelTitle>Minhas mensalidades</PanelTitle><Text style={academicStyles.meta}>Consulte faturas, saldos e pagamentos da sua matrícula.</Text><ActionButton title="Ver mensalidades e simular pagamento" onPress={() => router.push('/connected/billing')} /></Panel>}
    {data && <>
      {student ? <>
        <Panel>
          <PanelHeader title="Próximas entregas" actionLabel="Atividades" onAction={() => router.push('/connected/assignments')} />
          {pending.length
            ? <RowList>{pending.slice(0, 3).map((item) => <ListRow key={item.id} title={item.titulo} meta={`${item.className} · prazo ${new Date(item.prazo).toLocaleDateString('pt-BR')}`} onPress={() => router.push({ pathname: '/connected/assignment/[id]', params: { id: item.id, turmaId: item.classId } })} />)}</RowList>
            : <Text style={academicStyles.meta}>Nenhuma entrega pendente.</Text>}
        </Panel>
        <Panel><PanelHeader title="Turmas vinculadas" /><RowList>{data.classes.map((item) => <ListRow key={item.id} title={item.name} meta={`${item.course} · ${item.period}`} onPress={() => openClass(item.id)} />)}</RowList></Panel>
      </> : <Panel>
        <PanelHeader title="Pendências" />
        <RowList>
          <ListRow title="Entregas para corrigir" meta="Atividades enviadas aguardando correção" badge={pendingBadge(corrections)} onPress={() => router.push('/connected/assignments')} />
          <ListRow title="Avaliações não publicadas" meta="Notas ainda não publicadas aos estudantes" badge={pendingBadge(drafts)} onPress={() => router.push('/connected/grades')} />
        </RowList>
      </Panel>}
      <Panel>
        <PanelHeader title={student ? 'Minhas disciplinas' : 'Minhas turmas'} actionLabel={student ? undefined : 'Ver todas'} onAction={student ? undefined : () => router.push('/connected/classes')} />
        {rows.length
          ? student ? rows.map((item) => <Pressable key={`${item.classId}:${item.id}`} accessibilityRole="button" accessibilityLabel={`Abrir disciplina ${item.title}`} onPress={() => router.push({ pathname: '/connected/subject/[id]', params: { id: item.id, classId: item.classId } })}><Panel><PanelTitle>{item.title}</PanelTitle><Text style={academicStyles.meta}>{item.subtitle}</Text><Text style={academicStyles.link}>Ver presença, faltas, notas e atividades →</Text></Panel></Pressable>)
            : <RowList>{rows.slice(0, 5).map((item) => <ListRow key={item.id} title={item.title} meta={item.subtitle} onPress={() => openClass(item.classId)} />)}</RowList>
          : <Text style={academicStyles.meta}>Nenhuma turma vinculada.</Text>}
      </Panel>
      {student ? <>
        <Panel>
          <PanelHeader title="Minha situação" />
          <RowList><ListRow title="Contar sobre meu ingresso" meta="Em linguagem comum. As respostas são vinculadas à sua matrícula." onPress={() => router.push('/connected/report')} /></RowList>
        </Panel>
      </> : <Panel>
        <PanelHeader title="Registrar e consultar" />
        <RowList>
          <ListRow title="Chamada" onPress={() => router.push('/connected/attendance')} />
          <ListRow title="Notas" onPress={() => router.push('/connected/grades')} />
          <ListRow title="Estudantes vinculados" onPress={() => router.push('/connected/people')} />
        </RowList>
      </Panel>}
    </>}
  </Screen>;
}
