import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/auth/session';
import { canUseAdmin, homeForRole } from '@/auth/roles';
import { Screen, SectionTitle } from '@/components/primitives';
import { TopBar, useGoBack } from '@/components/top-bar';
import { palette } from '@/constants/design';
import { demoClasses, demoStudents, predictionLabel, riskLevel } from '@/demo/data';
import { Bar, Card, classColor, DemoBanner, Metric } from '@/demo/ui';

export default function StudentAnalysis() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { state } = useSession();
  const goBack = useGoBack('/students');
  const student = demoStudents.find((item) => item.id === id);
  if (state.status !== 'signedIn') return null;
  if (!canUseAdmin(state.user.perfil)) return <Redirect href={homeForRole(state.user.perfil)} />;
  if (!student) return <Screen><TopBar onBack={goBack} /><Text style={styles.text}>Estudante não encontrado.</Text></Screen>;
  const showRisk = true;
  const studentClass = demoClasses.find((item) => item.id === student.classId);
  return <Screen>
    <TopBar onBack={goBack} />
    <SectionTitle eyebrow="ANÁLISE INDIVIDUAL" title={student.name} /><DemoBanner />
    <Card><Text style={styles.heading}>Identificação</Text><Text style={styles.text}>Matrícula: {student.registration}</Text><Text style={styles.text}>Curso: {studentClass?.course}</Text><Text style={styles.text}>Turma: {studentClass?.name}</Text></Card>
    <View style={styles.metrics}><Metric label="Média acadêmica" value={student.academicAverage.toFixed(1)} /><Metric label="Frequência" value={`${student.attendance}%`} /><Metric label="Créditos concluídos" value={String(student.completedCredits)} /></View>
    {showRisk ? <Card><Text style={styles.heading}>Probabilidades demonstrativas</Text>{(['Dropout', 'Enrolled', 'Graduate'] as const).map((key) => <Bar key={key} label={key} value={student.prediction.probabilities[key]} color={classColor[key]} />)}<Text style={styles.text}>Classificação: {predictionLabel[student.prediction.class]} · Faixa: {riskLevel(student.prediction.probabilities.Dropout)}</Text><Text style={styles.note}>Versão {student.prediction.modelVersion} · inferência real indisponível. Fatores individuais não disponíveis.</Text><Pressable accessibilityRole="button" onPress={() => router.push('/simulations')}><Text style={styles.link}>Abrir simulação →</Text></Pressable></Card> : <Card><Text style={styles.note}>A previsão e o risco de evasão não são exibidos para estudantes.</Text></Card>}
  </Screen>;
}

const styles = StyleSheet.create({ link: { color: palette.secondary, fontWeight: '700', paddingVertical: 8 }, heading: { color: palette.ink, fontSize: 17, fontWeight: '700' }, text: { color: palette.ink, fontSize: 14 }, note: { color: palette.muted, fontSize: 12, lineHeight: 18 }, metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 } });
