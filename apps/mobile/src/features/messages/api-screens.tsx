import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/auth/session';
import { Screen } from '@/components/primitives';
import { palette, space, type } from '@/constants/design';
import { AcademicHeader, ActionButton, Avatar, Badge, Chip, EmptyState, Feedback, FormField, Panel, PanelHeader, RowList, SegmentTabs } from '@/demo/academic-ui';
import type { PickedDocument } from '@/demo/document';
import { daySeparator, listTimeLabel } from '@/features/connected/collaboration';
import { RequestState } from '@/features/connected/ui';
import { useNow } from '@/features/connected/use-now';
import { Icon } from '@/components/icons';
import {
  canChatWith, mergeById, useMessagesSummary, usePolled, useScreenFocused, useUploadDocument,
  type ApiCanal, type ApiContato, type ApiConversa, type ApiMensagem, type ApiPublicacao, type ApiResposta, type Pagina,
} from './api-data';
import { Bubble, ChatLayout, ChatListRow, Composer, ReadOnlyBar, Separator, ToggleChip, clock, firstName } from './messages-ui';
import { PostBlock } from './post-block';

/** Aba Mensagens da versão com API: para onde "Voltar" cai quando não há histórico. */
const apiTab = '/connected/messages' as Href;

type LikeResult = { curtidas: number; curtidaPorMim: boolean };
type ChannelPage = Pagina<ApiPublicacao> & { canal: string; podePublicar: boolean; podeResponder: boolean };
type ThreadPage = { publicacao: ApiPublicacao; podeResponder: boolean; respostas: ApiResposta[] };

function useViewer() {
  const { state } = useSession();
  return state.status === 'signedIn' ? { id: state.user.id, perfil: state.user.perfil as string } : { id: '', perfil: '' };
}

const roleLabel = (perfil: string) => perfil === 'PROFESSOR' ? 'Docente' : 'Estudante';
const conversationTitle = (conversation: ApiConversa, meId: string) =>
  conversation.tipo === 'GRUPO' ? conversation.titulo ?? 'Grupo' : conversation.participantes.find((person) => person.id !== meId)?.nome ?? 'Conversa';
const attachmentName = (item: { arquivo: { nome: string } | null }) => item.arquivo?.nome ?? null;

// ------------------------------------------------------------------------------------ início

type Tab = 'chats' | 'channels';

