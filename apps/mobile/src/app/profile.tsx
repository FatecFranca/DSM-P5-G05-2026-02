import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { useSession } from '@/auth/session';
import { BrandMark, PrimaryButton, Screen, SectionTitle, TextButton } from '@/components/primitives';
import { palette, roleLabel } from '@/constants/design';

export default function ProfileScreen() {
  const router = useRouter();
  const { state, signOut } = useSession();
  const [busy, setBusy] = useState(false);

  if (state.status === 'loading') return null;
  if (state.status !== 'signedIn') return <Redirect href="/login" />;
  const { user } = state;

  async function logout() {
    setBusy(true);
    const revoked = await signOut();
    setBusy(false);
    if (!revoked) {
      Alert.alert('Sessão encerrada neste dispositivo', 'Não foi possível confirmar a revogação na API. Verifique sua conexão.');
    }
  }

  return (
    <Screen>
      <View style={styles.header}><BrandMark compact /><TextButton title="← Voltar" onPress={() => router.replace('/home')} /></View>
      <SectionTitle eyebrow="CONTA" title="Meu perfil" />
      <View style={styles.hero}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{user.perfil.charAt(0)}</Text></View>
        <View><Text style={styles.role}>{roleLabel[user.perfil]}</Text><Text style={styles.roleCaption}>Perfil ativo nesta instituição</Text></View>
      </View>
      <View style={styles.card}>
        <Field label="ID do usuário" value={user.id} />
        <View style={styles.divider} />
        <Field label="ID da instituição" value={user.instituicaoId} />
        <View style={styles.divider} />
        <Field label="Perfil de acesso" value={roleLabel[user.perfil]} />
      </View>
      <Text style={styles.note}>{state.mode === 'demo' ? 'Perfil fictício local para demonstração. Nenhum dado desta conta foi consultado na API.' : 'Sua sessão e suas permissões são verificadas pelo servidor. A área acadêmica exibe os dados disponíveis para seus vínculos.'}</Text>
      <PrimaryButton title={busy ? 'Encerrando sessão...' : 'Sair da conta'} onPress={() => void logout()} loading={busy} />
    </Screen>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><Text selectable style={styles.fieldValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hero: { backgroundColor: palette.primary, borderRadius: 22, padding: 22, flexDirection: 'row', alignItems: 'center', gap: 15 },
  avatar: { width: 57, height: 57, borderRadius: 19, backgroundColor: palette.gold, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: palette.ink, fontSize: 26, fontWeight: '800' },
  role: { color: palette.surface, fontSize: 20, fontWeight: '800' },
  roleCaption: { color: '#D1EAE7', fontSize: 12, marginTop: 3 },
  card: { backgroundColor: palette.surface, borderRadius: 20, borderWidth: 1, borderColor: palette.line, padding: 21, gap: 16 },
  field: { gap: 5 },
  fieldLabel: { color: palette.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  fieldValue: { color: palette.ink, fontSize: 14, fontWeight: '600' },
  divider: { height: 1, backgroundColor: palette.line },
  note: { color: palette.muted, fontSize: 13, lineHeight: 20 },
});
