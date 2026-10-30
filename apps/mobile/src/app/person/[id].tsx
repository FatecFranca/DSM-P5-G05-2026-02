import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/auth/session';
import { Screen, SectionTitle } from '@/components/primitives';
import { TopBar, useGoBack } from '@/components/top-bar';
import { palette, roleLabel } from '@/constants/design';
import { Bar, Card, classColor, Metric } from '@/demo/ui';
import { DataNotice, connectedStyles } from '@/features/connected/ui';
import type { AcademicSnapshot } from '@/services/academic';
import type { UserDetail } from '@/services/api';
import type { DemoMlPrediction } from '@/services/ml';

interface AcademicRecord { enrollmentId: string; registration: string; course: string; className: string; average: number | null; attendance: number | null }

const CLASS_LABELS: Record<DemoMlPrediction['predictedClass'], string> = {
  Dropout: 'Evasão', Enrolled: 'Matriculado', Graduate: 'Concluído',
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

  const demoPerson = !!role && role !== 'ALUNO' && person?.nome === 'Aluno Demo SGEI' && person.matriculas.some((item) => /^SGEI-DEMO-(109|002|276|284)$/.test(item.registro));
  return <Screen><TopBar onBack={goBack} /><SectionTitle eyebrow={person?.perfil === 'ALUNO' ? 'ANÁLISE INDIVIDUAL' : 'CADASTRO'} title={person?.nome ?? 'Detalhes da pessoa'} />
    <DataNotice>{demoPerson ? 'Dados fictícios. As probabilidades vêm do modelo português e não medem risco real nas Fatecs.' : 'Informações registradas na API. Nenhum risco ou probabilidade é exibido sem validação do modelo.'}</DataNotice>
    {loading && <ActivityIndicator color={palette.primary} />}
    {!!error && <Card><Text accessibilityRole="alert" style={styles.error}>{error}</Text></Card>}
    {person && <>
      <Card><Text style={styles.heading}>Identificação</Text><Text style={styles.text}>{roleLabel[person.perfil]}</Text><Text style={styles.text}>{person.instituicao?.nome ?? 'Fatec não informada'}</Text><Text style={styles.text}>{person.email}</Text><Text style={connectedStyles.caption}>{person.ativo ? 'Conta ativa' : 'Conta inativa'}</Text></Card>
      {person.perfil === 'ALUNO' && <>
        {academicError ? <Card><Text accessibilityRole="alert" style={styles.error}>{academicError}</Text></Card> : null}
        {records.map((item) => <View key={item.registration} style={styles.stack}>
          <Card><Text style={styles.heading}>{item.className}</Text><Text style={styles.text}>Matrícula: {item.registration}</Text><Text style={styles.text}>Curso: {item.course}</Text></Card>
          <View style={connectedStyles.metricGrid}><Metric label="Média acadêmica" value={item.average?.toFixed(1).replace('.', ',') ?? '—'} /><Metric label="Frequência" value={item.attendance === null ? '—' : `${item.attendance.toFixed(0)}%`} /></View>
          {demoPerson && <Card><Text style={styles.heading}>Análise demonstrativa · modelo português</Text>
            {predictionLoading && <ActivityIndicator color={palette.primary} />}
            {predictions[item.enrollmentId] && <>
              {(['Dropout', 'Enrolled', 'Graduate'] as const).map((key) => <Bar key={key} label={CLASS_LABELS[key]} value={predictions[item.enrollmentId].probabilities[key]} color={classColor[key]} />)}
              <Text style={styles.text}>Classificação: {CLASS_LABELS[predictions[item.enrollmentId].predictedClass]}</Text>
              <Text style={connectedStyles.body}>Versão {predictions[item.enrollmentId].modelVersion} · 36 atributos sintéticos. Eles não correspondem necessariamente à média e à frequência acima. Resultado experimental, sem validação para alunos das Fatecs.</Text>
            </>}
            {!!predictionErrors[item.enrollmentId] && <Text accessibilityRole="alert" style={styles.error}>{predictionErrors[item.enrollmentId]}</Text>}
          </Card>}
        </View>)}
        {!person.matriculas.length && <Card><Text style={connectedStyles.body}>Nenhuma matrícula vinculada.</Text></Card>}
        {!demoPerson && <Card><Text style={styles.heading}>Análise acadêmica</Text><Text style={connectedStyles.body}>A previsão permanece indisponível até que os atributos e o modelo sejam validados para alunos das Fatecs.</Text></Card>}
      </>}
      {person.perfil === 'PROFESSOR' && <Card><Text style={styles.heading}>Disciplinas vinculadas</Text>{person.lotacoes?.length ? person.lotacoes.map((item, index) => <Text key={`${item.disciplina.nome}-${index}`} style={styles.text}>{item.disciplina.nome} · {item.disciplina.turma.nome}</Text>) : <Text style={connectedStyles.body}>Nenhuma disciplina vinculada.</Text>}</Card>}
      {person.perfil === 'TUTOR' && <Card><Text style={styles.heading}>Tutorias</Text>{person.tutorias?.length ? person.tutorias.map((item) => <Text key={item.matricula.registro} style={styles.text}>{item.matricula.aluno.nome} · {item.matricula.registro}</Text>) : <Text style={connectedStyles.body}>Nenhuma tutoria vinculada.</Text>}</Card>}
    </>}
  </Screen>;
}

const styles = StyleSheet.create({
  heading: { color: palette.ink, fontSize: 17, fontWeight: '700' }, text: { color: palette.ink, fontSize: 14 },
  error: { color: palette.danger, fontSize: 13 }, stack: { gap: 10 },
});
