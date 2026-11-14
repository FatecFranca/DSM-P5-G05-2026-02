import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useSession } from '@/auth/session';
import { demoStudentId } from './academic';
import { demoStudents } from './data';
import { addPost, addReply, chatUnread, createInitialMessages, demoTeacherName, lastRead, markRead, sendChat, toggleLike, totalUnread, unreadCount, type LikeTarget, type MessagesState, type ViewerRole } from './messages';

interface MessagesDemoValue {
  state: MessagesState;
  /** Perfil que está lendo, ou `null` onde não há mensagens (coordenação). */
  viewer: ViewerRole | null;
  viewerName: string;
  total: number;
  /** Não lidas de um canal. */
  unread: (channelId: string) => number;
  /** Não lidas de uma conversa. */
  unreadChat: (conversationId: string) => number;
  readAt: (id: string) => string | null;
  publish: (channelId: string, body: string, important: boolean, attachment: string | null) => void;
  respond: (postId: string, body: string, attachment: string | null) => void;
  send: (conversationId: string, body: string, attachment: string | null) => void;
  like: (target: LikeTarget) => void;
  /** Marca um canal ou uma conversa como lido. */
  markRead: (id: string) => void;
}

const MessagesDemoContext = createContext<MessagesDemoValue | null>(null);
const messageId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const studentName = demoStudents.find((student) => student.id === demoStudentId)?.name ?? 'Estudante';

/** Mensagens da demonstração: ficam só em memória, somem ao reiniciar e nunca vão ao servidor. */
export function MessagesDemoProvider({ children }: { children: ReactNode }) {
  const { state: session } = useSession();
  const [state, setState] = useState(() => createInitialMessages(Date.now()));
  const demo = session.status === 'signedIn' && session.mode === 'demo';
  const perfil = demo ? session.user.perfil : null;
  const viewer: ViewerRole | null = perfil === 'ALUNO' || perfil === 'PROFESSOR' || perfil === 'TUTOR' ? perfil : null;
  const viewerName = viewer === 'ALUNO' ? studentName : demoTeacherName;

  const need = useCallback(() => {
    if (!viewer) throw new Error('Mensagens indisponíveis para este perfil.');
    return viewer;
  }, [viewer]);

  const publish = useCallback((channelId: string, body: string, important: boolean, attachment: string | null) => {
    setState(addPost(state, { id: messageId(), viewer: need(), channelId, author: viewerName, body, important, attachment, now: Date.now() }));
  }, [state, need, viewerName]);

  const respond = useCallback((postId: string, body: string, attachment: string | null) => {
    setState(addReply(state, { id: messageId(), viewer: need(), postId, author: viewerName, body, attachment, now: Date.now() }));
  }, [state, need, viewerName]);

  const send = useCallback((conversationId: string, body: string, attachment: string | null) => {
    setState(sendChat(state, { id: messageId(), viewer: need(), conversationId, author: viewerName, body, attachment, now: Date.now() }));
  }, [state, need, viewerName]);

  const like = useCallback((target: LikeTarget) => { setState(toggleLike(state, need(), target)); }, [state, need]);

  const markReadId = useCallback((id: string) => {
    if (viewer) setState((current) => markRead(current, viewer, id, Date.now()));
  }, [viewer]);

  const value = useMemo<MessagesDemoValue>(() => ({
    state, viewer, viewerName,
    total: viewer ? totalUnread(state, viewer) : 0,
    unread: (channelId) => viewer ? unreadCount(state, viewer, channelId) : 0,
    unreadChat: (conversationId) => viewer ? chatUnread(state, viewer, conversationId) : 0,
    readAt: (id) => viewer ? lastRead(state, viewer, id) : null,
    publish, respond, send, like, markRead: markReadId,
  }), [state, viewer, viewerName, publish, respond, send, like, markReadId]);
  return <MessagesDemoContext.Provider value={value}>{children}</MessagesDemoContext.Provider>;
}

export function useMessagesDemo() {
  const value = useContext(MessagesDemoContext);
  if (!value) throw new Error('useMessagesDemo deve ser usado dentro de MessagesDemoProvider.');
  return value;
}
