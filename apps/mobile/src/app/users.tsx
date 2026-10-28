import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSession } from '@/auth/session';
import { SectionTitle, TextButton } from '@/components/primitives';
import { TopBar } from '@/components/top-bar';
import { palette, roleLabel } from '@/constants/design';
import { Editor, type EditorConfig } from '@/features/academic/editor';
import { DataNotice } from '@/features/connected/ui';
import { ApiError, type InstituicaoOption, type Perfil, type UserSummary } from '@/services/api';
import { api } from '@/services/api-config';

export default function UsersScreen() {
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  const { state, request } = useSession();
  const role = state.status === 'signedIn' ? state.user.perfil : null;
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [instituicoes, setInstituicoes] = useState<InstituicaoOption[]>([]);
  const [selectedInstitution, setSelectedInstitution] = useState('all');
  const [selectedRole, setSelectedRole] = useState<Perfil | 'ALL'>('ALUNO');
  const [sort, setSort] = useState<'Nome' | 'Cadastro'>('Nome');
  const [editor, setEditor] = useState<EditorConfig | null>(null);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const fetchUsers = useCallback(async () => {
    try {
      const [people, options] = await Promise.all([
        request<UserSummary[]>('/usuarios'),
        role === 'ADMIN' ? api.listInstituicoes() : Promise.resolve([]),
      ]);
      setUsers(people); setInstituicoes(options);
    } catch (cause: unknown) {
      setError(cause instanceof ApiError ? cause.message : 'Não foi possível carregar usuários.');
    } finally {
      setLoading(false);
    }
  }, [request, role]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    await fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (state.status !== 'signedIn' || state.mode !== 'api' || state.user.perfil === 'ALUNO') return;
    let active = true;
    void Promise.all([request<UserSummary[]>('/usuarios'), state.user.perfil === 'ADMIN' ? api.listInstituicoes() : Promise.resolve([])])
      .then(([result, options]) => { if (active) { setUsers(result); setInstituicoes(options); } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof ApiError ? cause.message : 'Não foi possível carregar usuários.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [request, state]);

  const visibleUsers = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('pt-BR');
    return users.filter((user) =>
      (selectedInstitution === 'all' || user.instituicaoId === selectedInstitution) &&
      (selectedRole === 'ALL' || user.perfil === selectedRole) &&
      (!search || `${user.nome} ${user.email} ${user.instituicao?.nome ?? ''}`.toLocaleLowerCase('pt-BR').includes(search)),
    ).sort((a, b) => sort === 'Nome' ? a.nome.localeCompare(b.nome, 'pt-BR') : b.criadoEm.localeCompare(a.criadoEm));
  }, [query, users, selectedInstitution, selectedRole, sort]);

  if (state.status === 'loading') return null;
  if (state.status !== 'signedIn') return <Redirect href="/login" />;
  if (state.mode !== 'api' || state.user.perfil === 'ALUNO') return <Redirect href="/home" />;

  function openCreate() {
    setEditor({ title: 'Cadastrar pessoa', fields: [
      { key: 'instituicaoId', label: 'Fatec', options: instituicoes.map((item) => ({ id: item.id, label: item.nome })) },
      { key: 'nome', label: 'Nome' },
      { key: 'email', label: 'E-mail' },
      { key: 'senha', label: 'Senha inicial (mínimo 12 caracteres)', type: 'password' },
      { key: 'perfil', label: 'Perfil', options: (['ALUNO', 'PROFESSOR', 'TUTOR', 'COORDENACAO', 'ADMIN'] as Perfil[]).map((perfil) => ({ id: perfil, label: roleLabel[perfil] })) },
    ], submit: async (values) => {
      await request('/usuarios', { method: 'POST', body: values });
      setEditor(null); setNotice('Pessoa cadastrada. Vincule matrícula, disciplina ou tutoria na área acadêmica.');
      await load();
    } });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <FlatList
        data={!loading && !error && !editor ? visibleUsers : []}
        keyExtractor={(user) => user.id}
        renderItem={({ item }) => <UserCard user={item} onPress={() => router.push({ pathname: '/person/[id]', params: { id: item.id } })} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.list, { paddingBottom: 24 + bottom }]}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <TopBar />
            <SectionTitle title="Estudantes" />
            <DataNotice>Cadastros da API, conforme os vínculos e permissões da sua conta. Não há classificação de risco disponível.</DataNotice>
            <TextInput accessibilityLabel="Pesquisar estudantes e profissionais" autoCapitalize="none" placeholder="Buscar nome, e-mail ou Fatec" placeholderTextColor={palette.muted} value={query} onChangeText={setQuery} style={styles.search} />
            {role === 'ADMIN' && <><Text style={styles.label}>Fatec</Text><View style={styles.chips}><Chip label="Todas" selected={selectedInstitution === 'all'} onPress={() => setSelectedInstitution('all')} />{instituicoes.map((item) => <Chip key={item.id} label={item.nome} selected={selectedInstitution === item.id} onPress={() => setSelectedInstitution(item.id)} />)}</View></>}
            <Text style={styles.label}>Perfil</Text><View style={styles.chips}><Chip label="Todos" selected={selectedRole === 'ALL'} onPress={() => setSelectedRole('ALL')} />{(['ALUNO', 'PROFESSOR', 'TUTOR', 'COORDENACAO', 'ADMIN'] as Perfil[]).filter((perfil) => role === 'ADMIN' || perfil === 'ALUNO').map((perfil) => <Chip key={perfil} label={roleLabel[perfil]} selected={selectedRole === perfil} onPress={() => setSelectedRole(perfil)} />)}</View>
            <Text style={styles.label}>Ordenar</Text><View style={styles.chips}><Chip label="Nome" selected={sort === 'Nome'} onPress={() => setSort('Nome')} /><Chip label="Cadastro recente" selected={sort === 'Cadastro'} onPress={() => setSort('Cadastro')} /></View>
            <Text style={styles.countText}>{visibleUsers.length} pessoa(s) no recorte</Text>
            {role === 'ADMIN' && !editor && <TextButton title="Cadastrar pessoa" onPress={openCreate} />}
            {editor && <Editor config={editor} close={() => setEditor(null)} />}
            {!!notice && <Text style={styles.notice}>{notice}</Text>}
            {loading ? <ActivityIndicator size="large" color={palette.primary} /> : null}
            {error ? <View style={styles.errorCard}><Text accessibilityRole="alert" style={styles.errorText}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void load()}><Text style={styles.retry}>Tentar novamente</Text></Pressable></View> : null}
          </View>
        }
        ListEmptyComponent={!loading && !error && !editor ? <View style={styles.empty}><Text style={styles.emptyTitle}>Nenhuma pessoa encontrada</Text><Text style={styles.emptyText}>Verifique os filtros ou os vínculos acadêmicos.</Text></View> : undefined}
        ListFooterComponent={!loading && !error && !editor ? <TextButton title="Atualizar lista" onPress={() => void load()} /> : undefined}
      />
    </SafeAreaView>
  );
}

