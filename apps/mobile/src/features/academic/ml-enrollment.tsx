import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSession } from '@/auth/session';
import { ActionButton, BodyText, Chip, Feedback, Panel, PanelTitle, academicStyles } from '@/demo/academic-ui';
import { type EnrollmentMl, type MlAutomaticPrediction, type MlImportResult, type MlImportedPrediction, type MlPrediction } from '@/services/ml';
import { chooseMlWorkbook, saveFile } from './files';

const CLASS_LABELS: Record<MlPrediction['predictedClass'], string> = {
  Dropout: 'Evasão', Enrolled: 'Matriculado', Graduate: 'Graduate (classe do modelo)',
};

export function MlEnrollments({ matriculas, onImported }: { matriculas: { id: string; label: string }[]; onImported?: () => void }) {
  const { state, request } = useSession();
  const admin = state.status === 'signedIn' && state.user.perfil === 'COORDENACAO';
  const [selected, setSelected] = useState('');
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
      onImported?.();
    } catch (cause: unknown) {
      setImportError(cause instanceof Error ? cause.message : 'Não foi possível importar a planilha.');
    } finally { setImportBusy(false); }
  }

  return <View style={academicStyles.stack}>
    {admin && <Panel>
      <PanelTitle>Importação Excel da coordenação</PanelTitle>
      <BodyText>Baixe o modelo Excel e preencha os atributos com as descrições das listas. Ao importar, a API converte as opções para os códigos do modelo, confere a turma e os vínculos docentes e salva a previsão experimental.</BodyText>
      <BodyText>Turma, período, disciplina e professor devem estar cadastrados. Alunos novos recebem a senha temporária Fatec@123 e precisam trocá-la no primeiro acesso.</BodyText>
      <ActionButton title="Baixar modelo Excel" secondary disabled={importBusy} onPress={() => void downloadTemplate()} />
      <ActionButton title="Selecionar e importar Excel" disabled={importBusy} onPress={() => void uploadWorkbook()} />
      <ActionButton title="Atualizar previsões experimentais" secondary disabled={importBusy} onPress={() => setListRevision((value) => value + 1)} />
      {importBusy && <BodyText>Processando planilha…</BodyText>}
      {!!importError && <Feedback error message={importError} />}
      {importResult && <>
        <Feedback message={`${importResult.usuariosCriados ?? 0} alunos criados, ${importResult.matriculasCriadas ?? 0} matrículas criadas, ${importResult.salvos} previsões experimentais salvas, ${importResult.repetidos} linhas repetidas e ${importResult.erros.length} erros de ${importResult.total} linhas.`} />
        {importResult.erros.map((item) => <Feedback key={`${item.linha}-${item.registro}`} error message={`Linha ${item.linha} (${item.registro}): ${item.motivo}`} />)}
      </>}
      <PanelTitle>Importações recentes</PanelTitle>
      {recent.slice(0, 10).map((item) => <BodyText key={item.id}>{item.registro}: {CLASS_LABELS[item.predictedClass]} · evasão {(item.probabilities.Dropout * 100).toFixed(1).replace('.', ',')}% · {item.atual ? 'perfil atual' : 'perfil alterado; veja o recálculo automático'}</BodyText>)}
      <PanelTitle>Recálculos automáticos</PanelTitle>
      <BodyText>Após uma importação inicial, mudanças em perfis completos geram novas previsões experimentais em segundo plano, normalmente em até um minuto. Cada resultado registra a versão do perfil e do modelo; nenhuma previsão é liberada ao aluno.</BodyText>
      {automatic.slice(0, 10).map((item) => <BodyText key={item.id}>{item.registro} · perfil v{item.perfilVersao} · modelo {item.modelVersion}: {CLASS_LABELS[item.predictedClass]} · evasão {(item.probabilities.Dropout * 100).toFixed(1).replace('.', ',')}% · {item.atual ? 'perfil atual' : 'perfil histórico'}</BodyText>)}
    </Panel>}
    <Panel><PanelTitle>Dados para previsão</PanelTitle>
      <BodyText>Selecione uma matrícula para consultar a disponibilidade da análise. A entrada dos atributos é feita pela planilha Excel.</BodyText>
      <BodyText>Protótipo para faculdades privadas com base portuguesa. Este modelo exige informações do 1º e do 2º semestre e não serve para prever um aluno recém-matriculado. Os códigos ainda precisam de equivalência institucional.</BodyText>
      <View style={academicStyles.chips}>{matriculas.map((item) => <Chip key={item.id} label={item.label} selected={item.id === id} onPress={() => setSelected(item.id)} />)}</View>
      {!id && <BodyText>Nenhum aluno matriculado nesta turma.</BodyText>}
    </Panel>
    {id && <EnrollmentReadiness key={`${id}-${profileRevision}`} id={id} />}
  </View>;
}

function EnrollmentReadiness({ id }: { id: string }) {
  const { state, request } = useSession();
  const role = state.status === 'signedIn' ? state.user.perfil : null;
  const [profile, setProfile] = useState<EnrollmentMl | null>(null);
  const [impedimentos, setImpedimentos] = useState<string[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const path = `/ml/matriculas/${encodeURIComponent(id)}`;
  useEffect(() => {
    let active = true;
    void request<EnrollmentMl>(path).then((nextProfile) => {
      if (active) setProfile(nextProfile);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar a matrícula.');
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [path, request, revision]);

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

  return <Panel>
    <PanelTitle>{profile ? `${profile.aluno} · ${profile.registro}` : 'Matrícula'}</PanelTitle>
    {busy && <BodyText>Carregando dados…</BodyText>}
    {!!error && <Feedback error message={error} />}
    {profile && <>
      <BodyText>{profile.faltantes.length ? `${profile.faltantes.length} de 36 informações ainda não preenchidas.` : 'As 36 informações necessárias estão preenchidas.'}</BodyText>
      {role !== 'COORDENACAO' && <ActionButton title="Verificar disponibilidade da análise" disabled={busy} onPress={() => void check()} />}
      {impedimentos.map((item) => <Feedback key={item} message={item} error />)}
    </>}
    <ActionButton title="Atualizar dados" secondary disabled={busy} onPress={() => { setBusy(true); setError(''); setRevision((value) => value + 1); }} />
  </Panel>;
}
