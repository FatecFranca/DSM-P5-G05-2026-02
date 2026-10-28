import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useSession } from '@/auth/session';
import { confirmAction, notify } from '@/components/dialogs';
import { PrimaryButton, Screen, SectionTitle } from '@/components/primitives';
import { TopBar, useGoBack } from '@/components/top-bar';
import { palette, roleLabel } from '@/constants/design';

export default function ProfileScreen() {
  const router = useRouter();
  const goBack = useGoBack('/home');
  const { state, signOut } = useSession();
  const [busy, setBusy] = useState(false);

  if (state.status === 'loading') return null;
  if (state.status !== 'signedIn') return <Redirect href="/login" />;
  const { user } = state;

  async function logout() {
    const confirmed = await confirmAction('Sair da conta?', 'Você precisará entrar novamente para acessar o SGEI neste dispositivo.', 'Sair');
    if (!confirmed) return;
    setBusy(true);
    // Ao limpar a sessão, o layout raiz remove as telas autenticadas do histórico e abre o login.
    const revoked = await signOut();
    if (!revoked) {
      notify('Sessão encerrada neste dispositivo', 'Não foi possível confirmar a revogação na API. Verifique sua conexão.');
    }
  }

  return (
    <Screen>
      <TopBar onBack={goBack} showAccount={false} />
      <SectionTitle eyebrow="CONTA" title="Meu perfil" />
      <View style={styles.hero}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{user.perfil.charAt(0)}</Text></View>
        <View style={styles.heroText}>
          <Text style={styles.role}>{roleLabel[user.perfil]}</Text>
          <Text style={styles.roleCaption}>{state.mode === 'demo' ? 'Demonstração local' : 'Perfil ativo nesta instituição'}</Text>
        </View>
      </View>
      <View style={styles.card}>
        <Field label="ID do usuário" value={user.id} />
        <View style={styles.divider} />
        <Field label="ID da instituição" value={user.instituicaoId} />
        <View style={styles.divider} />
        <Field label="Perfil de acesso" value={roleLabel[user.perfil]} />
      </View>
      {user.perfil === 'ADMIN' && state.mode === 'api' ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Pessoas das Fatecs" onPress={() => router.push('/connected/people')} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
          <View style={styles.linkText}><Text style={styles.linkTitle}>Pessoas das Fatecs</Text><Text style={styles.linkCaption}>Consultar contas cadastradas</Text></View>
          <Text style={styles.linkArrow}>→</Text>
        </Pressable>
      ) : null}
      <Text style={styles.note}>{state.mode === 'demo' ? 'Perfil fictício local para demonstração. Nenhum dado desta conta foi consultado na API.' : 'Sua sessão e suas permissões são verificadas pelo servidor. A área acadêmica exibe os dados disponíveis para seus vínculos.'}</Text>
      <PrimaryButton title={busy ? 'Encerrando sessão...' : 'Sair da conta'} onPress={() => void logout()} loading={busy} danger />
    </Screen>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><Text selectable style={styles.fieldValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  hero: { backgroundColor: palette.primary, borderRadius: 22, padding: 22, flexDirection: 'row', alignItems: 'center', gap: 15 },
  heroText: { flex: 1 },
  avatar: { width: 57, height: 57, borderRadius: 19, backgroundColor: palette.gold, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: palette.ink, fontSize: 26, fontWeight: '800' },
  role: { color: palette.surface, fontSize: 20, fontWeight: '800' },
  roleCaption: { color: '#D1EAE7', fontSize: 12, marginTop: 3 },
  card: { backgroundColor: palette.surface, borderRadius: 20, borderWidth: 1, borderColor: palette.line, padding: 21, gap: 16 },
  field: { gap: 5 },
  fieldLabel: { color: palette.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  fieldValue: { color: palette.ink, fontSize: 14, fontWeight: '600' },
  divider: { height: 1, backgroundColor: palette.line },
  link: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.surface, borderRadius: 16, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 18, paddingVertical: 12 },
  linkText: { flex: 1, gap: 3 },
  linkTitle: { color: palette.ink, fontSize: 15, fontWeight: '700' },
  linkCaption: { color: palette.muted, fontSize: 12 },
  linkArrow: { color: palette.secondary, fontSize: 20 },
  pressed: { opacity: 0.7 },
  note: { color: palette.muted, fontSize: 13, lineHeight: 20 },
});
