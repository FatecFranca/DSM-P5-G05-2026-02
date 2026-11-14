import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Icon } from '@/components/icons';
import { Screen } from '@/components/primitives';
import { palette, space, type } from '@/constants/design';
import { AcademicHeader, Avatar, Badge, EmptyState } from '@/demo/academic-ui';
import { authorRole, canPost, canReply, channelsForViewer, viewerKey } from '@/demo/messages';
import { useMessagesDemo } from '@/demo/messages-store';
import { daySeparator } from '@/features/connected/collaboration';
import { useNow } from '@/features/connected/use-now';
import { ChatLayout, Composer, ReadOnlyBar, Separator, ToggleChip, messagesTab } from './messages-ui';
import { PostBlock, demoPostView } from './post-block';

/**
 * Canal: as publicações do docente em ordem, a mais recente embaixo, e o campo de publicar fixo no
 * rodapé (só para o docente). Responder abre a thread da publicação, em vez de esconder tudo num acordeão.
 */
export function ChannelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const messages = useMessagesDemo();
  const now = useNow();
  const { viewer, state, markRead } = messages;
  const [since] = useState(() => messages.readAt(id));
  const [important, setImportant] = useState(false);
  const channel = viewer ? channelsForViewer(viewer).find((item) => item.id === id) : undefined;
  const posts = state.posts.filter((post) => post.channelId === id).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  const known = channel !== undefined;
  useEffect(() => { if (known) markRead(id); }, [known, id, posts.length, markRead]);

  if (!viewer || !channel) {
    return <Screen><AcademicHeader back fallbackHref={messagesTab(viewer)} title="Canal" /><EmptyState title="Canal não encontrado" detail="Ele pode não existir ou estar fora das suas turmas." /></Screen>;
  }

  const mine = authorRole(viewer);
  const key = viewerKey(viewer);
  const isNew = (iso: string, role: string) => role !== mine && (since === null || Date.parse(iso) > Date.parse(since));
  let previousDay = '';
  const items: ReactNode[] = [];
  for (const post of posts) {
    const day = daySeparator(post.createdAt, now);
    if (day !== previousDay) { items.push(<Separator key={`d-${post.id}`}>{day}</Separator>); previousDay = day; }
    const count = post.replies.length;
    const fresh = post.replies.filter((reply) => isNew(reply.createdAt, reply.role)).length;
    items.push(<PostBlock
      key={post.id}
      post={demoPostView(post)}
      now={now}
      isNew={isNew(post.createdAt, post.role)}
      liked={post.likes.includes(key)}
      onLike={() => messages.like({ kind: 'post', id: post.id })}
      actions={<Pressable
        accessibilityRole="button"
        accessibilityLabel={count ? `${count} ${count === 1 ? 'resposta' : 'respostas'}${fresh ? `, ${fresh} nova` : ''}. Abrir a conversa` : canReply(viewer) ? 'Responder à publicação' : 'Abrir a publicação'}
        onPress={() => router.push({ pathname: '/messages/thread/[id]', params: { id: post.id } })}
        style={({ pressed }) => [styles.thread, pressed && styles.pressed]}>
        <Icon name="message" color={palette.secondary} size={18} />
        <Text style={styles.threadText}>{count ? `${count} ${count === 1 ? 'resposta' : 'respostas'}` : canReply(viewer) ? 'Responder' : 'Sem respostas'}</Text>
        {fresh ? <Badge text={`${fresh} ${fresh === 1 ? 'nova' : 'novas'}`} tone="neutral" /> : null}
        <Icon name="chevronRight" color={palette.muted} size={18} />
      </Pressable>} />);
  }

  return <ChatLayout
    fallback={messagesTab(viewer)}
    avatar={<Avatar name={channel.name} label="#" size={40} square />}
    title={channel.name}
    subtitle={channel.className}
    footer={canPost(viewer)
      ? <Composer
        label="Publicação"
        placeholder="Publicar no canal"
        extra={<ToggleChip label="Aviso importante" on={important} onPress={() => setImportant((current) => !current)} />}
        onSend={(body, attachment) => { messages.publish(id, body, important, attachment?.name ?? null); setImportant(false); }} />
      : <ReadOnlyBar>{viewer === 'TUTOR' ? 'A tutoria acompanha o canal em leitura.' : 'Só docentes publicam. Toque em uma publicação para responder.'}</ReadOnlyBar>}>
    {posts.length ? items : <EmptyState title="Nenhuma publicação neste canal" detail={canPost(viewer) ? 'Use o campo abaixo para publicar a primeira mensagem.' : 'Quando o docente publicar, a mensagem aparece aqui.'} />}
  </ChatLayout>;
}

const styles = StyleSheet.create({
  thread: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 4 },
  pressed: { opacity: 0.72 },
  threadText: { color: palette.secondary, ...type.label },
});
