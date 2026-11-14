import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSession } from '@/auth/session';
import type { IconName } from '@/components/icons';
import { unreadItems } from './collaboration';
import { useNow } from './use-now';

export interface EventItem { id: string; recursoId: string; tipo: string; titulo: string; data: string; turmaId: string; disciplinaId: string; disciplina: string }
interface FeedPage { itens: EventItem[]; pagina: number; temMais: boolean; limiteAtingido: boolean }

export const eventLabels: Record<string, string> = {
  AULA: 'Aula', AVALIACAO: 'Avaliação', ENTREGA: 'Prazo de entrega', MATERIAL: 'Material disponível',
  ATIVIDADE: 'Atividade publicada', NOTAS: 'Notas publicadas', CORRECAO: 'Correção disponível',
};

export const eventIcons: Record<string, IconName> = {
  AULA: 'calendar', AVALIACAO: 'doc', ENTREGA: 'list', MATERIAL: 'folder', ATIVIDADE: 'list', NOTAS: 'doc', CORRECAO: 'check',
};

/** Destino de cada tipo de evento. Os destinos existem para todos os perfis com a aba Atividade. */
export function eventRoute(tipo: string) {
  if (tipo === 'MATERIAL') return '/connected/materials' as const;
  if (tipo === 'AULA') return '/connected/attendance' as const;
  if (tipo === 'NOTAS' || tipo === 'AVALIACAO') return '/connected/grades' as const;
  return '/connected/assignments' as const;
}

/**
 * Feed de avisos da API (eventos derivados dos registros acadêmicos), paginado. Com `turmaId`, só
 * daquela turma. Não há estado de leitura no servidor: quem decide o que é novo é `ActivityProvider`.
 */
export function useAvisos(turmaId?: string, enabled = true) {
  const { request } = useSession();
  const [items, setItems] = useState<EventItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  const query = useCallback((pagina: number) => {
    const params = new URLSearchParams({ pagina: String(pagina), tamanho: '20' });
    if (turmaId) params.set('turmaId', turmaId);
    return request<FeedPage>(`/academico/avisos?${params}`);
  }, [request, turmaId]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setLoading(true); setError('');
      try {
        const result = await query(1);
        if (!active) return;
        setItems(result.itens); setPage(1); setHasMore(result.temMais); setLimitReached(result.limiteAtingido);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar a atividade.');
      } finally { if (active) setLoading(false); }
    });
    return () => { active = false; };
  }, [enabled, query, revision]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const result = await query(page + 1);
      setItems((current) => [...current, ...result.itens.filter((item) => !current.some((known) => known.id === item.id))]);
      setPage(page + 1); setHasMore(result.temMais); setLimitReached(result.limiteAtingido);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar mais itens.');
    } finally { setLoadingMore(false); }
  }, [page, query]);

  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  return { items, loading, loadingMore, error, hasMore, limitReached, loadMore, refresh };
}

type ActivityValue = ReturnType<typeof useAvisos> & { unread: EventItem[]; markSeen: () => void; ready: boolean };
const ActivityContext = createContext<ActivityValue | null>(null);

/**
 * Mantém o feed da conta e a contagem de novidades. "Visto até" fica no servidor (por pessoa), então vale
 * em qualquer aparelho. Na primeira abertura nada conta como novo: o servidor passa a guardar "agora".
 */
export function ActivityProvider({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const { state, request } = useSession();
  const userId = state.status === 'signedIn' ? state.user.id : null;
  const feed = useAvisos(undefined, enabled && userId !== null);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!userId || !enabled) return;
    let active = true;
    void (async () => {
      let seen: string | null;
      try {
        seen = (await request<{ lidoAte: string | null }>('/academico/avisos/leitura')).lidoAte;
        if (!seen) seen = (await request<{ lidoAte: string }>('/academico/avisos/leitura', { method: 'PUT', body: {} })).lidoAte;
      } catch {
        // Sem o servidor não há como saber o que é novo; melhor não mostrar selo do que mostrar o errado.
        seen = new Date().toISOString();
      }
      if (!active) return;
      setLastSeen(seen);
      setReady(true);
    })();
    return () => { active = false; };
  }, [userId, enabled, request]);

  // Marca como visto até o aviso mais recente que a tela mostrou; um aviso publicado durante a leitura continua novo.
  const markSeen = useCallback(() => {
    if (!userId) return;
    const newest = feed.items.reduce<string | null>((latest, item) => !latest || Date.parse(item.data) > Date.parse(latest) ? item.data : latest, null);
    if (newest) setLastSeen((current) => !current || Date.parse(newest) > Date.parse(current) ? newest : current);
    void request('/academico/avisos/leitura', { method: 'PUT', body: newest ? { ate: newest } : {} }).catch(() => undefined);
  }, [userId, feed.items, request]);

  const now = useNow();
  const unread = useMemo(() => ready ? unreadItems(feed.items, lastSeen, now) : [], [feed.items, lastSeen, now, ready]);
  const value = useMemo(() => ({ ...feed, unread, markSeen, ready }), [feed, unread, markSeen, ready]);
  return <ActivityContext.Provider value={value}>{children}</ActivityContext.Provider>;
}

export function useActivity() {
  const value = useContext(ActivityContext);
  if (!value) throw new Error('useActivity deve ser usado dentro de ActivityProvider.');
  return value;
}
