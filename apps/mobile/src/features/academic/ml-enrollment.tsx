import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSession } from '@/auth/session';
import { ActionButton, BodyText, Chip, Feedback, Panel, PanelTitle, academicStyles } from '@/demo/academic-ui';
import { canEditMl, type EnrollmentMl, type MlAutomaticPrediction, type MlImportResult, type MlImportedPrediction, type MlPrediction, type MlSchema, type MlStatus } from '@/services/ml';
import { MlProfileForm } from './ml-profile-form';
import { chooseMlWorkbook, saveFile } from './files';

type EconomicFields = Record<'desemprego' | 'inflacao' | 'pib', number>;

const CLASS_LABELS: Record<MlPrediction['predictedClass'], string> = {
  Dropout: 'Evasão', Enrolled: 'Matriculado', Graduate: 'Graduate (classe do modelo)',
};

export function MlEnrollments({ matriculas }: { matriculas: { id: string; label: string }[] }) {
  const { state, request } = useSession();
  const admin = state.status === 'signedIn' && state.user.perfil === 'ADMIN';
  const [selected, setSelected] = useState('');
  const [economicPreset, setEconomicPreset] = useState<EconomicFields | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState('');
  const [importResult, setImportResult] = useState<MlImportResult | null>(null);
  const [recent, setRecent] = useState<MlImportedPrediction[]>([]);
  const [automatic, setAutomatic] = useState<MlAutomaticPrediction[]>([]);
  const [listRevision, setListRevision] = useState(0);
  const [profileRevision, setProfileRevision] = useState(0);
  const id = matriculas.some((item) => item.id === selected) ? selected : matriculas[0]?.id;
  useEffect(() => {
    if (!admin) return;
    let active = true;
    void Promise.all([
      request<MlImportedPrediction[]>('/ml/importacoes'),
      request<MlAutomaticPrediction[]>('/ml/previsoes-automaticas'),
    ]).then(([items, auto]) => { if (active) { setRecent(items); setAutomatic(auto); } }).catch((cause: unknown) => {
      if (active) setImportError(cause instanceof Error ? cause.message : 'Não foi possível carregar as previsões experimentais.');
    });
    return () => { active = false; };
  }, [admin, request, listRevision]);

  async function downloadTemplate() {
    setImportBusy(true); setImportError('');
    try {
      const bytes = await request<ArrayBuffer>('/ml/importacoes/modelo', { binary: true });
      await saveFile({ id: 'ml-importacao', nome: 'modelo-importacao-ml.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', tamanho: bytes.byteLength }, bytes);
    } catch (cause: unknown) {
      setImportError(cause instanceof Error ? cause.message : 'Não foi possível baixar a planilha.');
    } finally { setImportBusy(false); }
  }

  async function uploadWorkbook() {
    setImportError(''); setImportResult(null);
    try {
      const form = await chooseMlWorkbook();
      if (!form) return;
      setImportBusy(true);
      const result = await request<MlImportResult>('/ml/importacoes', { method: 'POST', body: form });
      setImportResult(result);
      setListRevision((value) => value + 1);
      setProfileRevision((value) => value + 1);
    } catch (cause: unknown) {
      setImportError(cause instanceof Error ? cause.message : 'Não foi possível importar a planilha.');
    } finally { setImportBusy(false); }
  }

  return <View style={academicStyles.stack}>
    {admin && <Panel>
      <PanelTitle>Importação Excel do ADMIN</PanelTitle>
      <BodyText>Envie até 100 matrículas por arquivo XLSX. Os perfis e as previsões são salvos com o modelo .pkl ativo. As previsões são experimentais e ficam restritas à administração.</BodyText>
      <ActionButton title="Baixar modelo Excel" secondary disabled={importBusy} onPress={() => void downloadTemplate()} />
      <ActionButton title="Selecionar e importar Excel" disabled={importBusy} onPress={() => void uploadWorkbook()} />
      <ActionButton title="Atualizar previsões experimentais" secondary disabled={importBusy} onPress={() => setListRevision((value) => value + 1)} />
      {importBusy && <BodyText>Processando planilha…</BodyText>}
      {!!importError && <Feedback error message={importError} />}
      {importResult && <>
        <Feedback message={`${importResult.salvos} previsões salvas, ${importResult.repetidos} linhas repetidas e ${importResult.erros.length} erros de ${importResult.total} matrículas.`} />
        {importResult.erros.map((item) => <Feedback key={`${item.linha}-${item.registro}`} error message={`Linha ${item.linha} (${item.registro}): ${item.motivo}`} />)}
      </>}
      <PanelTitle>Importações recentes</PanelTitle>
      {recent.slice(0, 10).map((item) => <BodyText key={item.id}>{item.registro}: {CLASS_LABELS[item.predictedClass]} · evasão {(item.probabilities.Dropout * 100).toFixed(1).replace('.', ',')}% · {item.atual ? 'perfil atual' : 'perfil alterado; veja o recálculo automático'}</BodyText>)}
      <PanelTitle>Recálculos automáticos</PanelTitle>
      <BodyText>Após uma importação inicial, mudanças em perfis completos geram novas previsões experimentais em segundo plano, normalmente em até um minuto. Cada resultado registra a versão do perfil e do modelo; nenhuma previsão é liberada ao aluno.</BodyText>
      {automatic.slice(0, 10).map((item) => <BodyText key={item.id}>{item.registro} · perfil v{item.perfilVersao} · modelo {item.modelVersion}: {CLASS_LABELS[item.predictedClass]} · evasão {(item.probabilities.Dropout * 100).toFixed(1).replace('.', ',')}% · {item.atual ? 'perfil atual' : 'perfil histórico'}</BodyText>)}
    </Panel>}
    <Panel><PanelTitle>Dados para previsão</PanelTitle>
      <BodyText>Selecione uma matrícula para preencher as informações usadas pelo modelo.</BodyText>
      <BodyText>Protótipo para faculdades privadas com base portuguesa. Este modelo exige informações do 1º e do 2º semestre e não serve para prever um aluno recém-matriculado. Os códigos ainda precisam de equivalência institucional.</BodyText>
      <View style={academicStyles.chips}>{matriculas.map((item) => <Chip key={item.id} label={item.label} selected={item.id === id} onPress={() => setSelected(item.id)} />)}</View>
      {!id && <BodyText>Nenhum aluno matriculado nesta turma.</BodyText>}
    </Panel>
    {id && <EnrollmentReadiness key={`${id}-${profileRevision}`} id={id} economicPreset={economicPreset} onEconomicPreset={setEconomicPreset} />}
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
        <BodyText>Estimativa experimental do modelo {preview.modelVersion}, treinado com base portuguesa; esta prévia individual não é salva nem foi validada para os alunos desta instituição.</BodyText>
        <BodyText>Evasão: {(preview.probabilities.Dropout * 100).toFixed(1).replace('.', ',')}% · Graduate: {(preview.probabilities.Graduate * 100).toFixed(1).replace('.', ',')}%{typeof preview.probabilities.Enrolled === 'number' ? ` · Matriculado: ${(preview.probabilities.Enrolled * 100).toFixed(1).replace('.', ',')}%` : ''}</BodyText>
        {typeof preview.probabilities.Enrolled !== 'number' && <BodyText>Este modelo compara apenas Dropout e Graduate; ele não prevê a classe Enrolled.</BodyText>}
      </>}
    </>}
    <ActionButton title="Atualizar dados" secondary disabled={busy} onPress={() => { setBusy(true); setError(''); setNotice(''); setPreview(null); setRevision((value) => value + 1); }} />
  </Panel>;
}
