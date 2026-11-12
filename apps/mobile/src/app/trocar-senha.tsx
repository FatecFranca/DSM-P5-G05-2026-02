import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useSession } from '@/auth/session';
import { PrimaryButton, Screen, TextButton } from '@/components/primitives';
import { palette } from '@/constants/design';

export default function ChangePasswordScreen() {
  const { changePassword, signOut } = useSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (next.length < 12) return setError('A nova senha precisa ter pelo menos 12 caracteres.');
    if (next !== confirmation) return setError('A confirmação não corresponde à nova senha.');
    setBusy(true);
    setError('');
    try {
      await changePassword(current, next);
      setCurrent(''); setNext(''); setConfirmation('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível trocar a senha.');
    } finally {
      setBusy(false);
    }
  }

  return <Screen><View style={styles.card}>
    <Text style={styles.title}>Troque sua senha temporária</Text>
    <Text style={styles.description}>Para acessar o sistema, defina uma senha pessoal com pelo menos 12 caracteres.</Text>
    <TextInput accessibilityLabel="Senha temporária" placeholder="Senha temporária" secureTextEntry autoComplete="current-password" value={current} onChangeText={setCurrent} style={styles.input} />
    <TextInput accessibilityLabel="Nova senha" placeholder="Nova senha" secureTextEntry autoComplete="new-password" value={next} onChangeText={setNext} style={styles.input} />
    <TextInput accessibilityLabel="Confirmar nova senha" placeholder="Confirmar nova senha" secureTextEntry autoComplete="new-password" value={confirmation} onChangeText={setConfirmation} style={styles.input} />
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    <PrimaryButton title="Salvar nova senha" disabled={busy || !current || !next || !confirmation} loading={busy} onPress={() => void submit()} />
    <TextButton title="Sair" onPress={() => void signOut()} />
  </View></Screen>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.surface, borderRadius: 14, borderWidth: 1, borderColor: palette.line, padding: 24, gap: 14, maxWidth: 480, alignSelf: 'center', width: '100%' },
  title: { fontSize: 24, fontWeight: '800', color: palette.ink },
  description: { color: palette.muted, fontSize: 14, lineHeight: 21 },
  input: { minHeight: 52, borderWidth: 1, borderColor: palette.line, borderRadius: 9, paddingHorizontal: 14, color: palette.ink },
  error: { color: palette.danger, fontSize: 13 },
});
