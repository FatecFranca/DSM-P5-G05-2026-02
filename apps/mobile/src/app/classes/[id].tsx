import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/auth/session';
import { canUseAdmin, homeForRole } from '@/auth/roles';
import { Screen, SectionTitle } from '@/components/primitives';
import { palette } from '@/constants/design';
import { demoClasses, studentsInClass, summarize } from '@/demo/data';
import { Bar, Card, classColor, DemoBanner, Metric, StudentRow } from '@/demo/ui';

export default function ClassDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { state } = useSession();
  const item = demoClasses.find((value) => value.id === id);
  if (state.status !== 'signedIn') return null;
  if (!canUseAdmin(state.user.perfil)) return <Redirect href={homeForRole(state.user.perfil)} />;
  if (!item) return <Screen><Text>Turma não encontrada.</Text></Screen>;
  const showRisk = true;
  const students = studentsInClass(item.id);
  const summary = summarize(students);
  return <Screen>
    <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.link}>← Voltar</Text></Pressable>
    <SectionTitle eyebrow="ANÁLISE DA TURMA" title={item.name} /><DemoBanner />
    <View style={styles.metrics}><Metric label="Estudantes" value={String(summary.count)} /><Metric label="Média acadêmica" value={summary.academicAverage?.toFixed(1) ?? '—'} />{showRisk ? <Metric label="Faixa alta ilustrativa" value={String(summary.highRiskCount)} /> : null}</View>
    {showRisk ? <Card><Text style={styles.heading}>Distribuição estimada</Text>{(['Dropout', 'Enrolled', 'Graduate'] as const).map((key) => <Bar key={key} label={key} value={summary.count ? summary.distributions[key] / summary.count : 0} color={classColor[key]} />)}</Card> : null}
    <Text style={styles.heading}>Estudantes</Text>{students.map((student) => <StudentRow key={student.id} student={student} showRisk={showRisk} onPress={() => router.push({ pathname: '/students/[id]', params: { id: student.id } })} />)}
  </Screen>;
}

const styles = StyleSheet.create({ link: { color: palette.secondary, fontWeight: '700' }, heading: { color: palette.ink, fontSize: 17, fontWeight: '700' }, metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } });
