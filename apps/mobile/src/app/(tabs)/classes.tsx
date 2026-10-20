import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/auth/session';
import { Screen, SectionTitle } from '@/components/primitives';
import { palette } from '@/constants/design';
import { demoClasses, studentsInClass, summarize } from '@/demo/data';
import { Card, DemoBanner, Metric } from '@/demo/ui';

export default function Classes() {
  const router = useRouter();
  const { state } = useSession();
  if (state.status !== 'signedIn') return null;
  if (state.user.perfil === 'ALUNO') return <Screen><SectionTitle title="Turmas" /><Card><Text style={styles.heading}>Sua turma estará disponível após o vínculo com a matrícula na API.</Text></Card></Screen>;
  const showRisk = true;
  return <Screen><SectionTitle eyebrow="VISÃO POR TURMA" title="Turmas" /><DemoBanner />
    {demoClasses.map((item) => {
      const summary = summarize(studentsInClass(item.id));
      return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Abrir turma ${item.name}`} onPress={() => router.push({ pathname: '/classes/[id]', params: { id: item.id } })}>
        <Card><View style={styles.titleRow}><Text style={styles.heading}>{item.name}</Text><Text style={styles.arrow}>→</Text></View><View style={styles.metrics}><Metric label="Estudantes" value={String(summary.count)} /><Metric label="Média das notas" value={summary.academicAverage?.toFixed(1) ?? '—'} />{showRisk ? <Metric label="Faixa alta ilustrativa" value={String(summary.highRiskCount)} /> : null}</View></Card>
      </Pressable>;
    })}
  </Screen>;
}

const styles = StyleSheet.create({ titleRow: { flexDirection: 'row', justifyContent: 'space-between' }, heading: { color: palette.ink, fontSize: 18, fontWeight: '700' }, arrow: { color: palette.secondary, fontSize: 20 }, metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } });
