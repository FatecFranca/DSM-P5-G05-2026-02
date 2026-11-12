import { useFocusEffect } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { useSession } from '@/auth/session';
import type { PickedDocument } from '@/demo/document';

// Formato das respostas de /mensagens (ver docs/messages-api.md no backend).
export interface Pessoa { id: string; nome: string; perfil: string }
export interface Arquivo { id: string; nome: string; mime: string; tamanho: number }
export interface ApiMensagem { id: string; conversaId: string; autorId: string; autor: string; texto: string; arquivo: Arquivo | null; criadaEm: string; curtidas: number; curtidaPorMim: boolean }
export interface ApiConversa {
  id: string; tipo: 'DIRETA' | 'GRUPO'; titulo: string | null; criadaEm: string; participantes: Pessoa[]; naoLidas: number;
  ultimaMensagem: { id: string; autorId: string; autor: string; texto: string; arquivo: string | null; criadaEm: string } | null;
}
export interface ApiCanal { id: string; turmaId: string; turma: string; curso: string; disciplinaId: string | null; nome: string; ultima: { autor: string; texto: string; criadaEm: string } | null; naoLidas: number; podePublicar: boolean }
export interface ApiPublicacao { id: string; canal: string; turmaId: string; disciplinaId: string | null; autorId: string; autor: string; perfilAutor: string; texto: string; importante: boolean; arquivo: Arquivo | null; criadaEm: string; curtidas: number; curtidaPorMim: boolean; respostas: number }
export interface ApiResposta { id: string; publicacaoId: string; autorId: string; autor: string; perfilAutor: string; texto: string; arquivo: Arquivo | null; criadaEm: string; curtidas: number; curtidaPorMim: boolean }
export interface Pagina<T> { itens: T[]; temMais: boolean }
export interface ApiContato { id: string; nome: string; perfil: string; turmas: string[] }

/** Perfis que usam o módulo: estudante e docente conversam; tutoria só lê os canais. */
const messagingRoles = ['ALUNO', 'PROFESSOR', 'TUTOR'];
export const canUseMessages = (perfil: string) => messagingRoles.includes(perfil);
export const canChatWith = (perfil: string) => perfil === 'ALUNO' || perfil === 'PROFESSOR';

/**
 * Verdadeiro enquanto a tela está em foco. As abas ficam montadas; sem isso, cada uma continuaria
 * consultando a API em segundo plano sem ninguém olhando. Só para telas dentro de um navegador.
 */
export function useScreenFocused() {
  const [focused, setFocused] = useState(true);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  return focused;
}

/** Carrega agora e, se houver intervalo, repete enquanto `enabled`. `refresh` força uma nova leitura. */
export function usePolled<T>(load: () => Promise<T>, intervalMs: number | null, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(enabled);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const run = async () => {
      try {
        const value = await load();
        if (active) { setData(value); setError(''); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar.');
      } finally { if (active) setLoading(false); }
    };
    void Promise.resolve().then(run);
    const timer = intervalMs ? setInterval(() => void run(), intervalMs) : null;
    return () => { active = false; if (timer) clearInterval(timer); };
  }, [load, intervalMs, enabled, revision]);

  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  return { data, setData, error, loading, refresh };
}

/** Junta páginas sem repetir itens, em ordem cronológica. */
export function mergeById<T extends { id: string; criadaEm: string }>(...lists: T[][]): T[] {
  const byId = new Map<string, T>();
  for (const list of lists) for (const item of list) byId.set(item.id, item);
  return [...byId.values()].sort((a, b) => Date.parse(a.criadaEm) - Date.parse(b.criadaEm) || (a.id < b.id ? -1 : 1));
}

// ----------------------------------------------------------------------------- selo de não lidas

interface SummaryValue { unread: number; refresh: () => void }
const SummaryContext = createContext<SummaryValue>({ unread: 0, refresh: () => undefined });

/** Total de não lidas (canais + conversas) para o selo da aba. Consulta a cada 30 s, bem abaixo do limite da API. */
export function MessagesApiProvider({ children }: { children: ReactNode }) {
  const { state, request } = useSession();
  const eligible = state.status === 'signedIn' && state.mode === 'api' && !state.user.trocaSenhaObrigatoria && canUseMessages(state.user.perfil);
  const load = useCallback(() => request<{ naoLidas: number }>('/mensagens/resumo'), [request]);
  const { data, refresh } = usePolled(load, 30_000, eligible);
  const value = useMemo(() => ({ unread: eligible ? data?.naoLidas ?? 0 : 0, refresh }), [eligible, data, refresh]);
  return <SummaryContext.Provider value={value}>{children}</SummaryContext.Provider>;
}

export const useMessagesSummary = () => useContext(SummaryContext);

// ------------------------------------------------------------------------------------- anexos

/** Envia o documento escolhido para /arquivos e devolve o registro (o `id` vai na mensagem). */
export function useUploadDocument() {
  const { request } = useSession();
  return useCallback(async (document: PickedDocument): Promise<Arquivo> => {
    const form = new FormData();
    if (Platform.OS === 'web' && document.file) form.append('arquivo', document.file, document.name);
    else form.append('arquivo', { uri: document.uri, name: document.name, type: document.mimeType ?? 'application/octet-stream' } as unknown as Blob);
    return request<Arquivo>('/arquivos', { method: 'POST', body: form });
  }, [request]);
}
