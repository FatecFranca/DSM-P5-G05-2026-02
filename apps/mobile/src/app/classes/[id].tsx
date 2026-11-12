import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/auth/session';
import { canUseAdmin, homeForRole } from '@/auth/roles';
import { Screen, SectionTitle } from '@/components/primitives';
import { TopBar, useGoBack } from '@/components/top-bar';
import { palette } from '@/constants/design';
import { demoClasses, studentsInClass, summarize } from '@/demo/data';
import { Bar, Card, classColor, DemoBanner, Metric, StudentRow } from '@/demo/ui';

export default function ClassDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { state } = useSession();
  const goBack = useGoBack('/classes');
  const item = demoClasses.find((value) => value.id === id);
  if (state.status !== 'signedIn') return null;
  if (!canUseAdmin(state.user.perfil)) return <Redirect href={homeForRole(state.user.perfil)} />;
  if (!item) return <Screen><TopBar onBack={goBack} /><Text style={styles.heading}>Turma não encontrada.</Text></Screen>;
  const showRisk = true;
  const students = studentsInClass(item.id);
  const summary = summarize(students);
  return <Screen>
    <TopBar onBack={goBack} />
    <SectionTitle eyebrow="ANÁLISE DA TURMA" title={item.name} /><DemoBanner />
    <View style={styles.metrics}><Metric label="Estudantes" value={String(summary.count)} /><Metric label="Média acadêmica" value={summary.academicAverage?.toFixed(1) ?? '—'} />{showRisk ? <Metric label="Faixa alta ilustrativa" value={String(summary.highRiskCount)} /> : null}</View>
    {showRisk ? <Card><Text style={styles.heading}>Distribuição estimada</Text>{(['Dropout', 'Enrolled', 'Graduate'] as const).map((key) => <Bar key={key} label={key} value={summary.count ? summary.distributions[key] / summary.count : 0} color={classColor[key]} />)}</Card> : null}
    <Text style={styles.heading}>Estudantes</Text>{students.map((student) => <StudentRow key={student.id} student={student} showRisk={showRisk} onPress={() => router.push({ pathname: '/students/[id]', params: { id: student.id } })} />)}
  </Screen>;
}

const styles = StyleSheet.create({ heading: { color: palette.ink, fontSize: 17, fontWeight: '700' }, metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } });
