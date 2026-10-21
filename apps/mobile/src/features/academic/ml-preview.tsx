import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSession } from '@/auth/session';
import { ActionButton, BodyText, Feedback, FormField, Panel, PanelTitle, academicStyles } from '@/demo/academic-ui';
import { parseMlFeatures, type MlPrediction, type MlSchema, type MlStatus } from '@/services/ml';

const labels = { Dropout: 'Evasão', Enrolled: 'Matriculado no recorte do dataset', Graduate: 'Conclusão' };

export function MlPreview() {
  const { request } = useSession();
  const [schema, setSchema] = useState<MlSchema | null>(null);
  const [status, setStatus] = useState<MlStatus | null>(null);
  const [input, setInput] = useState('');
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
      const features = parseMlFeatures(input, schema.features);
      setBusy(true);
      const prediction = await request<MlPrediction>('/ml/preview', { method: 'POST', body: { features } });
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
    {schema && <Panel><PanelTitle>{schema.features.length} atributos obrigatórios</PanelTitle><BodyText>{schema.features.join(', ')}</BodyText>
      <FormField label="Atributos numéricos (JSON)" multiline value={input} onChangeText={(text) => { if (!busy) { setInput(text); setResult(null); setError(''); } }} placeholder="Cole somente o objeto com os 36 atributos compatíveis com o dataset." />
      <ActionButton title={busy ? 'Aguarde…' : 'Executar modelo'} disabled={busy || !status?.ready || !schema.previewEnabled || !input.trim()} onPress={() => void predict()} />
    </Panel>}
    {!!error && <Feedback error message={error} />}
    {result && <Panel><PanelTitle>Resultado: {labels[result.predictedClass]}</PanelTitle><BodyText>Versão: {result.modelVersion}</BodyText>
      {(['Dropout', 'Enrolled', 'Graduate'] as const).map((key) => <BodyText key={key}>{labels[key]}: {(result.probabilities[key] * 100).toFixed(1)}%</BodyText>)}
      <BodyText>Probabilidades estimadas pelo modelo; não representam certeza nem risco validado para a população da sua instituição. “Matriculado” não significa reprovação. O resultado não é associado automaticamente a nenhuma matrícula.</BodyText>
    </Panel>}
  </View>;
}
