import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSession } from '@/auth/session';
import { ActionButton, BodyText, Chip, Feedback, Panel, PanelTitle, academicStyles } from '@/demo/academic-ui';
import { canEditMl, type EnrollmentMl, type MlPrediction, type MlSchema, type MlStatus } from '@/services/ml';
import { MlProfileForm } from './ml-profile-form';

type EconomicFields = Record<'desemprego' | 'inflacao' | 'pib', number>;

const CLASS_LABELS: Record<MlPrediction['predictedClass'], string> = {
  Dropout: 'Evasão', Enrolled: 'Matriculado', Graduate: 'Concluído',
};

export function MlEnrollments({ matriculas }: { matriculas: { id: string; label: string }[] }) {
  const [selected, setSelected] = useState('');
  const [economicPreset, setEconomicPreset] = useState<EconomicFields | null>(null);
  const id = matriculas.some((item) => item.id === selected) ? selected : matriculas[0]?.id;
  return <View style={academicStyles.stack}>
    <Panel><PanelTitle>Dados para previsão</PanelTitle>
      <BodyText>Selecione uma matrícula para preencher as informações usadas pelo modelo.</BodyText>
      <BodyText>Protótipo com base portuguesa. Este modelo exige informações do 1º e do 2º semestre e não serve para prever um aluno recém-matriculado. Os códigos e as categorias ainda não foram validados para estudantes brasileiros.</BodyText>
      <View style={academicStyles.chips}>{matriculas.map((item) => <Chip key={item.id} label={item.label} selected={item.id === id} onPress={() => setSelected(item.id)} />)}</View>
      {!id && <BodyText>Nenhum aluno matriculado nesta turma.</BodyText>}
    </Panel>
    {id && <EnrollmentReadiness key={id} id={id} economicPreset={economicPreset} onEconomicPreset={setEconomicPreset} />}
  </View>;
}

function EnrollmentReadiness({ id, economicPreset, onEconomicPreset }: {
  id: string;
  economicPreset: EconomicFields | null;
  onEconomicPreset: (values: EconomicFields) => void;
}) {
  const { state, request } = useSession();
  const role = state.status === 'signedIn' ? state.user.perfil : null;
  const [profile, setProfile] = useState<EnrollmentMl | null>(null);
  const [schema, setSchema] = useState<MlSchema | null>(null);
  const [status, setStatus] = useState<MlStatus | null>(null);
  const [preview, setPreview] = useState<MlPrediction | null>(null);
  const [editing, setEditing] = useState(false);
  const [impedimentos, setImpedimentos] = useState<string[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const path = `/ml/matriculas/${encodeURIComponent(id)}`;
  const editor = canEditMl(role);

  useEffect(() => {
    let active = true;
    void Promise.all([
      request<EnrollmentMl>(path),
      editor ? request<MlSchema>('/ml/schema') : Promise.resolve(null),
      role === 'ADMIN' ? request<MlStatus>('/ml/status') : Promise.resolve(null),
    ]).then(([nextProfile, nextSchema, nextStatus]) => {
      if (active) { setProfile(nextProfile); setSchema(nextSchema); setStatus(nextStatus); }
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar a matrícula.');
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [path, request, revision, editor, role]);

  async function save(features: Record<string, number>) {
    if (!profile) return;
    const next = await request<EnrollmentMl>(path, { method: 'PUT', body: { versao: profile.versao, features } });
    setProfile(next);
    setPreview(null);
    setEditing(false);
    setNotice('Informações salvas nesta matrícula.');
    const { desemprego, inflacao, pib } = features;
    if ([desemprego, inflacao, pib].every(Number.isFinite)) onEconomicPreset({ desemprego, inflacao, pib });
  }

  async function check() {
    setBusy(true); setError(''); setImpedimentos([]);
    try {
      const result = await request<EnrollmentMl>(`${path}/analisar`, { method: 'POST' });
      setProfile(result);
      setImpedimentos(result.impedimentos ?? []);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível verificar a análise.');
    } finally { setBusy(false); }
  }

  async function runPreview() {
    if (!profile?.features || profile.faltantes.length) return;
    setBusy(true); setError(''); setPreview(null);
    try {
      const result = await request<MlPrediction>('/ml/preview', { method: 'POST', body: { inputFormat: 'original', features: profile.features } });
      setPreview(result);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível calcular a prévia.');
    } finally { setBusy(false); }
  }

  if (profile && schema && editing) return <MlProfileForm profile={profile} schema={schema} economicPreset={economicPreset} onSave={save} onCancel={() => setEditing(false)} />;

  const previewReady = role === 'ADMIN' && schema?.previewEnabled && status?.ready && status.originalInputReady;
  return <Panel>
    <PanelTitle>{profile ? `${profile.aluno} · ${profile.registro}` : 'Matrícula'}</PanelTitle>
    {busy && <BodyText>Carregando dados…</BodyText>}
    {!!error && <Feedback error message={error} />}
    {!!notice && <Feedback message={notice} />}
    {profile && <>
      <BodyText>{profile.faltantes.length ? `${profile.faltantes.length} de 36 informações ainda não preenchidas.` : 'As 36 informações necessárias estão preenchidas.'}</BodyText>
      {editor && schema && <ActionButton title="Preencher ou editar informações" disabled={busy} onPress={() => { setNotice(''); setEditing(true); }} />}
      {role === 'ADMIN' && <ActionButton title="Testar previsão" disabled={busy || !!profile.faltantes.length || !previewReady} onPress={() => void runPreview()} />}
      {role === 'ADMIN' && !previewReady && <BodyText>A prévia técnica depende do serviço de ML ativo e da configuração de prévia na API.</BodyText>}
      {role !== 'ADMIN' && <ActionButton title="Verificar disponibilidade da análise" disabled={busy} onPress={() => void check()} />}
      {impedimentos.map((item) => <Feedback key={item} message={item} error />)}
      {preview && <>
        <PanelTitle>Prévia técnica · {CLASS_LABELS[preview.predictedClass]}</PanelTitle>
        <BodyText>Estimativa experimental do modelo {preview.modelVersion}, treinado com base portuguesa; não salva na matrícula nem foi validada para a Fatec.</BodyText>
        <BodyText>Evasão: {(preview.probabilities.Dropout * 100).toFixed(1).replace('.', ',')}% · Matriculado: {(preview.probabilities.Enrolled * 100).toFixed(1).replace('.', ',')}% · Concluído: {(preview.probabilities.Graduate * 100).toFixed(1).replace('.', ',')}%</BodyText>
      </>}
    </>}
    <ActionButton title="Atualizar dados" secondary disabled={busy} onPress={() => { setBusy(true); setError(''); setNotice(''); setPreview(null); setRevision((value) => value + 1); }} />
  </Panel>;
}
