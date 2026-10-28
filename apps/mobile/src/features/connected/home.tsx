import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSession } from '@/auth/session';
import { Screen } from '@/components/primitives';
import { AcademicHeader, Panel, PanelTitle, Stat, academicStyles } from '@/demo/academic-ui';
import { DataNotice, RequestState } from './ui';
import { summarizeEnrollments, useAcademicOverview } from './overview';

export function ConnectedHome() {
  const { state } = useSession();
  const router = useRouter();
  const overview = useAcademicOverview();
  const student = state.status === 'signedIn' && state.user.perfil === 'ALUNO';
  const tutor = state.status === 'signedIn' && state.user.perfil === 'TUTOR';
  const data = overview.data;
  const stats = summarizeEnrollments(data?.enrollments ?? []);
  const pending = data?.classes.flatMap((item) => item.snapshot.atividades.filter((activity) => activity.estado === 'PUBLICADA' && Date.parse(activity.prazo) > Date.now() && !item.snapshot.entregas.some((delivery) => delivery.atividadeId === activity.id)).map((activity) => ({ ...activity, className: item.name }))) ?? [];
  const drafts = data?.classes.reduce((count, item) => count + item.snapshot.avaliacoes.filter((assessment) => !assessment.publicada).length, 0) ?? 0;
  const corrections = data?.classes.reduce((count, item) => count + item.snapshot.entregas.filter((delivery) => !delivery.corrigidaEm).length, 0) ?? 0;
  return <Screen><AcademicHeader title={student ? 'Meu desempenho' : tutor ? 'Acompanhamento' : 'Painel do professor'} subtitle={student ? 'Acompanhamento acadêmico individual' : 'Suas turmas e tarefas acadêmicas em um só lugar.'} />
    <DataNotice>Dados registrados na API. Indicadores ausentes permanecem sem valor; não há previsão de abandono validada para as Fatecs.</DataNotice>
    <RequestState loading={overview.loading} error={overview.error} onRetry={overview.refresh} />
    {data && <>
      {student ? <View style={academicStyles.grid}>
        <Stat label="Média publicada" value={stats.meanGrade?.toFixed(1).replace('.', ',') ?? '—'} />
        <Stat label="Presença registrada" value={stats.meanAttendance === null ? '—' : `${stats.meanAttendance.toFixed(0)}%`} />
        <Stat label="Turmas vinculadas" value={String(data.classes.length)} />
        <Stat label="Atividades pendentes" value={String(pending.length)} />
      </View> : <View style={academicStyles.grid}>
        <Stat label="Turmas vinculadas" value={String(data.classes.length)} />
        <Stat label="Matrículas visíveis" value={String(data.enrollments.length)} />
        <Stat label="Avaliações não publicadas" value={String(drafts)} />
        <Stat label="Entregas para corrigir" value={String(corrections)} />
      </View>}
      <Panel><PanelTitle>{student ? 'Minhas disciplinas' : 'Minhas turmas'}</PanelTitle>
        {data.classes.length ? data.classes.flatMap((item) => student ? item.snapshot.disciplinas.map((subject) => ({ id: subject.id, title: subject.nome, subtitle: `${item.course} · ${item.name}`, classId: item.id })) : [{ id: item.id, title: item.name, subtitle: `${item.course} · ${item.period}`, classId: item.id }]).slice(0, 5).map((item) => <View key={item.id} style={academicStyles.row}><View style={{ flex: 1 }}><Text style={academicStyles.strong}>{item.title}</Text><Text style={academicStyles.meta}>{item.subtitle}</Text></View><Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/connected/class/[id]', params: { id: item.classId } })}><Text style={academicStyles.link}>Detalhes</Text></Pressable></View>) : <Text style={academicStyles.meta}>Nenhuma turma vinculada.</Text>}
      </Panel>
      {student ? <>
        <Panel><PanelTitle>Próximas entregas</PanelTitle>{pending.length ? pending.slice(0, 3).map((item) => <Text key={item.id} style={academicStyles.meta}>{item.titulo} · {item.className} · {new Date(item.prazo).toLocaleDateString('pt-BR')}</Text>) : <Text style={academicStyles.meta}>Nenhuma entrega pendente.</Text>}</Panel>
        <Panel><PanelTitle>Minha situação</PanelTitle><Text style={academicStyles.meta}>Conte sobre seu ingresso em linguagem comum. As respostas são vinculadas à sua matrícula.</Text><Pressable accessibilityRole="button" onPress={() => router.push('/connected/report')}><Text style={academicStyles.link}>Abrir formulário →</Text></Pressable></Panel>
      </> : <Panel><PanelTitle>Acesso rápido</PanelTitle><View style={academicStyles.chips}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/connected/classes')}><Text style={academicStyles.link}>Minhas turmas</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push('/connected/attendance')}><Text style={academicStyles.link}>Chamada</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push('/connected/grades')}><Text style={academicStyles.link}>Notas</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push('/connected/people')}><Text style={academicStyles.link}>Estudantes vinculados</Text></Pressable>
      </View></Panel>}
    </>}
  </Screen>;
}
