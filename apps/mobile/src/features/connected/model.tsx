import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useSession } from '@/auth/session';
import { Screen, SectionTitle, TextButton } from '@/components/primitives';
import { TopBar, useGoBack } from '@/components/top-bar';
import { palette } from '@/constants/design';
import { Card } from '@/demo/ui';
import type { MlAutomaticPrediction, MlImportedPrediction, MlModelStatus, MlPrediction } from '@/services/ml';
import { DataNotice, connectedStyles } from './ui';

type ModelData = {
  status: MlModelStatus | null;
  imported: MlImportedPrediction[] | null;
  automatic: MlAutomaticPrediction[] | null;
  errors: string[];
};

const classes: { key: MlPrediction['predictedClass']; label: string }[] = [
  { key: 'Dropout', label: 'Evasão prevista' },
  { key: 'Enrolled', label: 'Matrícula prevista' },
  { key: 'Graduate', label: 'Conclusão prevista' },
];

// Avaliação reproduzida com o artefato ativo e dataProcessada.csv, excluindo Enrolled.
// Divisão estratificada 80/20, seed 7; as médias e desvios do scaler coincidem com o treino reconstruído.
const binaryEvaluation = {
  version: 'externo-lr-sem-enrolled-v1',
  datasetSha256: '3ef126de5cefff26eb11fbb4237f1a1401cb64b488e2f1d598c23cedeb4c45ae',
  sampleSize: 726,
  accuracy: 0.9077134986225895,
  macroF1: 0.9021577119041249,
  dropoutRecall: 0.8556338028169014,
};

function percent(value: number) {
  return `${(value * 100).toFixed(1).replace('.', ',')}%`;
}

