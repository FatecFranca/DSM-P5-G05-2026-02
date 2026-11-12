import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/auth/session';
import { TextButton } from '@/components/primitives';
import { TopBar, useGoBack } from '@/components/top-bar';
import { palette, radius, space, type } from '@/constants/design';
import { ActionButton, Avatar, EmptyState, Feedback, ListRow, SegmentTabs, SkeletonRows } from '@/demo/academic-ui';
import { Editor, type EditorConfig } from '@/features/academic/editor';
import { RequestState } from '@/features/connected/ui';
import { useAcademicOverview } from '@/features/connected/overview';
import { useImportedPredictions } from '@/features/connected/use-predictions';
import { ApiError, type Perfil, type UserSummary } from '@/services/api';
import type { Credential } from './credentials';
import { CredentialsList, PeopleImport } from './people-import';
import { ROLE_ORDER, ROLE_TAB_LABEL, countByRole, filterPeople, initialRole, resolveRole, sortPeople, visibleRoles, type SortKey } from './people-model';

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const roleNoun: Record<Perfil, [string, string]> = {
  ALUNO: ['estudante', 'estudantes'], PROFESSOR: ['docente', 'docentes'], TUTOR: ['pessoa da tutoria', 'pessoas da tutoria'],
  COORDENACAO: ['pessoa da coordenação', 'pessoas da coordenação'], SECRETARIA: ['pessoa da secretaria', 'pessoas da secretaria'],
};

/**
 * Pessoas da instituição (coordenação). A lista é o que importa: busca e abas por perfil (com a contagem)
 * vêm logo acima, e há uma ação principal, "Cadastrar pessoa". A importação por planilha é uma tarefa que
 * se abre sob demanda, e não um bloco fixo empurrando a lista para baixo.
 */