/** Mensagens com dados reais: Conversas (1:1 e grupos) e Canais das turmas. Atualiza sozinha enquanto está aberta. */
export function ApiMessagesHome() {
  const router = useRouter();
  const { request } = useSession();
  const viewer = useViewer();
  const now = useNow();
  const focused = useScreenFocused();
  const chat = canChatWith(viewer.perfil);
  const [tab, setTab] = useState<Tab>(chat ? 'chats' : 'channels');
  const loadChats = useCallback(() => request<ApiConversa[]>('/mensagens/conversas'), [request]);
  const loadChannels = useCallback(() => request<ApiCanal[]>('/mensagens/canais'), [request]);
  const chats = usePolled(loadChats, 15_000, focused && chat);
  const channels = usePolled(loadChannels, 15_000, focused);
  const current = tab === 'chats' && chat ? chats : channels;
  const chatUnread = (chats.data ?? []).reduce((sum, item) => sum + item.naoLidas, 0);
  const channelUnread = (channels.data ?? []).reduce((sum, item) => sum + item.naoLidas, 0);
  const turmaIds = [...new Set((channels.data ?? []).map((channel) => channel.turmaId))];

  return <Screen>
    <AcademicHeader back fallbackHref="/connected" title="Mensagens" subtitle="Conversas e canais das suas turmas" />
    {chat ? <SegmentTabs label="Tipo de mensagem" selected={tab} onSelect={setTab} items={[{ key: 'chats', label: 'Conversas', count: chatUnread }, { key: 'channels', label: 'Canais', count: channelUnread }]} /> : null}
    <RequestState loading={current.loading && !current.data} error={current.data ? '' : current.error} onRetry={current.refresh} />

    {tab === 'chats' && chat && chats.data ? <>
      <ActionButton title="Nova conversa" onPress={() => router.push('/messages/new')} />
      {chats.data.length ? <Panel><RowList>{chats.data.map((conversation) => {
        const title = conversationTitle(conversation, viewer.id);
        const last = conversation.ultimaMensagem;
        const who = !last ? '' : last.autorId === viewer.id ? 'Você: ' : conversation.tipo === 'GRUPO' ? `${firstName(last.autor)}: ` : '';
        const text = last ? last.texto || (last.arquivo ? `Anexo: ${last.arquivo}` : '') : 'Sem mensagens ainda';
        return <ChatListRow
          key={conversation.id}
          leading={<Avatar name={title} size={48} />}
          title={title}
          preview={`${who}${text}`}
          time={last ? listTimeLabel(last.criadaEm, now) : ''}
          unread={conversation.naoLidas}
          onPress={() => router.push({ pathname: '/messages/chat/[id]', params: { id: conversation.id } })} />;
      })}</RowList></Panel>
        : <EmptyState title="Nenhuma conversa" detail="Toque em Nova conversa para falar com alguém das suas turmas." />}
    </> : null}

    {(tab === 'channels' || !chat) && channels.data ? (channels.data.length
      ? turmaIds.map((turmaId) => {
        const inClass = (channels.data ?? []).filter((channel) => channel.turmaId === turmaId);
        return <Panel key={turmaId}>
          <PanelHeader title={inClass[0].turma} />
          <RowList>{inClass.map((channel) => <ChatListRow
            key={channel.id}
            leading={<Avatar name={channel.nome} label="#" size={48} square />}
            title={channel.nome}
            preview={channel.ultima ? `${firstName(channel.ultima.autor)}: ${channel.ultima.texto}` : 'Nenhuma publicação ainda'}
            time={channel.ultima ? listTimeLabel(channel.ultima.criadaEm, now) : ''}
            unread={channel.naoLidas}
            onPress={() => router.push({ pathname: '/messages/channel/[id]', params: { id: channel.id } })} />)}</RowList>
        </Panel>;
      })
      : <EmptyState title="Nenhum canal" detail="Os canais aparecem quando você está em uma turma." />) : null}
  </Screen>;
}

// ------------------------------------------------------------------------------------ conversa

/** Linha do tempo de uma conversa: separador de dia, balões e o autor só quando muda (em grupo). */
function chatItems(messages: ApiMensagem[], meId: string, group: boolean, now: number, onLike: (message: ApiMensagem) => void) {
  const items: ReactNode[] = [];
  let previousDay = '';
  let previousAuthor = '';
  for (const message of messages) {
    const day = daySeparator(message.criadaEm, now);
    if (day !== previousDay) { items.push(<Separator key={`d-${message.id}`}>{day}</Separator>); previousDay = day; previousAuthor = ''; }
    const mine = message.autorId === meId;
    items.push(<Bubble
      key={message.id}
      mine={mine}
      author={group && !mine && message.autorId !== previousAuthor ? message.autor : undefined}
      body={message.texto}
      attachment={attachmentName(message)}
      time={clock(message.criadaEm)}
      likes={message.curtidas}
      liked={message.curtidaPorMim}
      onLike={() => onLike(message)} />);
    previousAuthor = message.autorId;
  }
  return items;
}

function OlderButton({ visible, loading, onPress }: { visible: boolean; loading: boolean; onPress: () => void }) {
  return visible ? <ActionButton secondary disabled={loading} title={loading ? 'Carregando' : 'Carregar anteriores'} onPress={onPress} /> : null;
}

export function ApiConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { request } = useSession();
  const viewer = useViewer();
  const upload = useUploadDocument();
  const { refresh: refreshSummary } = useMessagesSummary();
  const now = useNow();
  const focused = useScreenFocused();
  const loadConversation = useCallback(() => request<ApiConversa>(`/mensagens/conversas/${id}`), [request, id]);
  const loadMessages = useCallback(() => request<Pagina<ApiMensagem>>(`/mensagens/conversas/${id}/mensagens?limite=50`), [request, id]);
  const conversation = usePolled(loadConversation, null, focused);
  const page = usePolled(loadMessages, 8_000, focused);
  const [older, setOlder] = useState<ApiMensagem[]>([]);
  const [olderMore, setOlderMore] = useState<boolean | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [notice, setNotice] = useState('');
  const messages = mergeById(older, page.data?.itens ?? []);
  const lastId = messages.at(-1)?.id;

  useEffect(() => {
    if (!lastId || !focused) return;
    void request<unknown>(`/mensagens/conversas/${id}/leitura`, { method: 'PUT' }).then(() => refreshSummary(), () => undefined);
  }, [lastId, focused, id, request, refreshSummary]);

  async function loadOlder() {
    const first = messages[0];
    if (!first) return;
    setLoadingOlder(true); setNotice('');
    try {
      const result = await request<Pagina<ApiMensagem>>(`/mensagens/conversas/${id}/mensagens?limite=50&antes=${first.id}`);
      setOlder((current) => mergeById(current, result.itens)); setOlderMore(result.temMais);
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : 'Não foi possível carregar as anteriores.'); }
    finally { setLoadingOlder(false); }
  }

  async function like(message: ApiMensagem) {
    try {
      const result = await request<LikeResult>('/mensagens/curtidas', { method: 'POST', body: { tipo: 'MENSAGEM', id: message.id } });
      const apply = (item: ApiMensagem) => item.id === message.id ? { ...item, ...result } : item;
      setOlder((current) => current.map(apply));
      page.setData((current) => current && { ...current, itens: current.itens.map(apply) });
    } catch { /* A contagem certa volta no próximo carregamento. */ }
  }

  async function send(body: string, document: PickedDocument | null) {
    const file = document ? await upload(document) : null;
    const created = await request<ApiMensagem>(`/mensagens/conversas/${id}/mensagens`, { method: 'POST', body: { ...(body.trim() ? { texto: body } : {}), ...(file ? { arquivoId: file.id } : {}) } });
    page.setData((current) => ({ itens: mergeById(current?.itens ?? [], [created]), temMais: current?.temMais ?? false }));
    refreshSummary();
  }

  const info = conversation.data;
  if (!info) {
    return <Screen><AcademicHeader back fallbackHref={apiTab} title="Conversa" /><RequestState loading={conversation.loading} error={conversation.error} onRetry={conversation.refresh} /></Screen>;
  }
  const title = conversationTitle(info, viewer.id);
  const group = info.tipo === 'GRUPO';
  const others = info.participantes.filter((person) => person.id !== viewer.id);

  return <ChatLayout
    fallback={apiTab}
    avatar={<Avatar name={title} size={40} />}
    title={title}
    subtitle={group ? [...others.map((person) => firstName(person.nome)), 'você'].join(', ') : roleLabel(others[0]?.perfil ?? '')}
    footer={<Composer label="Mensagem" placeholder="Escreva uma mensagem" onSend={send} />}>
    <OlderButton visible={olderMore ?? page.data?.temMais ?? false} loading={loadingOlder} onPress={() => void loadOlder()} />
    {notice ? <Feedback error message={notice} /> : null}
    {page.error && !page.data ? <RequestState loading={false} error={page.error} onRetry={page.refresh} /> : null}
    {messages.length ? chatItems(messages, viewer.id, group, now, (message) => void like(message)) : page.data ? <EmptyState title="Comece a conversa" detail="Escreva a primeira mensagem abaixo." /> : null}
  </ChatLayout>;
}

// ------------------------------------------------------------------------------------ canal

/** Dados do canal (nome e turma) a partir da lista; a rota só carrega a chave. */
function useChannelInfo(key: string | undefined) {
  const { request } = useSession();
  const load = useCallback(() => request<ApiCanal[]>('/mensagens/canais'), [request]);
  const list = usePolled(load, null, key !== undefined);
  return list.data?.find((channel) => channel.id === key);
}

