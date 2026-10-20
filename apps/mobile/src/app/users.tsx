import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/auth/session';
import { SectionTitle, TextButton } from '@/components/primitives';
import { palette, roleLabel } from '@/constants/design';
import { ApiError, type UserSummary } from '@/services/api';

export default function UsersScreen() {
  const router = useRouter();
  const { state, listUsers } = useSession();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const fetchUsers = useCallback(async () => {
    try {
      setUsers(await listUsers());
    } catch (cause: unknown) {
      setError(cause instanceof ApiError ? cause.message : 'Não foi possível carregar usuários.');
    } finally {
      setLoading(false);
    }
  }, [listUsers]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    await fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (state.status !== 'signedIn' || state.user.perfil !== 'ADMIN') return;
    let active = true;
    void listUsers()
      .then((result) => { if (active) setUsers(result); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof ApiError ? cause.message : 'Não foi possível carregar usuários.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [listUsers, state]);

  const visibleUsers = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('pt-BR');
    return search ? users.filter((user) => `${user.nome} ${user.email}`.toLocaleLowerCase('pt-BR').includes(search)) : users;
  }, [query, users]);

  if (state.status === 'loading') return null;
  if (state.status !== 'signedIn') return <Redirect href="/login" />;
  if (state.user.perfil !== 'ADMIN') return <Redirect href="/home" />;

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={!loading && !error ? visibleUsers : []}
        keyExtractor={(user) => user.id}
        renderItem={({ item }) => <UserCard user={item} />}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <View style={styles.header}><TextButton title="← Início" onPress={() => router.replace('/home')} /><View style={styles.count}><Text style={styles.countText}>{users.length} usuários</Text></View></View>
            <SectionTitle eyebrow="ADMINISTRAÇÃO" title="Pessoas da instituição" />
            <Text style={styles.description}>Consulte os usuários cadastrados. Esta lista vem da rota protegida /usuarios.</Text>
            <TextInput accessibilityLabel="Buscar por nome ou e-mail" autoCapitalize="none" placeholder="Buscar por nome ou e-mail" placeholderTextColor={palette.muted} value={query} onChangeText={setQuery} style={styles.search} />
            {loading ? <ActivityIndicator size="large" color={palette.primary} /> : null}
            {error ? <View style={styles.errorCard}><Text accessibilityRole="alert" style={styles.errorText}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void load()}><Text style={styles.retry}>Tentar novamente</Text></Pressable></View> : null}
          </View>
        }
        ListEmptyComponent={!loading && !error ? <View style={styles.empty}><Text style={styles.emptyTitle}>Nenhum usuário encontrado</Text><Text style={styles.emptyText}>Tente outra busca ou atualize a lista.</Text></View> : undefined}
        ListFooterComponent={!loading && !error ? <TextButton title="Atualizar lista" onPress={() => void load()} /> : undefined}
      />
    </SafeAreaView>
  );
}

function UserCard({ user }: { user: UserSummary }) {
  return (
    <View style={styles.userCard}>
      <View style={styles.initial}><Text style={styles.initialText}>{user.nome.trim().charAt(0).toUpperCase()}</Text></View>
      <View style={styles.userText}>
        <Text style={styles.userName}>{user.nome}</Text>
        <Text style={styles.userEmail}>{user.email}</Text>
        <View style={styles.badges}><Text style={styles.roleBadge}>{roleLabel[user.perfil]}</Text><Text style={[styles.stateBadge, !user.ativo && styles.inactive]}>{user.ativo ? 'Ativo' : 'Inativo'}</Text></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  list: { alignSelf: 'center', width: '100%', maxWidth: 720, paddingHorizontal: 24, paddingVertical: 24, gap: 12 },
  headerContent: { gap: 18, marginBottom: 5 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  count: { backgroundColor: palette.primarySoft, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 8 },
  countText: { color: palette.primary, fontSize: 12, fontWeight: '700' },
  description: { color: palette.muted, fontSize: 14, lineHeight: 20 },
  search: { height: 52, borderWidth: 1, borderColor: palette.line, borderRadius: 15, backgroundColor: palette.surface, color: palette.ink, paddingHorizontal: 16, fontSize: 14 },
  errorCard: { backgroundColor: palette.dangerSoft, borderRadius: 16, padding: 16, gap: 8 },
  errorText: { color: palette.danger, fontSize: 14 },
  retry: { color: palette.primary, fontWeight: '700', fontSize: 14 },
  empty: { alignItems: 'center', padding: 26, gap: 5 },
  emptyTitle: { color: palette.ink, fontSize: 16, fontWeight: '700' },
  emptyText: { color: palette.muted, fontSize: 13 },
  userCard: { flexDirection: 'row', gap: 13, backgroundColor: palette.surface, borderColor: palette.line, borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 12 },
  initial: { width: 44, height: 44, borderRadius: 14, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  initialText: { color: palette.primary, fontSize: 18, fontWeight: '800' },
  userText: { flex: 1, gap: 3 },
  userName: { color: palette.ink, fontSize: 15, fontWeight: '700' },
  userEmail: { color: palette.muted, fontSize: 12 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 7 },
  roleBadge: { color: palette.primary, backgroundColor: palette.primarySoft, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 5, overflow: 'hidden', fontSize: 11, fontWeight: '700' },
  stateBadge: { color: palette.primary, backgroundColor: '#E8F6EE', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 5, overflow: 'hidden', fontSize: 11, fontWeight: '700' },
  inactive: { color: palette.danger, backgroundColor: palette.dangerSoft },
});
