import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/auth/session';
import { TextButton } from '@/components/primitives';
import { palette, space, type } from '@/constants/design';
import { ActionButton, BodyText, Chip, Feedback, Panel, PanelTitle, StatStrip, academicStyles } from '@/demo/academic-ui';
import { chooseMlWorkbook, saveFile, saveWorkbookTemplate } from '@/features/academic/files';
import { credentialsCsv, splitProblems, summaryLines, type Credential, type PeopleImportResult, type ProblemList } from './credentials';

type ImportProfile = 'ALUNO' | 'PROFESSOR';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PROFILE_LABEL: Record<ImportProfile, string> = { ALUNO: 'Estudantes', PROFESSOR: 'Docentes' };
const messageOf = (cause: unknown, fallback: string) => (cause instanceof Error ? cause.message : fallback);
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** As senhas temporárias, mostradas uma vez e salváveis em planilha: o servidor não guarda a senha em texto. */
export function CredentialsList({ items, fileName, onDone }: { items: Credential[]; fileName: string; onDone?: () => void }) {
  const [error, setError] = useState('');
  async function save() {
    setError('');
    try {
      const bytes = new TextEncoder().encode(credentialsCsv(items));
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      await saveFile({ id: 'credenciais', nome: fileName, mime: 'text/csv', tamanho: buffer.byteLength }, buffer);
    } catch (cause) { setError(messageOf(cause, 'Não foi possível salvar o arquivo.')); }
  }
  return <Panel>
    <PanelTitle>{items.length === 1 ? 'Senha temporária' : 'Senhas temporárias'}</PanelTitle>
    <BodyText>Salve agora: não aparecem de novo. Cada pessoa troca a senha no primeiro acesso.</BodyText>
    <View>{items.map((item, index) => <View key={item.email} style={[styles.credential, index > 0 && styles.credentialRule]}>
      <View style={styles.credentialWho}>
        <Text numberOfLines={1} style={styles.name}>{item.nome}</Text>
        <Text selectable numberOfLines={1} style={styles.email}>{item.email}</Text>
      </View>
      <Text selectable accessibilityLabel={`Senha temporária de ${item.nome}`} style={styles.password}>{item.senhaTemporaria}</Text>
    </View>)}</View>
    <View style={styles.actions}>
      <ActionButton compact title="Salvar como planilha (CSV)" onPress={() => void save()} />
      {onDone ? <TextButton flush title="Já salvei, concluir" onPress={onDone} /> : null}
    </View>
    {!!error && <Feedback error message={error} />}
  </Panel>;
}

/** Problemas da planilha: a frase-resumo e uma linha por problema, com o número da linha em destaque. */
function Problems({ problems }: { problems: ProblemList }) {
  return <View accessibilityRole="alert" style={styles.problems}>
    {!!problems.headline && <Text style={styles.problemsTitle}>{problems.headline}</Text>}
    {problems.items.map((item, index) => <View key={`${item.where}-${index}`} style={styles.problem}>
      {!!item.where && <Text style={styles.problemWhere}>{item.where}</Text>}
      <Text style={styles.problemText}>{item.text}</Text>
    </View>)}
  </View>;
}

/**
 * Cadastro em lote em etapas, uma ação primária por vez: escolher a planilha → conferir (nada é gravado)
 * → importar → senhas. Com erro, mostra cada linha com problema e nada é importado. Aceita também a
 * planilha do importador de previsões: só as colunas de cadastro são lidas.
 */
