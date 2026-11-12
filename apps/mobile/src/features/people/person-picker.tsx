import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/auth/session';
import { TextButton } from '@/components/primitives';
import { palette, space, type } from '@/constants/design';
import { Avatar, Feedback, FormField, ListRow, RowList, SkeletonRows } from '@/demo/academic-ui';
import type { Perfil, UserSummary } from '@/services/api';
import { pickCandidates } from './participants-model';

/** A listagem da API devolve até este tanto de contas de uma vez; acima disso a busca passa a ser no servidor. */
const LIST_LIMIT = 500;

/**
 * Escolher uma conta já cadastrada (docente, tutor ou estudante) para vincular. Mostra só quem está ativo e
 * ainda não vinculado, com busca por nome ou e-mail. Tocar na pessoa a escolhe: o que fazer com ela (vincular
 * na hora ou pedir mais um dado) é de quem usa o seletor.
 */
export function PersonPicker({ perfil, noun, exclude, busy = false, onPick, onCancel, emptyAction }: {
  perfil: Perfil;
  /** [singular, plural] em minúsculas, para as mensagens: ['docente', 'docentes']. */
  noun: [string, string];
  exclude: ReadonlySet<string>;
  busy?: boolean;
  onPick: (person: UserSummary) => void;
  onCancel: () => void;
  /** Saída quando não há ninguém a escolher (por exemplo, ir cadastrar a pessoa). */
  emptyAction?: ReactNode;
}) {
  const { request } = useSession();
  const [people, setPeople] = useState<UserSummary[] | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState<{ query: string; items: UserSummary[] } | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.resolve()
      .then(() => request<UserSummary[]>(`/usuarios?perfil=${perfil}`))
      .then((items) => { if (active) { setPeople(items); setError(''); } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar as pessoas.'); });
    return () => { active = false; };
  }, [perfil, request, attempt]);

  // Com a lista cortada pelo limite, o que não veio só aparece buscando no servidor.
  const truncated = (people?.length ?? 0) >= LIST_LIMIT;
  const needle = query.trim();
  useEffect(() => {
    if (!truncated || needle.length < 2) return;
    let active = true;
    const timer = setTimeout(() => {
      void request<UserSummary[]>(`/usuarios?perfil=${perfil}&busca=${encodeURIComponent(needle)}`)
        .then((items) => { if (active) setRemote({ query: needle, items }); })
        .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Busca indisponível.'); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [truncated, needle, perfil, request]);

  const source = truncated && remote?.query === needle ? remote.items : people ?? [];
  const candidates = pickCandidates(source, exclude, query);
  const loading = people === null && !error;
  const none = people !== null && source.length === 0 && !needle;

  return <View style={styles.box}>
    <FormField label={`Buscar ${noun[0]} por nome ou e-mail`} value={query} onChangeText={setQuery} />
    {loading ? <SkeletonRows count={3} /> : null}
    {error ? <View style={styles.stack}><Feedback error message={error} /><TextButton flush title="Tentar de novo" onPress={() => { setError(''); setPeople(null); setAttempt((value) => value + 1); }} /></View> : null}
    {people && candidates.items.length ? <RowList>{candidates.items.map((person) => <ListRow
      key={person.id}
      leading={<Avatar name={person.nome} size={36} />}
      title={person.nome}
      meta={person.email}
      onPress={() => { if (!busy) onPick(person); }} />)}</RowList> : null}
    {people && !candidates.items.length
      ? <View style={styles.stack}>
        <Text style={styles.empty}>
          {none ? `Nenhum ${noun[0]} cadastrado nesta Fatec.`
            : needle ? `Ninguém ativo com “${needle}”, ou a pessoa já está vinculada.`
              : `Todos os ${noun[1]} ativos já estão vinculados.`}
        </Text>
        {emptyAction ? <View style={styles.start}>{emptyAction}</View> : null}
      </View>
      : null}
    {candidates.total > candidates.items.length ? <Text style={styles.empty}>{`Mostrando ${candidates.items.length} de ${candidates.total}. Digite parte do nome para encontrar o resto.`}</Text> : null}
    {truncated && !needle ? <Text style={styles.empty}>Há muitas contas: busque pelo nome ou e-mail para achar quem não aparece aqui.</Text> : null}
    {busy ? <Text style={styles.empty} accessibilityLiveRegion="polite">Vinculando…</Text> : null}
    <View style={styles.start}><TextButton flush title="Cancelar" onPress={onCancel} /></View>
  </View>;
}

const styles = StyleSheet.create({
  box: { gap: space.sm, paddingVertical: space.sm },
  stack: { gap: space.xs },
  // O botão de texto estica na coluna e centraliza o rótulo; aqui ele fica à esquerda, alinhado ao resto.
  start: { alignSelf: 'flex-start' },
  empty: { color: palette.muted, ...type.caption },
});