export function ApiChannelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { request } = useSession();
  const viewer = useViewer();
  const upload = useUploadDocument();
  const { refresh: refreshSummary } = useMessagesSummary();
  const now = useNow();
  const focused = useScreenFocused();
  const channelPath = `/mensagens/canais/${encodeURIComponent(id)}`;
  const info = useChannelInfo(id);
  const loadPosts = useCallback(() => request<ChannelPage>(`${channelPath}/publicacoes?limite=50`), [request, channelPath]);
  const page = usePolled(loadPosts, 8_000, focused);
  const [older, setOlder] = useState<ApiPublicacao[]>([]);
  const [olderMore, setOlderMore] = useState<boolean | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [important, setImportant] = useState(false);
  const [notice, setNotice] = useState('');
  const posts = mergeById(older, page.data?.itens ?? []);
  const lastId = posts.at(-1)?.id;

  useEffect(() => {
    if (!lastId || !focused) return;
    void request<unknown>(`${channelPath}/leitura`, { method: 'PUT' }).then(() => refreshSummary(), () => undefined);
  }, [lastId, focused, channelPath, request, refreshSummary]);

  async function loadOlder() {
    const first = posts[0];
    if (!first) return;
    setLoadingOlder(true); setNotice('');
    try {
      const result = await request<Pagina<ApiPublicacao>>(`${channelPath}/publicacoes?limite=50&antes=${first.id}`);
      setOlder((current) => mergeById(current, result.itens)); setOlderMore(result.temMais);
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : 'Não foi possível carregar as anteriores.'); }
    finally { setLoadingOlder(false); }
  }

  async function like(post: ApiPublicacao) {
    try {
      const result = await request<LikeResult>('/mensagens/curtidas', { method: 'POST', body: { tipo: 'PUBLICACAO', id: post.id } });
      const apply = (item: ApiPublicacao) => item.id === post.id ? { ...item, ...result } : item;
      setOlder((current) => current.map(apply));
      page.setData((current) => current && { ...current, itens: current.itens.map(apply) });
    } catch { /* A contagem certa volta no próximo carregamento. */ }
  }

  async function publish(body: string, document: PickedDocument | null) {
    const file = document ? await upload(document) : null;
    const created = await request<ApiPublicacao>(`${channelPath}/publicacoes`, { method: 'POST', body: { texto: body, importante: important, ...(file ? { arquivoId: file.id } : {}) } });
    page.setData((current) => current && { ...current, itens: mergeById(current.itens, [created]) });
    setImportant(false);
    refreshSummary();
  }

  if (!page.data) {
    return <Screen><AcademicHeader back fallbackHref={apiTab} title="Canal" /><RequestState loading={page.loading} error={page.error} onRetry={page.refresh} /></Screen>;
  }
  const canReply = page.data.podeResponder;
  const items: ReactNode[] = [];
  let previousDay = '';
  for (const post of posts) {
    const day = daySeparator(post.criadaEm, now);
    if (day !== previousDay) { items.push(<Separator key={`d-${post.id}`}>{day}</Separator>); previousDay = day; }
    const count = post.respostas;
    items.push(<PostBlock
      key={post.id}
      post={{ author: post.autor, body: post.texto, important: post.importante, attachment: attachmentName(post), createdAt: post.criadaEm, likes: post.curtidas }}
      now={now}
      isNew={false}
      liked={post.curtidaPorMim}
      onLike={canChatWith(viewer.perfil) ? () => void like(post) : undefined}
      actions={<Pressable
        accessibilityRole="button"
        accessibilityLabel={count ? `${count} ${count === 1 ? 'resposta' : 'respostas'}. Abrir a conversa` : canReply ? 'Responder à publicação' : 'Abrir a publicação'}
        onPress={() => router.push({ pathname: '/messages/thread/[id]', params: { id: post.id } })}
        style={({ pressed }) => [styles.thread, pressed && styles.pressed]}>
        <Icon name="message" color={palette.secondary} size={18} />
        <Text style={styles.threadText}>{count ? `${count} ${count === 1 ? 'resposta' : 'respostas'}` : canReply ? 'Responder' : 'Sem respostas'}</Text>
        <Icon name="chevronRight" color={palette.muted} size={18} />
      </Pressable>} />);
  }
  const readOnly = viewer.perfil === 'TUTOR' ? 'A tutoria acompanha o canal em leitura.' : viewer.perfil === 'PROFESSOR' ? 'Turma fechada: o canal está somente para leitura.' : 'Só docentes publicam. Toque em uma publicação para responder.';

  return <ChatLayout
    fallback={apiTab}
    avatar={<Avatar name={info?.nome ?? 'Canal'} label="#" size={40} square />}
    title={info?.nome ?? 'Canal'}
    subtitle={info?.turma}
    footer={page.data.podePublicar
      ? <Composer label="Publicação" placeholder="Publicar no canal" extra={<ToggleChip label="Aviso importante" on={important} onPress={() => setImportant((value) => !value)} />} onSend={publish} />
      : <ReadOnlyBar>{readOnly}</ReadOnlyBar>}>
    <OlderButton visible={olderMore ?? page.data.temMais} loading={loadingOlder} onPress={() => void loadOlder()} />
    {notice ? <Feedback error message={notice} /> : null}
    {posts.length ? items : <EmptyState title="Nenhuma publicação neste canal" detail={page.data.podePublicar ? 'Use o campo abaixo para publicar a primeira mensagem.' : 'Quando o docente publicar, a mensagem aparece aqui.'} />}
  </ChatLayout>;
}

