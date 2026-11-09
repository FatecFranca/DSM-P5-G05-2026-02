import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette, space, type } from '@/constants/design';
import { Avatar, Badge } from '@/demo/academic-ui';
import type { Post } from '@/demo/messages';
import { capitalize, relativeDay } from '@/features/connected/collaboration';
import { AttachmentChip, LikeButton, clock } from './messages-ui';

/**
 * Publicação de canal, sem cartão: autor, texto, anexo e ações em sequência, separadas por filete.
 * O aviso importante ganha um trilho âmbar à esquerda (é o único lugar com cor de destaque aqui).
 */
/** O que o bloco mostra de uma publicação, venha da demonstração ou da API. */
export interface PostView { author: string; body: string; important: boolean; attachment: string | null; createdAt: string; likes: number }

export const demoPostView = (post: Post): PostView => ({ author: post.author, body: post.body, important: post.important, attachment: post.attachment, createdAt: post.createdAt, likes: post.likes.length });

export function PostBlock({ post, now, isNew, liked, onLike, actions }: { post: PostView; now: number; isNew: boolean; liked: boolean; onLike?: () => void; actions?: ReactNode }) {
  return <View style={[styles.post, post.important && styles.important]}>
    <View style={styles.byline}>
      <Avatar name={post.author} size={40} />
      <View style={styles.bylineText}>
        <Text style={styles.author}>{post.author}</Text>
        <Text style={styles.meta}>Docente · {capitalize(relativeDay(post.createdAt, now))}, {clock(post.createdAt)}</Text>
      </View>
    </View>
    {post.important || isNew ? <View style={styles.badges}>
      {post.important ? <Badge text="Aviso importante" tone="attention" /> : null}
      {isNew ? <Badge text="Novo" tone="neutral" /> : null}
    </View> : null}
    <Text style={styles.body}>{post.body}</Text>
    {post.attachment ? <AttachmentChip name={post.attachment} /> : null}
    <View style={styles.actions}>
      {onLike || post.likes ? <LikeButton count={post.likes} liked={liked} onPress={onLike ?? (() => undefined)} disabled={!onLike} /> : null}
      {actions}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  post: { gap: space.sm, paddingVertical: 14, paddingLeft: 12, borderLeftWidth: 3, borderLeftColor: 'transparent', borderBottomWidth: 1, borderBottomColor: palette.line },
  important: { borderLeftColor: palette.warning },
  byline: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  bylineText: { flex: 1, gap: 1 },
  author: { color: palette.ink, ...type.label },
  meta: { color: palette.muted, ...type.caption },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  body: { color: palette.ink, ...type.body },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.md },
});
