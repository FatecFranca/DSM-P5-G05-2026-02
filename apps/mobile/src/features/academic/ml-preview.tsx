import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSession } from '@/auth/session';
import { ActionButton, BodyText, Feedback, FormField, Panel, PanelTitle, academicStyles } from '@/demo/academic-ui';
import { ML_FIELD_LABELS, ML_SYNTHETIC_EXAMPLE, parseMlFeatures, parseOriginalMlFields, type MlInputFormat, type MlPrediction, type MlSchema, type MlStatus } from '@/services/ml';

const labels = { Dropout: 'Evasão', Enrolled: 'Matriculado no recorte do dataset', Graduate: 'Conclusão' };

export function MlPreview() {
  const { request } = useSession();
  const [schema, setSchema] = useState<MlSchema | null>(null);
  const [status, setStatus] = useState<MlStatus | null>(null);
  const [input, setInput] = useState('');
  const [inputFormat, setInputFormat] = useState<MlInputFormat>('original');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [synthetic, setSynthetic] = useState(false);
  const [result, setResult] = useState<MlPrediction | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setBusy(true); setError(''); setStatus(null); setSchema(null); setResult(null);
      try {
        const [nextSchema, nextStatus] = await Promise.all([request<MlSchema>('/ml/schema'), request<MlStatus>('/ml/status')]);
        if (active) { setSchema(nextSchema); setStatus(nextStatus); }
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'Falha ao consultar o modelo.'); }
      finally { if (active) setBusy(false); }
    });
    return () => { active = false; };
  }, [request, revision]);
  async function predict() {
    if (!schema || !status?.ready || busy) return;
    setError(''); setResult(null);
    try {
      const features = inputFormat === 'original' ? parseOriginalMlFields(fields, schema.features) : parseMlFeatures(input, schema.features);
      setBusy(true);
      const prediction = await request<MlPrediction>('/ml/preview', { method: 'POST', body: { features, inputFormat } });
      setResult(prediction);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível executar o modelo.'); }
    finally { setBusy(false); }
  }
  return <View style={academicStyles.stack}>
    <Panel><PanelTitle>Prévia técnica do ML</PanelTitle>
      <BodyText>Esta consulta executa o modelo treinado através da API. O modelo candidato ainda não está aprovado para decisões sobre alunos reais. Nenhum dado desta consulta é usado para treinamento.</BodyText>
      <BodyText>Os cadastros acadêmicos ainda não fornecem todos os atributos compatíveis. Não substitua dados ausentes por zero, não use IDs locais como códigos do dataset e não envie nomes ou e-mails.</BodyText>
      <BodyText>{status?.ready ? `Modelo disponível: ${status.modelVersion}` : busy ? 'Consultando o serviço…' : 'Modelo indisponível. Verifique o serviço ML e tente novamente.'}</BodyText>
      {schema && !schema.previewEnabled && <Feedback error message="A prévia está desabilitada pelo administrador do servidor." />}
      <ActionButton title="Atualizar disponibilidade" disabled={busy} secondary onPress={() => setRevision((r) => r + 1)} />
    </Panel>
    {schema && <Panel><PanelTitle>{schema.features.length} atributos obrigatórios</PanelTitle>
      <View style={academicStyles.row}>{(['original', 'preprocessed'] as const).map((format) => <ActionButton key={format} title={format === 'original' ? 'Valores originais' : 'Valores pré-processados'} secondary={inputFormat !== format} disabled={busy} onPress={() => { setInputFormat(format); setResult(null); setError(''); }} />)}</View>
      {inputFormat === 'original' ? <>
        <BodyText>Preencha os valores nas escalas indicadas. O servidor aplica a padronização confirmada do notebook antes de executar o modelo. Os códigos de curso e ingresso precisam corresponder ao dataset.</BodyText>
        {!status?.originalInputReady && <Feedback error message="A transformação dos valores originais ainda não está disponível neste servidor." />}
        <ActionButton title="Preencher exemplo fictício" secondary disabled={busy} onPress={() => { setFields(Object.fromEntries(Object.entries(ML_SYNTHETIC_EXAMPLE).map(([name, value]) => [name, String(value)]))); setSynthetic(true); setResult(null); setError(''); }} />
        {synthetic && <BodyText>Exemplo fictício para testar a conexão. Estes dados não pertencem a um aluno cadastrado.</BodyText>}
        {schema.features.map((name) => <FormField key={name} label={ML_FIELD_LABELS[name] ?? name} value={fields[name] ?? ''} onChangeText={(text) => { if (!busy) { setFields((previous) => ({ ...previous, [name]: text })); setResult(null); setError(''); } }} placeholder="Obrigatório" />)}
      </> : <>
        <BodyText>Cole somente os 36 atributos já tratados, sem a coluna classe. Nesse modo, o servidor não repete a padronização do notebook.</BodyText>
        <FormField label="Atributos pré-processados (JSON)" multiline value={input} onChangeText={(text) => { if (!busy) { setInput(text); setResult(null); setError(''); } }} placeholder="Cole o objeto com os atributos numéricos." />
      </>}
      <ActionButton title={busy ? 'Aguarde…' : 'Executar modelo'} disabled={busy || !status?.ready || !schema.previewEnabled || (inputFormat === 'original' ? !status?.originalInputReady : !input.trim())} onPress={() => void predict()} />
    </Panel>}
    {!!error && <Feedback error message={error} />}
    {result && <Panel><PanelTitle>Resultado: {labels[result.predictedClass]}</PanelTitle><BodyText>Versão: {result.modelVersion}</BodyText>
      {(['Dropout', 'Enrolled', 'Graduate'] as const).map((key) => <BodyText key={key}>{labels[key]}: {(result.probabilities[key] * 100).toFixed(1)}%</BodyText>)}
      <BodyText>Probabilidades estimadas pelo modelo; não representam certeza nem risco validado para a população da sua instituição. “Matriculado” não significa reprovação. O resultado não é associado automaticamente a nenhuma matrícula.</BodyText>
    </Panel>}
  </View>;
}
