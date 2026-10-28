import { StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useSession } from '@/auth/session';
import { Screen, SectionTitle } from '@/components/primitives';
import { TopBar } from '@/components/top-bar';
import { palette } from '@/constants/design';
import { Card } from '@/demo/ui';
import { DataNotice, connectedStyles } from './ui';

export function ConnectedModel() {
  const { state } = useSession();
  if (state.status === 'signedIn' && !['ADMIN', 'COORDENACAO'].includes(state.user.perfil)) return <Redirect href="/connected" />;
  return <Screen><TopBar /><SectionTitle eyebrow="AVALIAÇÃO DO MODELO" title="Qualidade do modelo" />
    <DataNotice>O classificador disponível é candidato e não foi validado com dados de alunos das Fatecs.</DataNotice>
    <View style={styles.hero}><Text style={styles.heroLabel}>Estado para uso institucional</Text><Text style={styles.heroValue}>Não validado</Text><Text style={styles.heroCaption}>Nenhuma probabilidade operacional é apresentada até concluir a validação.</Text><View style={styles.heroRule} />
      <View style={styles.heroFooter}><Text style={styles.heroFootLabel}>Acurácia local</Text><Text style={styles.heroFootValue}>—</Text><Text style={styles.heroFootLabel}>Calibração local</Text><Text style={styles.heroFootValue}>—</Text></View>
    </View>
    <Card><Text style={connectedStyles.heading}>Validação necessária</Text><Text style={connectedStyles.body}>É preciso demonstrar equivalência entre os atributos do treinamento e os registros das Fatecs, avaliar desempenho e calibração com dados autorizados e revisar vieses antes de usar o modelo.</Text></Card>
    <Card><Text style={connectedStyles.heading}>Dados acadêmicos disponíveis</Text><Text style={connectedStyles.body}>Notas publicadas, presença, turmas e matrículas alimentam o panorama acadêmico. Eles não substituem automaticamente os agregados semestrais ou as categorias exigidas pelo modelo.</Text></Card>
    <Text style={styles.footnote}>Sem validação local, métricas e previsões não devem orientar decisões acadêmicas individuais.</Text>
  </Screen>;
}

const styles = StyleSheet.create({
  hero: { backgroundColor: palette.primary, borderRadius: 15, padding: 23, gap: 16 }, heroLabel: { color: '#B9D8D5', fontSize: 12 },
  heroValue: { color: palette.surface, fontSize: 34, fontWeight: '800', letterSpacing: -1, lineHeight: 40 }, heroCaption: { color: '#C8E2DF', fontSize: 12, lineHeight: 18 },
  heroRule: { height: 1, backgroundColor: '#4F7075' }, heroFooter: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 },
  heroFootLabel: { color: '#C8E2DF', fontSize: 12 }, heroFootValue: { color: palette.gold, fontSize: 20, fontWeight: '800', marginRight: 14 },
  footnote: { color: palette.muted, fontSize: 12, lineHeight: 19 },
});