export function PeopleImport({ profiles, onImported, onClose }: { profiles: ImportProfile[]; onImported?: () => void; onClose?: () => void }) {
  const { request } = useSession();
  const [profile, setProfile] = useState<ImportProfile>(profiles[0]);
  const [picked, setPicked] = useState<FormData | null>(null);
  const [preview, setPreview] = useState<PeopleImportResult | null>(null);
  const [result, setResult] = useState<PeopleImportResult | null>(null);
  const [problems, setProblems] = useState<ProblemList | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const path = (simulate: boolean) => `/usuarios/importacoes?perfil=${profile}${simulate ? '&simular=true' : ''}`;

  function reset() { setPicked(null); setPreview(null); setResult(null); setProblems(null); setNotice(''); }
  function finish() { reset(); onClose?.(); }

  async function downloadTemplate() {
    setBusy(true); setProblems(null); setNotice('');
    try {
      const bytes = await request<ArrayBuffer>(`/usuarios/importacoes/modelo?perfil=${profile}`, { binary: true });
      const name = `modelo-cadastro-${profile === 'ALUNO' ? 'alunos' : 'professores'}.xlsx`;
      if (await saveWorkbookTemplate({ id: 'modelo-cadastro', nome: name, mime: XLSX, tamanho: bytes.byteLength }, bytes)) setNotice('Modelo salvo ou enviado para compartilhamento.');
    } catch (cause) { setProblems(splitProblems(messageOf(cause, 'Não foi possível baixar o modelo.'))); }
    finally { setBusy(false); }
  }

  async function choose() {
    reset();
    try {
      const form = await chooseMlWorkbook();
      if (!form) return;
      setBusy(true);
      setPreview(await request<PeopleImportResult>(path(true), { method: 'POST', body: form }));
      setPicked(form);
    } catch (cause) { setProblems(splitProblems(messageOf(cause, 'Não foi possível conferir a planilha.'))); }
    finally { setBusy(false); }
  }

  async function confirm() {
    if (!picked) return;
    setBusy(true); setProblems(null);
    try {
      setResult(await request<PeopleImportResult>(path(false), { method: 'POST', body: picked }));
      setPreview(null); setPicked(null);
      onImported?.();
    } catch (cause) { setProblems(splitProblems(messageOf(cause, 'Não foi possível importar a planilha.'))); }
    finally { setBusy(false); }
  }

  const students = profile === 'ALUNO';
  const stats = (summary: PeopleImportResult['resumo']) => [
    { label: 'Contas novas', value: String(summary.usuariosNovos) },
    { label: 'Já cadastradas', value: String(summary.usuariosExistentes) },
    ...(students ? [{ label: 'Matrículas novas', value: String(summary.matriculasNovas) }] : []),
  ];
  const nothingNew = preview !== null && preview.resumo.usuariosNovos === 0 && preview.resumo.matriculasNovas === 0;
  const importLabel = preview
    ? preview.resumo.usuariosNovos
      ? `Importar ${plural(preview.resumo.usuariosNovos, 'conta', 'contas')}`
      : `Importar ${plural(preview.resumo.matriculasNovas, 'matrícula', 'matrículas')}`
    : '';

  return <View style={academicStyles.stack}>
    <Panel>
      <View style={styles.head}>
        <PanelTitle>Importar planilha</PanelTitle>
        {onClose && !result ? <TextButton title="Fechar" onPress={finish} /> : null}
      </View>

      {!result && !preview && <>
        {profiles.length > 1 && <View style={academicStyles.chips}>{profiles.map((item) => <Chip key={item} label={PROFILE_LABEL[item]} selected={profile === item} onPress={() => { setProfile(item); reset(); }} />)}</View>}
        <BodyText>Cada linha é uma pessoa. A conferência vem antes: nada é gravado até você confirmar.</BodyText>
        <View style={styles.actions}>
          <ActionButton compact title={busy ? 'Conferindo…' : problems ? 'Escolher outra planilha' : 'Escolher planilha (.xlsx)'} disabled={busy} onPress={() => void choose()} />
          <TextButton flush title="Baixar modelo" onPress={() => void downloadTemplate()} />
        </View>
        {!!notice && <Feedback message={notice} />}
        {problems && <Problems problems={problems} />}
      </>}

      {preview && <>
        <StatStrip items={stats(preview.resumo)} />
        <BodyText>{nothingNew
          ? `${plural(preview.resumo.linhas, 'linha lida', 'linhas lidas')}: tudo já está cadastrado, não há o que importar.`
          : `${plural(preview.resumo.linhas, 'linha lida', 'linhas lidas')}. Nada foi gravado ainda.${students && preview.resumo.matriculasExistentes ? ` ${plural(preview.resumo.matriculasExistentes, 'matrícula já existia', 'matrículas já existiam')}.` : ''}`}</BodyText>
        <View style={styles.actions}>
          {!nothingNew && <ActionButton compact title={busy ? 'Importando…' : importLabel} disabled={busy} onPress={() => void confirm()} />}
          <TextButton flush title="Escolher outra planilha" onPress={reset} />
        </View>
        {problems && <Problems problems={problems} />}
      </>}

      {result && <>
        <Feedback message={`Importação concluída: ${summaryLines(result.resumo, students).slice(0, students ? 3 : 1).join(' · ')}.`} />
        {!result.credenciais.length && <>
          <BodyText>Nenhuma conta nova: todas as pessoas já estavam cadastradas.</BodyText>
          <ActionButton compact secondary title="Concluir" onPress={finish} />
        </>}
      </>}
    </Panel>
    {/* Com senhas novas, "concluir" vem depois delas: sair antes de salvar perde as senhas, que só aparecem uma vez. */}
    {result && result.credenciais.length > 0 && <CredentialsList items={result.credenciais} fileName={`senhas-temporarias-${new Date().toISOString().slice(0, 10)}.csv`} onDone={finish} />}
  </View>;
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: space.lg, rowGap: space.xs },
  credential: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, paddingVertical: space.md },
  credentialRule: { borderTopWidth: 1, borderTopColor: palette.line },
  credentialWho: { flex: 1, gap: 1 },
  name: { color: palette.ink, ...type.label },
  email: { color: palette.muted, ...type.caption },
  password: { color: palette.ink, fontFamily: 'monospace', fontSize: 16, letterSpacing: 0.8, fontWeight: '700' },
  problems: { gap: space.sm },
  problemsTitle: { color: palette.dangerStrong, ...type.label },
  problem: { flexDirection: 'row', gap: space.sm, alignItems: 'baseline' },
  problemWhere: { color: palette.ink, ...type.label, minWidth: 64, fontVariant: ['tabular-nums'] },
  problemText: { flex: 1, color: palette.ink, ...type.body },
});
