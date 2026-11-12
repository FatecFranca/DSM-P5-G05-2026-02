import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/auth/session';
import { TextButton } from '@/components/primitives';
import { palette, roleLabel, space, type } from '@/constants/design';
import { ActionButton, Avatar, Badge, BodyText, Feedback, Panel, PanelTitle, academicStyles } from '@/demo/academic-ui';
import { Editor, type EditorConfig } from '@/features/academic/editor';
import type { UserSummary } from '@/services/api';
import type { Credential } from './credentials';
import { CredentialsList } from './people-import';

type Pending = 'toggle' | 'reset' | null;
const messageOf = (cause: unknown, fallback: string) => (cause instanceof Error ? cause.message : fallback);

/** Quem é a pessoa, antes de qualquer ação: nome em destaque, e-mail, perfil e, se for o caso, a conta desativada. */
export function PersonHeader({ person }: { person: Pick<UserSummary, 'nome' | 'email' | 'perfil' | 'ativo'> }) {
  return <View style={styles.header}>
    <Avatar name={person.nome} size={56} />
    <View style={styles.headerText}>
      <Text accessibilityRole="header" style={styles.name}>{person.nome}</Text>
      <Text selectable style={styles.email}>{person.email}</Text>
      <View style={styles.badges}>
        <Badge text={roleLabel[person.perfil] ?? person.perfil} tone="neutral" />
        {!person.ativo && <Badge text="Conta desativada" tone="danger" />}
      </View>
    </View>
  </View>;
}

/**
 * Gerenciar a conta de uma pessoa: editar, redefinir senha e desativar/reativar. A ação que tira acesso
 * pede confirmação dizendo o que acontece; desativar fica separada e em vermelho, nunca com o peso da
 * ação principal. Desativar e redefinir derrubam o acesso na hora.
 */
export function AccountAdmin({ person, onChanged }: { person: Pick<UserSummary, 'id' | 'nome' | 'email' | 'ativo'>; onChanged: (changes: Partial<UserSummary>) => void }) {
  const { state, request } = useSession();
  const [editor, setEditor] = useState<EditorConfig | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [credential, setCredential] = useState<Credential | null>(null);
  // Conta própria: a senha se troca em "Minha conta", e desativar a si mesmo não é permitido.
  if (state.status === 'signedIn' && state.user.id === person.id) return null;

  const clear = () => { setNotice(''); setError(''); setCredential(null); };
  const ask = (next: Pending) => { clear(); setPending(next); };

  function edit() {
    clear(); setPending(null);
    setEditor({ title: 'Editar dados', fields: [
      { key: 'nome', label: 'Nome', initial: person.nome },
      { key: 'email', label: 'E-mail', initial: person.email },
    ], submit: async (values) => {
      onChanged(await request<UserSummary>(`/usuarios/${person.id}`, { method: 'PATCH', body: { nome: values.nome.trim(), email: values.email.trim() } }));
      setNotice('Dados atualizados.');
    } });
  }

  async function toggle() {
    setBusy(true); clear();
    try {
      onChanged(await request<UserSummary>(`/usuarios/${person.id}`, { method: 'PATCH', body: { ativo: !person.ativo } }));
      setNotice(person.ativo ? 'Conta desativada. A pessoa perdeu o acesso agora.' : 'Conta reativada. A pessoa volta a entrar com a senha que já tinha.');
      setPending(null);
    } catch (cause) { setError(messageOf(cause, 'Não foi possível alterar a conta.')); }
    finally { setBusy(false); }
  }

  async function reset() {
    setBusy(true); clear();
    try {
      const result = await request<{ nome: string; email: string; senhaTemporaria: string }>(`/usuarios/${person.id}/redefinir-senha`, { method: 'POST' });
      setCredential({ linha: 0, nome: result.nome, email: result.email, registro: null, senhaTemporaria: result.senhaTemporaria });
      setNotice('Senha redefinida. A pessoa foi desconectada e troca a senha no próximo acesso.');
      setPending(null);
    } catch (cause) { setError(messageOf(cause, 'Não foi possível redefinir a senha.')); }
    finally { setBusy(false); }
  }

  if (editor) return <Editor config={editor} close={() => setEditor(null)} />;
  return <View style={academicStyles.stack}>
    <Panel>
      <PanelTitle>Gerenciar conta</PanelTitle>
      {!person.ativo && !pending && <BodyText>Esta pessoa não consegue entrar. Os registros dela (notas, mensagens, entregas) foram mantidos.</BodyText>}

      {pending === 'toggle' && <View style={academicStyles.stack}>
        <BodyText>{person.ativo ? 'A pessoa perde o acesso agora e é desconectada de todos os aparelhos. Nada é apagado e você pode reativar depois.' : 'A pessoa volta a poder entrar com a senha que já tinha.'}</BodyText>
        <View style={styles.actions}>
          <ActionButton compact danger={person.ativo} title={busy ? 'Aguarde…' : person.ativo ? 'Desativar conta' : 'Reativar conta'} disabled={busy} onPress={() => void toggle()} />
          <TextButton flush title="Cancelar" onPress={() => setPending(null)} />
        </View>
      </View>}

      {pending === 'reset' && <View style={academicStyles.stack}>
        <BodyText>Gera uma senha temporária nova e desconecta a pessoa agora. Ela precisa trocá-la no próximo acesso.</BodyText>
        <View style={styles.actions}>
          <ActionButton compact title={busy ? 'Aguarde…' : 'Gerar senha temporária'} disabled={busy} onPress={() => void reset()} />
          <TextButton flush title="Cancelar" onPress={() => setPending(null)} />
        </View>
      </View>}

      {!pending && <View style={styles.actions}>
        {person.ativo
          ? <>
            <ActionButton compact secondary title="Editar dados" onPress={edit} />
            <ActionButton compact secondary title="Redefinir senha" onPress={() => ask('reset')} />
            <ActionButton compact secondary danger title="Desativar conta" onPress={() => ask('toggle')} />
          </>
          : <>
            <ActionButton compact title="Reativar conta" onPress={() => ask('toggle')} />
            <ActionButton compact secondary title="Editar dados" onPress={edit} />
          </>}
      </View>}

      {!!notice && <Feedback message={notice} />}
      {!!error && <Feedback error message={error} />}
    </Panel>
    {credential && <CredentialsList items={[credential]} fileName="senha-temporaria.csv" />}
  </View>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  headerText: { flex: 1, gap: 2 },
  name: { color: palette.ink, ...type.title, fontSize: 22, lineHeight: 28 },
  email: { color: palette.muted, ...type.body },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: space.md, rowGap: space.xs },
});