// ------------------------------------------------------------------------------------ fio

export function ApiThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { request } = useSession();
  const viewer = useViewer();
  const upload = useUploadDocument();
  const { refresh: refreshSummary } = useMessagesSummary();
  const now = useNow();
  const focused = useScreenFocused();
  const loadThread = useCallback(() => request<ThreadPage>(`/mensagens/publicacoes/${id}`), [request, id]);
  const thread = usePolled(loadThread, 8_000, focused);
  const channelKey = thread.data?.publicacao.canal;
  const info = useChannelInfo(channelKey);
  const replyCount = thread.data?.respostas.length;

  useEffect(() => {
    if (!channelKey || !focused) return;
    void request<unknown>(`/mensagens/canais/${encodeURIComponent(channelKey)}/leitura`, { method: 'PUT' }).then(() => refreshSummary(), () => undefined);
  }, [channelKey, replyCount, focused, request, refreshSummary]);

  async function like(tipo: 'PUBLICACAO' | 'RESPOSTA', target: string) {
    try {
      const result = await request<LikeResult>('/mensagens/curtidas', { method: 'POST', body: { tipo, id: target } });
      thread.setData((current) => current && (tipo === 'PUBLICACAO'
        ? { ...current, publicacao: { ...current.publicacao, ...result } }
        : { ...current, respostas: current.respostas.map((reply) => reply.id === target ? { ...reply, ...result } : reply) }));
    } catch { /* A contagem certa volta no próximo carregamento. */ }
  }

  async function reply(body: string, document: PickedDocument | null) {
    const file = document ? await upload(document) : null;
    const created = await request<ApiResposta>(`/mensagens/publicacoes/${id}/respostas`, { method: 'POST', body: { ...(body.trim() ? { texto: body } : {}), ...(file ? { arquivoId: file.id } : {}) } });
    thread.setData((current) => current && { ...current, respostas: mergeById(current.respostas, [created]), publicacao: { ...current.publicacao, respostas: current.publicacao.respostas + 1 } });
    refreshSummary();
  }

  const data = thread.data;
  if (!data) {
    return <Screen><AcademicHeader back fallbackHref={apiTab} title="Publicação" /><RequestState loading={thread.loading} error={thread.error} onRetry={thread.refresh} /></Screen>;
  }
  const post = data.publicacao;
  const count = data.respostas.length;

  return <ChatLayout
    fallback={{ pathname: '/messages/channel/[id]', params: { id: post.canal } }}
    avatar={<Avatar name={info?.nome ?? 'Canal'} label="#" size={40} square />}
    title="Publicação"
    subtitle={info ? `${info.nome} · ${info.turma}` : undefined}
    footer={data.podeResponder
      ? <Composer label="Resposta" placeholder="Responder à publicação" onSend={reply} />
      : <ReadOnlyBar>{viewer.perfil === 'TUTOR' ? 'A tutoria acompanha em leitura e não responde.' : 'Turma fechada: as respostas estão encerradas.'}</ReadOnlyBar>}>
    <PostBlock
      post={{ author: post.autor, body: post.texto, important: post.importante, attachment: attachmentName(post), createdAt: post.criadaEm, likes: post.curtidas }}
      now={now}
      isNew={false}
      liked={post.curtidaPorMim}
      onLike={canChatWith(viewer.perfil) ? () => void like('PUBLICACAO', post.id) : undefined} />
    <Separator>{count ? `${count} ${count === 1 ? 'resposta' : 'respostas'}` : 'Nenhuma resposta ainda'}</Separator>
    {data.respostas.map((item) => <Bubble
      key={item.id}
      mine={item.autorId === viewer.id}
      author={item.autorId === viewer.id ? undefined : item.autor}
      body={item.texto}
      attachment={attachmentName(item)}
      time={clock(item.criadaEm)}
      likes={item.curtidas}
      liked={item.curtidaPorMim}
      onLike={canChatWith(viewer.perfil) ? () => void like('RESPOSTA', item.id) : undefined} />)}
  </ChatLayout>;
}

