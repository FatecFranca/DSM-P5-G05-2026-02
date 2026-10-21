import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSession } from '@/auth/session';
import { Screen, SectionTitle } from '@/components/primitives';
import { TopBar } from '@/components/top-bar';
import { palette } from '@/constants/design';
import { demoStudents } from '@/demo/data';
import { Bar, Card, classColor, DemoBanner } from '@/demo/ui';

export default function Simulations() {
  const { state } = useSession();
  const [firstSemesterGrade, setFirstSemesterGrade] = useState('14');
  const [secondSemesterGrade, setSecondSemesterGrade] = useState('13');
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState('');
  if (state.status !== 'signedIn') return null;
  if (state.user.perfil === 'ALUNO') return <Screen><SectionTitle title="Simulações" /><Card><Text style={styles.note}>Simulações de risco exigem autorização institucional.</Text></Card></Screen>;
  const baseline = demoStudents[0].prediction.probabilities;
  function run() {
    const grade1 = Number(firstSemesterGrade.replace(',', '.'));
    const grade2 = Number(secondSemesterGrade.replace(',', '.'));
    if (!Number.isFinite(grade1) || grade1 < 0 || grade1 > 20 || !Number.isFinite(grade2) || grade2 < 0 || grade2 > 20) {
      setError('Informe notas entre 0 e 20 para os dois semestres.');
      setResult(null);
      return;
    }
    setError('');
    setResult(Math.max(0.02, Math.min(0.95, baseline.Dropout + (14 - grade1) * 0.025 + (13 - grade2) * 0.025)));
  }
  const simulated = result === null ? null : { Dropout: result, Enrolled: (1 - result) * 0.4, Graduate: (1 - result) * 0.6 };
  return <Screen><TopBar /><SectionTitle eyebrow="LABORATÓRIO DEMONSTRATIVO" title="Simulações" /><DemoBanner />
    <Card><Text style={styles.heading}>Cenário fictício</Text><Text style={styles.note}>Ajuste as notas das unidades curriculares do 1º e 2º semestre (atributos presentes no pipeline). A fórmula é ilustrativa e não usa o modelo de ML. Nenhum registro acadêmico é alterado.</Text>
      <Text style={styles.label}>Nota do 1º semestre (0–20)</Text><TextInput accessibilityLabel="Nota do 1º semestre" keyboardType="decimal-pad" value={firstSemesterGrade} onChangeText={setFirstSemesterGrade} style={styles.input} />
      <Text style={styles.label}>Nota do 2º semestre (0–20)</Text><TextInput accessibilityLabel="Nota do 2º semestre" keyboardType="decimal-pad" value={secondSemesterGrade} onChangeText={setSecondSemesterGrade} style={styles.input} />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}><Pressable accessibilityRole="button" onPress={run} style={styles.button}><Text style={styles.buttonText}>Simular</Text></Pressable><Pressable accessibilityRole="button" onPress={() => { setFirstSemesterGrade('14'); setSecondSemesterGrade('13'); setResult(null); setError(''); }}><Text style={styles.reset}>Restaurar</Text></Pressable></View>
    </Card>
    <Card><Text style={styles.heading}>Referência demonstrativa</Text>{(['Dropout', 'Enrolled', 'Graduate'] as const).map((key) => <Bar key={key} label={key} value={baseline[key]} color={classColor[key]} />)}</Card>
    {simulated ? <Card><Text style={styles.heading}>Resultado ilustrativo</Text>{(['Dropout', 'Enrolled', 'Graduate'] as const).map((key) => <Bar key={key} label={key} value={simulated[key]} color={classColor[key]} />)}<Text style={styles.note}>Estimativa fictícia · versão demo-1.0. Inferência real indisponível.</Text></Card> : null}
  </Screen>;
}

const styles = StyleSheet.create({ heading: { color: palette.ink, fontSize: 17, fontWeight: '700' }, note: { color: palette.muted, fontSize: 13, lineHeight: 19 }, label: { color: palette.ink, fontWeight: '600' }, input: { borderWidth: 1, borderColor: palette.line, borderRadius: 10, paddingHorizontal: 12, minHeight: 48, color: palette.ink }, actions: { flexDirection: 'row', alignItems: 'center', gap: 18 }, button: { backgroundColor: palette.primary, paddingHorizontal: 20, paddingVertical: 13, borderRadius: 10 }, buttonText: { color: palette.surface, fontWeight: '700' }, reset: { color: palette.secondary, fontWeight: '700' }, error: { color: palette.danger } });