function UserCard({ user, onPress }: { user: UserSummary; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Abrir detalhes de ${user.nome}`} onPress={onPress} style={styles.userCard}>
      <View style={styles.initial}><Text style={styles.initialText}>{user.nome.trim().charAt(0).toUpperCase()}</Text></View>
      <View style={styles.userText}>
        <Text style={styles.userName}>{user.nome}</Text>
        <Text style={styles.userEmail}>{user.email}</Text>
        <Text style={styles.userEmail}>{user.instituicao?.nome ?? 'Fatec não informada'}</Text>
        <View style={styles.badges}><Text style={styles.roleBadge}>{roleLabel[user.perfil]}</Text><Text style={[styles.stateBadge, !user.ativo && styles.inactive]}>{user.ativo ? 'Ativo' : 'Inativo'}</Text></View>
      </View>
    </Pressable>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, selected && styles.chipActive]}><Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  list: { alignSelf: 'center', width: '100%', maxWidth: 900, paddingHorizontal: 16, paddingVertical: 16, gap: 9 },
  headerContent: { gap: 13, marginBottom: 5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 12, minHeight: 38, justifyContent: 'center', borderRadius: 99 },
  chipActive: { backgroundColor: palette.primary, borderColor: palette.primary },
  chipText: { color: palette.ink, fontSize: 12 }, chipTextActive: { color: palette.surface },
  notice: { color: palette.success, fontSize: 13 },
  label: { color: palette.ink, fontSize: 13, fontWeight: '700' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  count: { backgroundColor: palette.primarySoft, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 8 },
  countText: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  description: { color: palette.muted, fontSize: 14, lineHeight: 20 },
  search: { height: 50, borderWidth: 1, borderColor: palette.line, borderRadius: 12, backgroundColor: palette.surface, color: palette.ink, paddingHorizontal: 14, fontSize: 14 },
  errorCard: { backgroundColor: palette.dangerSoft, borderRadius: 16, padding: 16, gap: 8 },
  errorText: { color: palette.danger, fontSize: 14 },
  retry: { color: palette.primary, fontWeight: '700', fontSize: 14 },
  empty: { alignItems: 'center', padding: 26, gap: 5 },
  emptyTitle: { color: palette.ink, fontSize: 16, fontWeight: '700' },
  emptyText: { color: palette.muted, fontSize: 13 },
  userCard: { flexDirection: 'row', gap: 10, backgroundColor: palette.surface, borderColor: palette.line, borderWidth: 1, borderRadius: 11, padding: 13, marginBottom: 9 },
  initial: { width: 36, height: 36, borderRadius: 8, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  initialText: { color: palette.primary, fontSize: 15, fontWeight: '700' },
  userText: { flex: 1, gap: 3 },
  userName: { color: palette.ink, fontSize: 14, fontWeight: '700' },
  userEmail: { color: palette.muted, fontSize: 12 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 7 },
  roleBadge: { color: palette.primary, backgroundColor: palette.primarySoft, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 5, overflow: 'hidden', fontSize: 11, fontWeight: '700' },
  stateBadge: { color: palette.primary, backgroundColor: '#E8F6EE', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 5, overflow: 'hidden', fontSize: 11, fontWeight: '700' },
  inactive: { color: palette.danger, backgroundColor: palette.dangerSoft },
});
