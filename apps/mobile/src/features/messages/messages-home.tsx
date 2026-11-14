import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Screen } from '@/components/primitives';
import { AcademicDemoNotice, AcademicHeader, Avatar, EmptyState, Panel, PanelHeader, RowList, SegmentTabs } from '@/demo/academic-ui';
import { channelPreview, channelsForViewer, conversationTitle, conversationsForViewer, isGroup, lastChatMessage, viewerKey } from '@/demo/messages';
import { useMessagesDemo } from '@/demo/messages-store';
import { listTimeLabel } from '@/features/connected/collaboration';
import { useNow } from '@/features/connected/use-now';
import { ChatListRow, firstName } from './messages-ui';

type Tab = 'chats' | 'channels';

/**
 * Mensagens: duas listas, como no Teams. Conversas (1:1 e em grupo, da mais recente para a mais
 * antiga) e Canais (um geral e um por disciplina, agrupados por turma). Cada linha mostra a prévia
 * da última mensagem, o horário e quantas ainda não foram lidas.
 */
export function MessagesHome() {
  const router = useRouter();
  const messages = useMessagesDemo();
  const now = useNow();
  const [tab, setTab] = useState<Tab>('chats');
  const { viewer, state } = messages;

  if (!viewer) {
    return <Screen><AcademicHeader back fallbackHref="/home" title="Mensagens" /><EmptyState title="Indisponível para este perfil" detail="As mensagens são para estudantes e docentes." /></Screen>;
  }

  const conversations = conversationsForViewer(state, viewer);
  const channels = channelsForViewer(viewer);
  const classIds = [...new Set(channels.map((channel) => channel.classId))];
  const chatUnread = conversations.reduce((sum, conversation) => sum + messages.unreadChat(conversation.id), 0);
  const channelUnread = channels.reduce((sum, channel) => sum + messages.unread(channel.id), 0);

  return <Screen>
    <AcademicHeader back fallbackHref={viewer === 'ALUNO' ? '/student' : '/professor'} title="Mensagens" subtitle="Conversas e canais das suas turmas" />
    <AcademicDemoNotice />
    <SegmentTabs label="Tipo de mensagem" selected={tab} onSelect={setTab} items={[{ key: 'chats', label: 'Conversas', count: chatUnread }, { key: 'channels', label: 'Canais', count: channelUnread }]} />

    {tab === 'chats' ? (conversations.length
      ? <Panel><RowList>{conversations.map((conversation) => {
        const title = conversationTitle(conversation, viewer);
        const last = lastChatMessage(state, conversation.id);
        const mine = last?.authorKey === viewerKey(viewer);
        const who = mine ? 'Você: ' : isGroup(conversation) && last ? `${firstName(last.author)}: ` : '';
        const text = last ? last.body || (last.attachment ? `Anexo: ${last.attachment}` : '') : 'Sem mensagens ainda';
        return <ChatListRow
          key={conversation.id}
          leading={<Avatar name={title} size={48} />}
          title={title}
          preview={`${who}${text}`}
          time={last ? listTimeLabel(last.createdAt, now) : ''}
          unread={messages.unreadChat(conversation.id)}
          onPress={() => router.push({ pathname: '/messages/chat/[id]', params: { id: conversation.id } })} />;
      })}</RowList></Panel>
      : <EmptyState title="Nenhuma conversa" detail={viewer === 'TUTOR' ? 'A tutoria acompanha os canais em leitura e não tem conversas.' : 'Quando você trocar mensagens com alguém, a conversa aparece aqui.'} />)
      : classIds.map((classId) => {
        const inClass = channels.filter((channel) => channel.classId === classId);
        return <Panel key={classId}>
          <PanelHeader title={inClass[0].className} />
          <RowList>{inClass.map((channel) => {
            const preview = channelPreview(state, channel.id);
            return <ChatListRow
              key={channel.id}
              leading={<Avatar name={channel.name} label="#" size={48} square />}
              title={channel.name}
              preview={preview ? `${firstName(preview.author)}: ${preview.text}` : 'Nenhuma publicação ainda'}
              time={preview ? listTimeLabel(preview.createdAt, now) : ''}
              unread={messages.unread(channel.id)}
              onPress={() => router.push({ pathname: '/messages/channel/[id]', params: { id: channel.id } })} />;
          })}</RowList>
        </Panel>;
      })}
  </Screen>;
}
