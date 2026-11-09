import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/auth/session';
import { Screen, SectionTitle } from '@/components/primitives';
import { TopBar, useGoBack } from '@/components/top-bar';
import { palette } from '@/constants/design';
import { Bar, Card, classColor, Metric } from '@/demo/ui';
import { DataNotice, connectedStyles } from '@/features/connected/ui';
import { AccountAdmin, PersonHeader } from '@/features/people/account-admin';
import type { AcademicSnapshot } from '@/services/academic';
import type { UserDetail } from '@/services/api';
import { ML_FIELD_LABELS, type DemoMlPrediction, type EnrollmentMl, type MlImportedPrediction } from '@/services/ml';

interface AcademicRecord { enrollmentId: string; registration: string; course: string; className: string; average: number | null; attendance: number | null }
interface MlDisplayData {
  personId: string;
  profiles: Record<string, EnrollmentMl>;
  predictions: Record<string, MlImportedPrediction>;
  error: string;
}

const CLASS_LABELS: Record<DemoMlPrediction['predictedClass'], string> = {
  Dropout: 'Evasão', Enrolled: 'Matriculado', Graduate: 'Graduate (classe do modelo)',
};

export default function PersonDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const goBack = useGoBack('/connected/people');
  const { state, request } = useSession();
  const role = state.status === 'signedIn' ? state.user.perfil : null;
  const [person, setPerson] = useState<UserDetail | null>(null);
  const [records, setRecords] = useState<AcademicRecord[]>([]);
  const [error, setError] = useState('');
  const [academicError, setAcademicError] = useState('');
  const [predictions, setPredictions] = useState<Record<string, DemoMlPrediction>>({});
  const [predictionErrors, setPredictionErrors] = useState<Record<string, string>>({});
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [mlData, setMlData] = useState<MlDisplayData | null>(null);
  const [expandedProfiles, setExpandedProfiles] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const value = await request<UserDetail>(`/usuarios/${encodeURIComponent(id)}`);
        if (!active) return;
        setPerson(value);
        setPredictions({});
        setPredictionErrors({});
        if (value.perfil !== 'ALUNO' || !value.matriculas.length) return;
        setRecords(value.matriculas.map((item) => ({
          enrollmentId: item.id, registration: item.registro, course: item.turma.curso,
          className: item.turma.nome, average: null, attendance: null,
        })));
        try {
          const snapshots = await Promise.all(value.matriculas.map((item) => request<AcademicSnapshot>(`/academico/resumo?turmaId=${encodeURIComponent(item.turma.id)}`)));
          if (!active) return;
          if (snapshots.some((item) => item.truncated)) throw new Error('O histórico acadêmico está incompleto.');
          setRecords(value.matriculas.map((item, index) => {
            const enrollment = snapshots[index].matriculas.find((entry) => entry.registro === item.registro);
            const indicator = snapshots[index].indicadores.find((entry) => entry.matriculaId === enrollment?.id);
            return { enrollmentId: item.id, registration: item.registro, course: item.turma.curso, className: item.turma.nome,
              average: indicator?.media ?? null, attendance: indicator?.frequencia ?? null };
          }));
        } catch (cause) { if (active) setAcademicError(cause instanceof Error ? cause.message : 'Não foi possível carregar os indicadores acadêmicos.'); }
        if (value.nome === 'Aluno Demo SGEI' && role && role !== 'ALUNO') {
          const demoItems = value.matriculas.filter((item) => /^SGEI-DEMO-(109|002|276|284)$/.test(item.registro));
          if (demoItems.length) {
            if (active) setPredictionLoading(true);
            const results = await Promise.allSettled(demoItems.map((item) => request<DemoMlPrediction>(`/ml/matriculas/${encodeURIComponent(item.id)}/demonstracao`)));
            if (active) {
              const ready: Record<string, DemoMlPrediction> = {};
              const errors: Record<string, string> = {};
              results.forEach((result, index) => {
                const key = demoItems[index].id;
                if (result.status === 'fulfilled' && result.value.demonstracao === true) ready[key] = result.value;
                else errors[key] = 'Prévia indisponível. Confira a ficha demonstrativa e o serviço de ML.';
              });
              setPredictions(ready);
              setPredictionErrors(errors);
              setPredictionLoading(false);
            }
          }
        }
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar a pessoa.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [id, request, role]);

  useEffect(() => {
    if (role !== 'COORDENACAO' || person?.id !== id || person.perfil !== 'ALUNO' || !person.matriculas.length) return;
    let active = true;
    void Promise.allSettled([
      Promise.all(person.matriculas.map((item) => request<EnrollmentMl>(`/ml/matriculas/${encodeURIComponent(item.id)}`))),
      request<MlImportedPrediction[]>('/ml/importacoes'),
    ]).then(([profilesResult, importsResult]) => {
      if (!active) return;
      const profiles = profilesResult.status === 'fulfilled'
        ? Object.fromEntries(profilesResult.value.map((profile) => [profile.matriculaId, profile]))
        : {};
      const predictions: Record<string, MlImportedPrediction> = {};
      if (importsResult.status === 'fulfilled') {
        for (const prediction of importsResult.value) predictions[prediction.registro] ??= prediction;
      }
      setMlData({ personId: person.id, profiles, predictions,
        error: profilesResult.status === 'rejected' || importsResult.status === 'rejected'
          ? 'Não foi possível carregar todos os dados importados. Tente abrir esta tela novamente.' : '' });
    });
    return () => { active = false; };
  }, [id, person, request, role]);

  const visibleMlData = mlData?.personId === person?.id ? mlData : null;
  const mlProfiles = visibleMlData?.profiles ?? {};
  const importedPredictions = visibleMlData?.predictions ?? {};
  const mlLoading = role === 'COORDENACAO' && person?.perfil === 'ALUNO' && !visibleMlData;
  const mlError = visibleMlData?.error ?? '';
  const demoPerson = !!role && role !== 'ALUNO' && person?.nome === 'Aluno Demo SGEI' && person.matriculas.some((item) => /^SGEI-DEMO-(109|002|276|284)$/.test(item.registro));
  const hasImportedPrediction = person?.matriculas.some((item) => !!importedPredictions[item.registro]) ?? false;
  return <Screen><TopBar onBack={goBack} />
    {person ? <PersonHeader person={person} /> : <SectionTitle title="Detalhes da pessoa" />}
    {demoPerson && <DataNotice>Dados demonstrativos. As probabilidades são calculadas pelo modelo a partir dos atributos cadastrados.</DataNotice>}
    {loading && <ActivityIndicator color={palette.primary} />}
    {!!error && <Card><Text accessibilityRole="alert" style={styles.error}>{error}</Text></Card>}
    {person && <>
      {role === 'COORDENACAO' && <AccountAdmin person={person} onChanged={(changes) => setPerson((current) => current ? { ...current, ...changes } : current)} />}
      {person.perfil === 'ALUNO' && <>
        {academicError ? <Card><Text accessibilityRole="alert" style={styles.error}>{academicError}</Text></Card> : null}
        {records.map((item) => <View key={item.registration} style={styles.stack}>
          <Card><Text style={styles.heading}>{item.className}</Text><Text style={styles.text}>Matrícula: {item.registration}</Text><Text style={styles.text}>Curso: {item.course}</Text></Card>
          {role === 'COORDENACAO' && !demoPerson && <ImportedExcelCard
            profile={mlProfiles[item.enrollmentId]}
            prediction={importedPredictions[item.registration]}
            loading={mlLoading}
            error={mlError}
            expanded={!!expandedProfiles[item.enrollmentId]}
            onToggle={() => setExpandedProfiles((current) => ({ ...current, [item.enrollmentId]: !current[item.enrollmentId] }))}
          />}
          <View style={styles.stack}><Text style={connectedStyles.caption}>Indicadores do diário acadêmico</Text><View style={connectedStyles.metricGrid}><Metric label="Média acadêmica" value={item.average?.toFixed(1).replace('.', ',') ?? '—'} /><Metric label="Frequência" value={item.attendance === null ? '—' : `${item.attendance.toFixed(0)}%`} /></View></View>
          {demoPerson && <Card><Text style={styles.heading}>Análise demonstrativa · modelo português</Text>
            {predictionLoading && <ActivityIndicator color={palette.primary} />}
            {predictions[item.enrollmentId] && <>
              {(['Dropout', 'Enrolled', 'Graduate'] as const).map((key) => {
                const value = predictions[item.enrollmentId].probabilities[key];
                return typeof value === 'number' ? <Bar key={key} label={CLASS_LABELS[key]} value={value} color={classColor[key]} /> : null;
              })}
              {typeof predictions[item.enrollmentId].probabilities.Enrolled !== 'number' && <Text style={connectedStyles.body}>Modelo binário: Enrolled não é uma classe prevista.</Text>}
              <Text style={styles.text}>Classificação: {CLASS_LABELS[predictions[item.enrollmentId].predictedClass]}</Text>
              <Text style={connectedStyles.body}>Versão {predictions[item.enrollmentId].modelVersion} · 36 atributos demonstrativos. Eles não correspondem necessariamente à média e à frequência acima.</Text>
            </>}
            {!!predictionErrors[item.enrollmentId] && <Text accessibilityRole="alert" style={styles.error}>{predictionErrors[item.enrollmentId]}</Text>}
          </Card>}
        </View>)}
        {!person.matriculas.length && <Card><Text style={connectedStyles.body}>Nenhuma matrícula vinculada.</Text></Card>}
        {!demoPerson && !hasImportedPrediction && <Card><Text style={styles.heading}>Análise acadêmica</Text><Text style={connectedStyles.body}>Nenhuma previsão da planilha foi encontrada para este aluno. Importe os dados Excel pela aba Cenários.</Text></Card>}
      </>}
      {person.perfil === 'PROFESSOR' && <Card><Text style={styles.heading}>Disciplinas vinculadas</Text>{person.lotacoes?.length ? person.lotacoes.map((item, index) => <Text key={`${item.disciplina.nome}-${index}`} style={styles.text}>{item.disciplina.nome} · {item.disciplina.turma.nome}</Text>) : <Text style={connectedStyles.body}>Nenhuma disciplina vinculada.</Text>}</Card>}
      {person.perfil === 'TUTOR' && <Card><Text style={styles.heading}>Tutorias</Text>{person.tutorias?.length ? person.tutorias.map((item) => <Text key={item.matricula.registro} style={styles.text}>{item.matricula.aluno.nome} · {item.matricula.registro}</Text>) : <Text style={connectedStyles.body}>Nenhuma tutoria vinculada.</Text>}</Card>}
    </>}
  </Screen>;
}

