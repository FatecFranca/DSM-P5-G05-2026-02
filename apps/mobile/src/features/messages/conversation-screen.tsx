import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Screen } from '@/components/primitives';
import { AcademicHeader, Avatar, EmptyState } from '@/demo/academic-ui';
import { canChat, conversationMessages, conversationTitle, isGroup, participates, viewerKey } from '@/demo/messages';
import { useMessagesDemo } from '@/demo/messages-store';
import { daySeparator } from '@/features/connected/collaboration';
import { useNow } from '@/features/connected/use-now';
import { Bubble, ChatLayout, Composer, ReadOnlyBar, Separator, clock, firstName, messagesTab } from './messages-ui';

/**
 * Conversa em balões, com o campo de escrever fixo embaixo. O seu balão fica à direita; nos grupos,
 * o nome do autor aparece só quando ele muda. Um divisor marca onde começam as mensagens novas.
 */
export function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const messages = useMessagesDemo();
  const now = useNow();
  const { viewer, state, markRead } = messages;
  // Quando esta conversa foi lida antes desta visita: o que veio depois ganha o divisor "Novas mensagens".
  const [since] = useState(() => messages.readAt(id));
  const conversation = viewer ? state.conversations.find((item) => item.id === id && participates(item, viewer)) : undefined;
  const thread = conversation ? conversationMessages(state, id) : [];

  useEffect(() => { if (conversation) markRead(id); }, [conversation, id, thread.length, markRead]);

  if (!viewer || !conversation) {
    return <Screen><AcademicHeader back fallbackHref={messagesTab(viewer)} title="Conversa" /><EmptyState title="Conversa não encontrada" detail="Ela pode não existir ou você não participa dela." /></Screen>;
  }

  const title = conversationTitle(conversation, viewer);
  const group = isGroup(conversation);
  const me = viewerKey(viewer);
  const others = conversation.participants.filter((person) => person.key !== me);
  let previousDay = '';
  let previousAuthor = '';
  let markedNew = false;
  const items: ReactNode[] = [];
  for (const message of thread) {
    const day = daySeparator(message.createdAt, now);
    if (day !== previousDay) { items.push(<Separator key={`d-${message.id}`}>{day}</Separator>); previousDay = day; previousAuthor = ''; }
    const mine = message.authorKey === me;
    if (!markedNew && !mine && (since === null || Date.parse(message.createdAt) > Date.parse(since))) {
      items.push(<Separator key={`n-${message.id}`} accent>Novas mensagens</Separator>);
      markedNew = true;
      previousAuthor = '';
    }
    items.push(<Bubble
      key={message.id}
      mine={mine}
      author={group && !mine && message.authorKey !== previousAuthor ? message.author : undefined}
      body={message.body}
      attachment={message.attachment}
      time={clock(message.createdAt)}
      likes={message.likes.length}
      liked={message.likes.includes(me)}
      onLike={() => messages.like({ kind: 'chat', id: message.id })} />);
    previousAuthor = message.authorKey;
  }

  return <ChatLayout
    fallback={messagesTab(viewer)}
    avatar={<Avatar name={title} size={40} />}
    title={title}
    subtitle={group ? [...others.map((person) => firstName(person.name)), 'você'].join(', ') : others[0]?.role === 'DOCENTE' ? 'Docente' : 'Estudante'}
    footer={canChat(viewer)
      ? <Composer label="Mensagem" placeholder="Escreva uma mensagem" onSend={(body, attachment) => messages.send(id, body, attachment?.name ?? null)} />
      : <ReadOnlyBar>A tutoria acompanha em leitura.</ReadOnlyBar>}>
    {thread.length ? items : <EmptyState title="Comece a conversa" detail="Escreva a primeira mensagem abaixo." />}
  </ChatLayout>;
}
