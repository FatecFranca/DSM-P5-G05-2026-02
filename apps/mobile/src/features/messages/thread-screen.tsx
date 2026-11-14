import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Screen } from '@/components/primitives';
import { AcademicHeader, Avatar, EmptyState } from '@/demo/academic-ui';
import { authorRole, canReply, channelsForViewer, viewerKey } from '@/demo/messages';
import { useMessagesDemo } from '@/demo/messages-store';
import { useNow } from '@/features/connected/use-now';
import { Bubble, ChatLayout, Composer, ReadOnlyBar, Separator, clock, messagesTab } from './messages-ui';
import { PostBlock, demoPostView } from './post-block';

/**
 * Thread de uma publicação: a publicação no topo e as respostas em balões, com o campo de responder
 * fixo embaixo. É a mesma lógica de uma conversa, presa a uma publicação do canal.
 */
export function ThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const messages = useMessagesDemo();
  const now = useNow();
  const { viewer, state, markRead } = messages;
  const post = state.posts.find((item) => item.id === id);
  const channel = viewer && post ? channelsForViewer(viewer).find((item) => item.id === post.channelId) : undefined;
  const [since] = useState(() => post ? messages.readAt(post.channelId) : null);

  const channelId = channel?.id;
  const replyCount = post?.replies.length;
  useEffect(() => { if (channelId) markRead(channelId); }, [channelId, replyCount, markRead]);

  if (!viewer || !post || !channel) {
    return <Screen><AcademicHeader back fallbackHref={messagesTab(viewer)} title="Publicação" /><EmptyState title="Publicação não encontrada" detail="Ela pode não existir ou estar fora das suas turmas." /></Screen>;
  }

  const key = viewerKey(viewer);
  const mine = authorRole(viewer);
  const isNew = (iso: string, role: string) => role !== mine && (since === null || Date.parse(iso) > Date.parse(since));
  const count = post.replies.length;

  return <ChatLayout
    fallback={{ pathname: '/messages/channel/[id]', params: { id: channel.id } }}
    avatar={<Avatar name={channel.name} label="#" size={40} square />}
    title="Publicação"
    subtitle={`${channel.name} · ${channel.className}`}
    footer={canReply(viewer)
      ? <Composer label="Resposta" placeholder="Responder à publicação" onSend={(body, attachment) => messages.respond(post.id, body, attachment?.name ?? null)} />
      : <ReadOnlyBar>A tutoria acompanha em leitura e não responde.</ReadOnlyBar>}>
    <PostBlock post={demoPostView(post)} now={now} isNew={isNew(post.createdAt, post.role)} liked={post.likes.includes(key)} onLike={() => messages.like({ kind: 'post', id: post.id })} />
    <Separator>{count ? `${count} ${count === 1 ? 'resposta' : 'respostas'}` : 'Nenhuma resposta ainda'}</Separator>
    {post.replies.map((reply) => <Bubble
      key={reply.id}
      mine={reply.role === mine}
      author={reply.role === mine ? undefined : reply.author}
      body={reply.body}
      attachment={reply.attachment}
      time={clock(reply.createdAt)}
      likes={reply.likes.length}
      liked={reply.likes.includes(key)}
      onLike={() => messages.like({ kind: 'reply', id: reply.id })} />)}
  </ChatLayout>;
}