export function ConnectedModel() {
  const { state, request } = useSession();
  const goBack = useGoBack('/connected');
  const [data, setData] = useState<ModelData | null>(null);
  const [revision, setRevision] = useState(0);
  const manager = state.status === 'signedIn' && state.user.perfil === 'COORDENACAO' && state.mode === 'api';
  useEffect(() => {
    if (!manager) return;
    let active = true;
    void Promise.allSettled([
      request<MlModelStatus>('/ml/status'),
      request<MlImportedPrediction[]>('/ml/importacoes'),
      request<MlAutomaticPrediction[]>('/ml/previsoes-automaticas'),
    ]).then(([status, imported, automatic]) => {
      if (!active) return;
      const errors = [status, imported, automatic].flatMap((result, index) => result.status === 'rejected'
        ? [`${['Estado do serviço', 'Importações', 'Recálculos automáticos'][index]}: ${result.reason instanceof Error ? result.reason.message : 'consulta indisponível'}`]
        : []);
      setData({
        status: status.status === 'fulfilled' ? status.value : null,
        imported: imported.status === 'fulfilled' ? imported.value : null,
        automatic: automatic.status === 'fulfilled' ? automatic.value : null,
        errors,
      });
    });
    return () => { active = false; };
  }, [manager, request, revision]);
  if (state.status === 'signedIn' && !['COORDENACAO'].includes(state.user.perfil)) return <Redirect href="/connected" />;
  const imported = data?.imported;
  const latest = imported?.[0];
  const version = data?.status?.modelVersion ?? latest?.modelVersion;
  const service = data?.status?.ready ? 'Disponível' : data?.status?.configured ? 'Indisponível no momento' : 'Não configurado';
  return <Screen><TopBar onBack={goBack} /><SectionTitle eyebrow="AVALIAÇÃO DO MODELO" title="Qualidade do modelo" />
    <DataNotice>A planilha Excel fornece os 36 atributos e é a fonte principal das previsões exibidas pela coordenação.</DataNotice>
    <View style={styles.hero}><Text style={styles.heroLabel}>Fonte dos dados analisados</Text><Text style={styles.heroValue}>Planilha Excel</Text><Text style={styles.heroCaption}>As probabilidades exibidas são calculadas pelo modelo ativo a partir dos dados importados.</Text><View style={styles.heroRule} />
      <View style={styles.heroFooter}><Text style={styles.heroFootLabel}>Modelo ativo</Text><Text style={styles.heroFootValue}>{version ?? 'carregando…'}</Text></View>
    </View>
    {!data && <View style={styles.loading}><ActivityIndicator color={palette.primary} /><Text style={connectedStyles.body}>Carregando dados do modelo…</Text></View>}
    {data && <>
      <Card><Text style={connectedStyles.heading}>Modelo em uso</Text>
        <Text style={connectedStyles.body}>Serviço de inferência: {data.status ? service : 'não foi possível consultar'}.</Text>
        <Text style={connectedStyles.body}>{version ? `${data.status?.modelVersion ? 'Versão carregada' : 'Versão da última importação'}: ${version}.` : 'Nenhuma versão do modelo disponível.'}</Text>
        {data.status?.ready && <Text style={connectedStyles.body}>{data.status.originalInputReady ? 'Entrada original da planilha disponível.' : 'Entrada original da planilha indisponível nesta versão.'}</Text>}
      </Card>
      <Card><Text style={connectedStyles.heading}>Análises da planilha</Text>
        {imported ? <>
          <Text style={styles.summaryNumber}>{imported.length}</Text>
          <Text style={connectedStyles.body}>Previsões recentes calculadas com os dados importados (a API retorna até 50). As contagens são classes previstas, não desfechos observados.</Text>
          {latest && <>
            <View style={styles.distribution}>{classes.map(({ key, label }) => <View key={key} style={styles.classCount}><Text style={styles.classValue}>{imported.filter((item) => item.predictedClass === key).length}</Text><Text style={styles.classLabel}>{label}</Text></View>)}</View>
            <Text style={connectedStyles.body}>Última importação: {new Date(latest.calculadoEm).toLocaleString('pt-BR')} · {latest.modelVersion}.</Text>
          </>}
          {!imported.length && <Text style={connectedStyles.body}>Nenhuma previsão importada. Importe a planilha na aba Cenários para analisar os alunos.</Text>}
        </> : <Text style={connectedStyles.body}>As previsões importadas não puderam ser consultadas.</Text>}
        {data.automatic && data.automatic.length > 0 && <Text style={connectedStyles.body}>{data.automatic.length} recálculo(s) automático(s) recente(s).</Text>}
      </Card>
      <Card><Text style={connectedStyles.heading}>Acurácia do modelo sem Enrolled</Text>
        {version === binaryEvaluation.version ? <>
          <View style={styles.distribution}>
            <View style={styles.classCount}><Text style={styles.classValue}>{percent(binaryEvaluation.accuracy)}</Text><Text style={styles.classLabel}>Acurácia</Text></View>
            <View style={styles.classCount}><Text style={styles.classValue}>{percent(binaryEvaluation.macroF1)}</Text><Text style={styles.classLabel}>F1 macro</Text></View>
            <View style={styles.classCount}><Text style={styles.classValue}>{percent(binaryEvaluation.dropoutRecall)}</Text><Text style={styles.classLabel}>Recall de evasão</Text></View>
          </View>
          <Text style={connectedStyles.body}>Avaliação do próprio artefato {binaryEvaluation.version} em {binaryEvaluation.sampleSize} registros de validação separados do treino, com classes Evasão e Conclusão.</Text>
          <Text style={connectedStyles.body}>Divisão estratificada 80/20, semente 7. O treino reconstruído coincidiu com as estatísticas internas do modelo. O CSV de referência tem SHA-256 {binaryEvaluation.datasetSha256.slice(0, 12)}…</Text>
        </> : <Text style={connectedStyles.body}>Acurácia indisponível para a versão carregada. A avaliação registrada pertence a {binaryEvaluation.version}.</Text>}
      </Card>
      {data.errors.length > 0 && <Card><Text accessibilityRole="alert" style={styles.error}>{data.errors.join('\n')}</Text></Card>}
      <TextButton title="Atualizar dados do modelo" onPress={() => { setData(null); setRevision((value) => value + 1); }} />
    </>}
    <Card><Text style={connectedStyles.heading}>Como ler os resultados</Text><Text style={connectedStyles.body}>As notas semestrais e os demais atributos vêm da planilha. A média e a frequência do diário acadêmico são registros distintos. A planilha de dez alunos não contém desfechos para medir acertos ou calibração.</Text></Card>
    <Text style={styles.footnote}>As probabilidades são resultados do modelo ativo. Os notebooks fornecidos avaliam outra configuração, com três classes.</Text>
  </Screen>;
}

const styles = StyleSheet.create({
  hero: { backgroundColor: palette.primary, borderRadius: 15, padding: 23, gap: 16 }, heroLabel: { color: '#B9D8D5', fontSize: 12 },
  heroValue: { color: palette.surface, fontSize: 34, fontWeight: '800', letterSpacing: -1, lineHeight: 40 }, heroCaption: { color: '#C8E2DF', fontSize: 12, lineHeight: 18 },
  heroRule: { height: 1, backgroundColor: palette.onPrimaryRule }, heroFooter: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 },
  heroFootLabel: { color: '#C8E2DF', fontSize: 12 }, heroFootValue: { color: palette.gold, fontSize: 14, fontWeight: '800', marginRight: 14 },
  summaryNumber: { color: palette.primary, fontSize: 40, fontWeight: '800' },
  loading: { alignItems: 'center', gap: 9, padding: 28 },
  distribution: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  classCount: { flexGrow: 1, minWidth: 85, backgroundColor: palette.primarySoft, padding: 12, borderRadius: 9, gap: 3 },
  classValue: { color: palette.primary, fontSize: 24, fontWeight: '800' }, classLabel: { color: palette.muted, fontSize: 12 },
  error: { color: palette.danger, fontSize: 12, lineHeight: 18 },
  footnote: { color: palette.muted, fontSize: 12, lineHeight: 19 },
});