function ImportedExcelCard({ profile, prediction, loading, error, expanded, onToggle }: {
  profile?: EnrollmentMl;
  prediction?: MlImportedPrediction;
  loading: boolean;
  error: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const features = profile?.features ?? {};
  const registered = Object.keys(features).length;
  return <Card>
    <Text style={styles.heading}>{prediction ? 'Dados principais da planilha' : 'Dados para análise'}</Text>
    {loading && <ActivityIndicator color={palette.primary} />}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {profile && <>
      <Text style={styles.text}>{registered} de {registered + profile.faltantes.length} atributos registrados · perfil v{profile.versao}</Text>
      {(['ucs_1sem_nota', 'ucs_2sem_nota'] as const).map((key) => Number.isFinite(features[key]) &&
        <Text key={key} style={styles.text}>{ML_FIELD_LABELS[key]}: {String(features[key]).replace('.', ',')}</Text>)}
      <Text style={connectedStyles.body}>Essas notas da planilha usam escala de 0 a 20. A média acadêmica acima depende de notas publicadas no diário; a frequência depende de presenças registradas.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={expanded ? 'Ocultar atributos importados' : 'Ver todos os atributos importados'} onPress={onToggle}>
        <Text style={styles.link}>{expanded ? 'Ocultar atributos' : 'Ver todos os atributos'}</Text>
      </Pressable>
      {expanded && Object.entries(ML_FIELD_LABELS).map(([key, label]) => Number.isFinite(features[key]) &&
        <Text key={key} style={styles.text}>{label}: {String(features[key]).replace('.', ',')}</Text>)}
    </>}
    {prediction && <>
      <Text style={styles.heading}>Resultado do modelo</Text>
      <Text style={styles.text}>Classe estimada: {CLASS_LABELS[prediction.predictedClass]}</Text>
      <Text style={styles.text}>Probabilidade de evasão: {(prediction.probabilities.Dropout * 100).toFixed(1).replace('.', ',')}%</Text>
      <Text style={connectedStyles.body}>Modelo {prediction.modelVersion} · {prediction.atual ? 'perfil atual' : 'perfil alterado desde a importação'}. A avaliação do modelo sem Enrolled está na aba Modelo.</Text>
    </>}
    {!loading && !error && !profile && !prediction && <Text style={connectedStyles.body}>Nenhum dado de análise disponível para esta matrícula.</Text>}
  </Card>;
}

const styles = StyleSheet.create({
  heading: { color: palette.ink, fontSize: 17, fontWeight: '700' }, text: { color: palette.ink, fontSize: 14 },
  error: { color: palette.danger, fontSize: 13 }, stack: { gap: 10 },
  link: { color: palette.primary, fontSize: 14, fontWeight: '700' },
});