// ------------------------------------------------------------------------------------ nova conversa

/** Escolher uma ou mais pessoas das suas turmas. Uma pessoa abre a conversa direta; mais de uma, um grupo com nome. */
export function NewConversationScreen() {
  const router = useRouter();
  const { request } = useSession();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ApiContato[]>([]);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(() => request<ApiContato[]>(`/mensagens/contatos${search ? `?q=${encodeURIComponent(search)}` : ''}`), [request, search]);
  const contacts = usePolled(load, null);
  const isSelected = (contact: ApiContato) => selected.some((item) => item.id === contact.id);
  const toggle = (contact: ApiContato) => setSelected((current) => isSelected(contact) ? current.filter((item) => item.id !== contact.id) : [...current, contact]);
  const group = selected.length > 1;
  const ready = selected.length > 0 && (!group || title.trim().length > 0) && !busy;

  async function start() {
    setBusy(true); setError('');
    try {
      const created = await request<ApiConversa>('/mensagens/conversas', { method: 'POST', body: { participanteIds: selected.map((person) => person.id), ...(group ? { titulo: title.trim() } : {}) } });
      router.replace({ pathname: '/messages/chat/[id]', params: { id: created.id } });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível iniciar a conversa.'); setBusy(false); }
  }

  return <Screen>
    <AcademicHeader back fallbackHref={apiTab} title="Nova conversa" subtitle="Escolha quem participa" />
    <FormField label="Buscar pessoa" value={query} onChangeText={setQuery} placeholder="Nome" />
    {selected.length ? <View style={styles.chips}>{selected.map((person) => <Chip key={person.id} selected label={`${person.nome} · remover`} onPress={() => toggle(person)} />)}</View> : null}
    {group ? <FormField label="Nome do grupo" value={title} onChangeText={setTitle} placeholder="Ex.: Grupo de estudo" /> : null}
    <RequestState loading={contacts.loading && !contacts.data} error={contacts.data ? '' : contacts.error} onRetry={contacts.refresh} />
    {contacts.data ? (contacts.data.length
      ? <Panel><RowList>{contacts.data.map((contact) => <Pressable
        key={contact.id}
        accessibilityRole="button"
        accessibilityLabel={`${contact.nome}, ${roleLabel(contact.perfil)}${isSelected(contact) ? ', selecionado' : ''}`}
        aria-pressed={isSelected(contact)}
        onPress={() => toggle(contact)}
        style={({ pressed }) => [styles.contact, pressed && styles.pressed]}>
        <Avatar name={contact.nome} size={44} />
        <View style={styles.contactText}>
          <Text numberOfLines={1} style={styles.contactName}>{contact.nome}</Text>
          <Text numberOfLines={1} style={styles.contactMeta}>{[roleLabel(contact.perfil), ...contact.turmas].join(' · ')}</Text>
        </View>
        {isSelected(contact) ? <Badge text="Selecionado" tone="neutral" /> : null}
      </Pressable>)}</RowList></Panel>
      : <EmptyState title="Ninguém encontrado" detail={search ? 'Nenhuma pessoa das suas turmas tem esse nome.' : 'Você ainda não divide uma turma com ninguém.'} />) : null}
    {error ? <Feedback error message={error} /> : null}
    <ActionButton title={busy ? 'Abrindo' : group ? 'Criar grupo' : 'Iniciar conversa'} disabled={!ready} onPress={() => void start()} />
  </Screen>;
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.72 },
  thread: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 4 },
  threadText: { color: palette.secondary, ...type.label },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  contact: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 8 },
  contactText: { flex: 1, gap: 2 },
  contactName: { color: palette.ink, ...type.label },
  contactMeta: { color: palette.muted, ...type.caption },
});
