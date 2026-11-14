import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Screen } from '@/components/primitives';
import { ActionButton, AcademicHeader, EmptyState, ListRow, Panel, PanelHeader, RowList, SegmentTabs, TypeIcon, academicStyles } from '@/demo/academic-ui';
import { Text } from 'react-native';
import { eventIcons, eventLabels, eventRoute, useActivity, type EventItem } from './activity';
import { groupByDay, relativeDay } from './collaboration';
import { RequestState } from './ui';
import { useNow } from './use-now';

type Filter = 'all' | 'unread';

/** Eventos agrupados por dia (Hoje, Ontem, Esta semana…). Usado na Atividade e nas publicações de cada turma. */
export function EventGroups({ items, highlighted }: { items: EventItem[]; highlighted?: Set<string> | null }) {
  const router = useRouter();
  const now = useNow();
  const groups = useMemo(() => groupByDay(items, now), [items, now]);
  return <>{groups.map((group) => <Panel key={group.key}>
    <PanelHeader title={group.label} />
    <RowList>{group.items.map((item) => <ListRow
      key={item.id}
      unread={highlighted?.has(item.id)}
      leading={<TypeIcon name={eventIcons[item.tipo] ?? 'list'} />}
      title={item.titulo}
      meta={`${eventLabels[item.tipo] ?? item.tipo} · ${item.disciplina} · ${relativeDay(item.data, now)}`}
      onPress={() => router.push(eventRoute(item.tipo))} />)}</RowList>
  </Panel>)}</>;
}

/**
 * Atividade: tudo que mudou nas suas turmas, do mais novo ao mais antigo, agrupado por dia. Ao abrir,
 * o que era novo fica destacado e o contador da aba zera. Sai de cena só o contador, não o destaque.
 */
export function ConnectedActivity() {
  const feed = useActivity();
  const { loading, error, unread, markSeen, refresh, ready } = feed;
  const [filter, setFilter] = useState<Filter>('all');
  // Os ids que eram novos ao abrir. Ficam em estado, não em ref, para a lista re-renderizar com eles.
  const [highlighted, setHighlighted] = useState<Set<string> | null>(null);
  const capturing = useRef(true);

  // Ao sair da tela o destaque some; na próxima visita, só o que chegou depois fica marcado.
  useFocusEffect(useCallback(() => { capturing.current = true; refresh(); return () => setHighlighted(null); }, [refresh]));
  useEffect(() => {
    if (!capturing.current || loading || error || !ready) return;
    capturing.current = false;
    // Acumula em vez de substituir: uma segunda captura (já marcado como visto) não pode apagar o destaque.
    setHighlighted((current) => new Set([...(current ?? []), ...unread.map((item) => item.id)]));
    markSeen();
  }, [loading, error, ready, unread, markSeen]);

  const visible = useMemo(() => filter === 'unread' ? feed.items.filter((item) => highlighted?.has(item.id)) : feed.items, [feed.items, filter, highlighted]);
  const newCount = highlighted?.size ?? 0;

  return <Screen>
    <AcademicHeader back fallbackHref="/connected" title="Atividade" subtitle={newCount ? `${newCount} ${newCount === 1 ? 'novidade' : 'novidades'} desde a sua última visita` : 'Tudo que mudou nas suas turmas'} />
    {!loading && !error && feed.items.length ? <SegmentTabs label="Filtro da atividade" selected={filter} onSelect={setFilter} items={[{ key: 'all', label: 'Tudo' }, { key: 'unread', label: 'Não lidas', count: newCount }]} /> : null}
    <RequestState loading={loading} error={error} onRetry={refresh} />
    {!loading && !error && !visible.length
      ? <EmptyState title={filter === 'unread' ? 'Nada novo' : 'Nada por aqui ainda'} detail={filter === 'unread' ? 'Você já viu tudo desde a última visita.' : 'Quando houver tarefas, notas, materiais ou aulas nas suas turmas, elas aparecem aqui.'} />
      : null}
    {!loading && !error ? <EventGroups items={visible} highlighted={highlighted} /> : null}
    {!loading && !error && feed.hasMore ? <ActionButton secondary title={feed.loadingMore ? 'Carregando…' : 'Carregar mais'} disabled={feed.loadingMore} onPress={() => void feed.loadMore()} /> : null}
    {feed.limitReached ? <Text style={academicStyles.meta}>Limite de consulta atingido: itens mais antigos não aparecem.</Text> : null}
  </Screen>;
}