export function PeopleScreen() {
  const router = useRouter();
  const goBack = useGoBack('/connected');
  const { bottom } = useSafeAreaInsets();
  const { state, request } = useSession();
  const apiMode = state.status === 'signedIn' && state.mode === 'api';
  const perfil = state.status === 'signedIn' ? state.user.perfil : null;
  const canManage = perfil === 'COORDENACAO';
  const overview = useAcademicOverview(canManage);
  const analysis = useImportedPredictions(canManage);
  const [users, setUsers] = useState<UserSummary[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Perfil | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('nome');
  const [importing, setImporting] = useState(false);
  const [editor, setEditor] = useState<EditorConfig | null>(null);
  const [notice, setNotice] = useState('');
  const [credential, setCredential] = useState<Credential | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setUsers(await request<UserSummary[]>('/usuarios')); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Não foi possível carregar as pessoas.'); }
    finally { setLoading(false); }
  }, [request]);

  useEffect(() => {
    if (!apiMode) return;
    void Promise.resolve().then(load);
  }, [apiMode, load]);

  const people = useMemo(() => users ?? [], [users]);
  const totals = useMemo(() => countByRole(people), [people]);
  const counts = useMemo(() => countByRole(people, query), [people, query]);
  const chosen = role ?? initialRole(totals);
  // Com busca, mostra o perfil que tem resultado em vez de pedir para trocar de aba.
  const selected = resolveRole(chosen, counts, query);
  const rows = useMemo(() => sortPeople(filterPeople(people, selected, query), sort), [people, selected, query, sort]);

  if (state.status === 'loading') return null;
  if (state.status !== 'signedIn') return <Redirect href="/login" />;
  if (!apiMode || perfil === 'ALUNO') return <Redirect href="/home" />;

  function openCreate() {
    setNotice(''); setImporting(false);
    setEditor({ title: 'Cadastrar pessoa', fields: [
      { key: 'nome', label: 'Nome' },
      { key: 'email', label: 'E-mail' },
      { key: 'perfil', label: 'Perfil', initial: selected, options: ROLE_ORDER.map((item) => ({ id: item, label: ROLE_TAB_LABEL[item] })) },
    ], submit: async (values) => {
      // Sem senha digitada: o servidor gera uma temporária, a pessoa troca no primeiro acesso.
      const created = await request<UserSummary & { senhaTemporaria?: string }>('/usuarios', { method: 'POST', body: { nome: values.nome.trim(), email: values.email.trim(), perfil: values.perfil } });
      setRole(values.perfil as Perfil); setQuery('');
      if (created.senhaTemporaria) setCredential({ linha: 0, nome: created.nome, email: created.email, registro: null, senhaTemporaria: created.senhaTemporaria });
      setNotice(values.perfil === 'ALUNO' ? 'Pessoa cadastrada. Para matricular, abra a turma e vá em Pessoas.'
        : values.perfil === 'PROFESSOR' ? 'Pessoa cadastrada. Para vincular a uma disciplina, abra a turma e vá em Pessoas.'
          : values.perfil === 'TUTOR' ? 'Pessoa cadastrada. Para vincular a um estudante, abra a turma e vá em Pessoas.'
            : 'Pessoa cadastrada.');
      await load();
    } });
  }

  const firstUse = users !== null && people.length === 0;
  const roleLabel = ROLE_TAB_LABEL[selected];

  const empty = loading || error || users === null ? undefined
    : firstUse
      ? <EmptyState title="Nenhuma pessoa cadastrada" detail="Cadastre a primeira pessoa ou importe uma planilha com a turma inteira." action={canManage ? <View style={styles.inline}><ActionButton compact title="Cadastrar pessoa" onPress={openCreate} /><TextButton flush title="Importar planilha" onPress={() => setImporting(true)} /></View> : undefined} />
      : query
        ? <EmptyState title="Ninguém encontrado" detail={`Nenhum nome ou e-mail com “${query.trim()}” entre as pessoas cadastradas.`} action={<TextButton title="Limpar busca" onPress={() => setQuery('')} />} />
        : <EmptyState title={`Nenhum cadastro em ${roleLabel}`} detail={`Ainda não há ${roleNoun[selected][1]} cadastrados nesta Fatec.`} action={canManage ? <ActionButton compact title="Cadastrar pessoa" onPress={openCreate} /> : undefined} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <FlatList
        data={editor ? [] : rows}
        keyExtractor={(user) => user.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.list, { paddingBottom: space.xl + bottom }]}
        renderItem={({ item, index }) => <View style={[styles.row, index === 0 && styles.rowFirst, index === rows.length - 1 && styles.rowLast]}>
          <ListRow
            leading={<Avatar name={item.nome} size={40} />}
            title={item.nome}
            meta={item.email}
            muted={!item.ativo}
            badge={!item.ativo ? { text: 'Inativo', tone: 'danger' } : item.perfil === 'ALUNO' && canManage ? (() => {
              const predictions = (overview.data?.enrollments ?? []).filter((entry) => entry.userId === item.id).flatMap((entry) => analysis.predictions[entry.registration] ? [analysis.predictions[entry.registration]] : []);
              if (!predictions.length) return undefined;
              const dropout = Math.max(...predictions.map((prediction) => prediction.probabilities.Dropout));
              const graduate = Math.max(...predictions.map((prediction) => prediction.probabilities.Graduate));
              return dropout > graduate ? { text: `Evasão ${Math.round(dropout * 100)}%`, tone: 'danger' as const } : { text: `Conclusão ${Math.round(graduate * 100)}%`, tone: 'ok' as const };
            })() : undefined}
            onPress={() => router.push({ pathname: '/person/[id]', params: { id: item.id } })} />
        </View>}
        ListHeaderComponent={<View style={styles.header}>
          <TopBar onBack={goBack} />
          <View style={styles.titleRow}>
            <View style={styles.titleText}>
              <Text accessibilityRole="header" style={styles.title}>Pessoas</Text>
              {users ? <Text style={styles.subtitle}>{plural(people.length, 'cadastro', 'cadastros')} nesta Fatec</Text> : null}
            </View>
            {canManage && users && !editor ? <ActionButton compact title="Cadastrar pessoa" onPress={openCreate} /> : null}
          </View>

          {editor ? <Editor config={editor} close={() => setEditor(null)} /> : null}
          {credential ? <CredentialsList items={[credential]} fileName="senha-temporaria.csv" onDone={() => setCredential(null)} /> : null}
          {!!notice && <Feedback message={notice} />}
          {canManage && importing && !editor ? <PeopleImport profiles={['ALUNO', 'PROFESSOR']} onImported={() => { setNotice(''); void load(); }} onClose={() => setImporting(false)} /> : null}

          {loading && !users ? <SkeletonRows count={6} /> : null}
          <RequestState loading={false} error={error} onRetry={() => void load()} />

          {users && !editor ? <>
            <TextInput
              accessibilityLabel="Buscar pessoa"
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar por nome ou e-mail"
              placeholderTextColor={palette.muted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              style={styles.search} />
            <SegmentTabs
              label="Perfil"
              selected={selected}
              onSelect={(next) => setRole(next)}
              items={visibleRoles(totals, selected).map((item) => ({ key: item, label: ROLE_TAB_LABEL[item], count: counts[item] }))} />
            <View style={styles.metaRow}>
              <Text accessibilityLiveRegion="polite" style={styles.count}>{query ? `${plural(rows.length, 'resultado', 'resultados')} em ${roleLabel}` : plural(rows.length, roleNoun[selected][0], roleNoun[selected][1])}</Text>
              <View style={styles.metaActions}>
                {rows.length > 1 ? <TextButton title={sort === 'nome' ? 'Ordem: nome' : 'Ordem: mais recentes'} onPress={() => setSort(sort === 'nome' ? 'recentes' : 'nome')} /> : null}
                {canManage && !importing ? <TextButton title="Importar planilha" onPress={() => { setNotice(''); setImporting(true); }} /> : null}
              </View>
            </View>
          </> : null}
        </View>}
        ListEmptyComponent={empty}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  list: { alignSelf: 'center', width: '100%', maxWidth: 900, paddingHorizontal: space.lg, paddingTop: space.lg },
  header: { gap: space.md, marginBottom: space.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  titleText: { flex: 1, gap: 2 },
  title: { color: palette.ink, ...type.title },
  subtitle: { color: palette.muted, ...type.body },
  search: { minHeight: 48, borderWidth: 1, borderColor: palette.line, borderRadius: radius.md, backgroundColor: palette.surface, color: palette.ink, paddingHorizontal: space.lg, fontSize: 15 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', columnGap: space.md },
  count: { color: palette.muted, ...type.label, fontWeight: '600' },
  inline: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: space.sm },
  // O botão de texto tem 12 pt de respiro de cada lado; a margem negativa alinha o texto com a borda da coluna.
  metaActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginHorizontal: -12 },
  // As linhas formam um único bloco com filetes, e não um cartão por pessoa.
  row: { backgroundColor: palette.surface, borderColor: palette.line, borderLeftWidth: 1, borderRightWidth: 1, borderTopWidth: 1, paddingHorizontal: space.lg },
  rowFirst: { borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md },
  rowLast: { borderBottomWidth: 1, borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md },
});
