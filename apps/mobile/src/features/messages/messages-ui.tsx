import type { Href } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/icons';
import { useGoBack } from '@/components/top-bar';
import { palette, radius, space, type } from '@/constants/design';
import { pickDocument, type PickedDocument } from '@/demo/document';
import { maxMessageLength, type ViewerRole } from '@/demo/messages';

export const clock = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
/** Onde fica a aba Mensagens de cada perfil: para onde "Voltar" cai quando não há histórico. */
export const messagesTab = (viewer: ViewerRole | null): Href => viewer === 'ALUNO' ? '/student/messages' : viewer ? '/professor/messages' : '/home';
export const firstName = (name: string) => name.replace(/^(profa?|dra?|sra?)\.?\s+/i, '').split(' ')[0];

/**
 * Tela de conversa: cabeçalho, corpo que rola até a mensagem mais recente e o rodapé (campo de
 * escrever) SEMPRE visível. É o que separa um chat de uma lista de cartões.
 */
export function ChatLayout({ fallback, avatar, title, subtitle, children, footer }: { fallback: Href; avatar: ReactNode; title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  const goBack = useGoBack(fallback);
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollViewInstance>(null);
  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={6} onPress={goBack} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <Icon name="arrowLeft" color={palette.ink} size={28} />
        </Pressable>
        {avatar}
        <View style={styles.headerText}>
          <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>{title}</Text>
          {subtitle ? <Text numberOfLines={1} style={styles.caption}>{subtitle}</Text> : null}
        </View>
      </View>
      <ScrollView ref={scroller} style={styles.flex} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}>
        <View style={styles.column}>{children}</View>
      </ScrollView>
      {footer ? <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.sm) }]}><View style={styles.column}>{footer}</View></View> : null}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

/** Faixa no lugar do campo de escrever quando o perfil só lê. Diz por que, em vez de sumir com o campo. */
export function ReadOnlyBar({ children }: { children: string }) {
  return <Text style={styles.readOnly}>{children}</Text>;
}

/** Marca de anexo: só o nome do arquivo, porque a demonstração não envia nem baixa nada. */
export function AttachmentChip({ name, onRemove }: { name: string; onRemove?: () => void }) {
  return <View accessibilityLabel={`Anexo: ${name}`} accessible style={styles.attachment}>
    <Icon name="folder" color={palette.muted} size={18} />
    <Text numberOfLines={1} style={styles.attachmentName}>{name}</Text>
    {onRemove ? <Pressable accessibilityRole="button" accessibilityLabel={`Remover anexo ${name}`} hitSlop={10} onPress={onRemove} style={styles.attachmentRemove}><Text style={styles.attachmentRemoveText}>Remover</Text></Pressable> : null}
  </View>;
}

/** Curtir: texto e contagem, sem emoji. `aria-pressed` diz se foi você. */
export function LikeButton({ count, liked, onPress, disabled = false }: { count: number; liked: boolean; onPress: () => void; disabled?: boolean }) {
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={liked ? `Curtido por você, ${count} no total` : count ? `Curtir, ${count} curtidas` : 'Curtir'}
    aria-pressed={liked}
    disabled={disabled}
    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    onPress={onPress}
    style={({ pressed }) => [styles.like, liked && styles.likeOn, pressed && styles.pressed]}>
    <Text style={[styles.likeText, liked && styles.likeTextOn]}>{liked ? 'Curtido' : 'Curtir'}{count ? ` · ${count}` : ''}</Text>
  </Pressable>;
}

/** Balão de mensagem. O seu fica à direita e tingido; o dos outros, à esquerda, com o autor quando é grupo. */
export function Bubble({ mine, author, body, attachment, time, likes, liked, onLike }: {
  mine: boolean;
  author?: string;
  body: string;
  attachment: string | null;
  time: string;
  likes: number;
  liked: boolean;
  onLike?: () => void;
}) {
  // Reagir é um gesto, não um botão em cada balão: tocar no balão mostra "Curtir"; curtidas já feitas ficam visíveis.
  const [open, setOpen] = useState(false);
  const showLike = likes > 0 || open;
  return <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
    <Pressable
      accessibilityHint={onLike ? 'Toque para mostrar a opção de curtir' : undefined}
      disabled={!onLike}
      onPress={() => setOpen((current) => !current)}
      style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
      {author ? <Text style={styles.bubbleAuthor}>{author}</Text> : null}
      {body ? <Text style={styles.bubbleBody}>{body}</Text> : null}
      {attachment ? <AttachmentChip name={attachment} /> : null}
      <View style={styles.bubbleFoot}>
        {showLike ? <LikeButton count={likes} liked={liked} onPress={onLike ?? (() => undefined)} disabled={!onLike} /> : null}
        <Text style={styles.time}>{time}</Text>
      </View>
    </Pressable>
  </View>;
}

/** Interruptor em forma de pílula (ex.: "Aviso importante"). */
export function ToggleChip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" aria-pressed={on} accessibilityLabel={label} hitSlop={{ top: 2, bottom: 2 }} onPress={onPress} style={[styles.toggle, on && styles.toggleOn]}>
    <Text style={[styles.toggleText, on && styles.toggleTextOn]}>{label}</Text>
  </Pressable>;
}

/**
 * Campo de escrever fixo no rodapé: anexar (só o nome), texto e enviar. Quem usa passa `onSend`; se ele
 * lançar um erro de validação, a mensagem aparece aqui e o texto digitado fica.
 */
export function Composer({ label, placeholder, onSend, extra }: { label: string; placeholder: string; onSend: (body: string, attachment: PickedDocument | null) => void | Promise<void>; extra?: ReactNode }) {
  const [body, setBody] = useState('');
  const [attachment, setAttachment] = useState<PickedDocument | null>(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const empty = !body.trim() && !attachment;

  async function attach() {
    try { const document = await pickDocument(); if (document) { setAttachment(document); setError(''); } }
    catch { setError('Não foi possível selecionar o documento.'); }
  }

  // O texto só some quando o envio dá certo; se falhar, ele fica para tentar de novo.
  async function send() {
    if (sending) return;
    setSending(true);
    try { await onSend(body, attachment); setBody(''); setAttachment(null); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível enviar.'); }
    finally { setSending(false); }
  }

  return <View style={styles.composer}>
    {error ? <Text accessibilityRole="alert" style={styles.composerError}>{error}</Text> : null}
    {attachment ? <View style={styles.composerAttachment}><AttachmentChip name={attachment.name} onRemove={() => setAttachment(null)} /></View> : null}
    {extra ? <View style={styles.composerExtra}>{extra}</View> : null}
    <View style={styles.composerRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="Anexar arquivo" onPress={() => void attach()} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
        <Icon name="plus" color={palette.secondary} size={22} />
      </Pressable>
      <TextInput
        accessibilityLabel={label}
        value={body}
        onChangeText={setBody}
        placeholder={placeholder}
        placeholderTextColor={palette.muted}
        multiline
        maxLength={maxMessageLength + 200}
        style={styles.input} />
      <Pressable accessibilityRole="button" accessibilityLabel="Enviar" aria-disabled={empty || sending} disabled={empty || sending} onPress={() => void send()} style={({ pressed }) => [styles.send, (empty || sending) && styles.sendOff, pressed && styles.pressed]}>
        <Text style={styles.sendText}>{sending ? 'Enviando' : 'Enviar'}</Text>
      </Pressable>
    </View>
  </View>;
}

/** Linha da lista de conversas e de canais: avatar, nome, prévia em uma linha, horário e não lidas. */
export function ChatListRow({ leading, title, preview, time, unread, onPress }: { leading: ReactNode; title: string; preview: string; time: string; unread: number; onPress: () => void }) {
  const label = [unread ? `${unread} ${unread === 1 ? 'não lida' : 'não lidas'}` : '', title, preview, time].filter(Boolean).join('. ');
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.listRow, pressed && styles.listRowPressed]}>
    {leading}
    <View style={styles.listText}>
      <Text numberOfLines={1} style={[styles.listTitle, unread > 0 && styles.listTitleUnread]}>{title}</Text>
      <Text numberOfLines={1} style={[styles.listPreview, unread > 0 && styles.listPreviewUnread]}>{preview}</Text>
    </View>
    <View style={styles.listSide}>
      <Text style={[styles.caption, unread > 0 && styles.listTimeUnread]}>{time}</Text>
      {unread > 0 ? <View style={styles.unreadPill}><Text style={styles.unreadText}>{unread}</Text></View> : <View style={styles.unreadSpacer} />}
    </View>
  </Pressable>;
}

/** Separador de dia ou "Novas mensagens", centralizado. */
export function Separator({ children, accent = false }: { children: string; accent?: boolean }) {
  return <View style={styles.separatorRow}>
    <View style={[styles.separatorLine, accent && styles.separatorLineAccent]} />
    <Text style={[styles.separatorText, accent && styles.separatorTextAccent]}>{children}</Text>
    <View style={[styles.separatorLine, accent && styles.separatorLineAccent]} />
  </View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  column: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  pressed: { opacity: 0.72 },
  caption: { color: palette.muted, ...type.caption },

  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.sm, paddingVertical: space.sm, backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: palette.line },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, gap: 1 },
  title: { color: palette.ink, ...type.heading },
  body: { flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: space.lg, paddingVertical: space.lg, gap: 6 },
  footer: { backgroundColor: palette.surface, borderTopWidth: 1, borderTopColor: palette.line, paddingHorizontal: space.md, paddingTop: space.sm },
  readOnly: { color: palette.muted, ...type.caption, textAlign: 'center', paddingVertical: space.sm },

  attachment: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%', paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface },
  attachmentName: { flexShrink: 1, color: palette.ink, ...type.caption },
  attachmentRemove: { paddingLeft: 6 },
  attachmentRemoveText: { color: palette.secondary, ...type.caption, fontWeight: '700' },

  like: { minHeight: 32, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: palette.line, justifyContent: 'center', backgroundColor: palette.surface },
  likeOn: { backgroundColor: palette.secondary, borderColor: palette.secondary },
  likeText: { color: palette.muted, ...type.caption, fontWeight: '600' },
  likeTextOn: { color: palette.surface, fontWeight: '700' },

  bubbleRow: { width: '100%', flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '84%', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.lg },
  bubbleMine: { backgroundColor: palette.primarySoft, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, borderBottomLeftRadius: 4 },
  bubbleAuthor: { color: palette.secondary, ...type.caption, fontWeight: '700' },
  bubbleBody: { color: palette.ink, ...type.body },
  bubbleFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: space.sm },
  time: { color: palette.muted, ...type.caption, fontVariant: ['tabular-nums'] },

  toggle: { minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, borderColor: palette.line, justifyContent: 'center', backgroundColor: palette.surface },
  toggleOn: { backgroundColor: palette.goldSoft, borderColor: palette.warning },
  toggleText: { color: palette.muted, ...type.caption, fontWeight: '600' },
  toggleTextOn: { color: palette.warning, fontWeight: '700' },

  composer: { gap: space.sm },
  composerError: { color: palette.dangerStrong, ...type.caption },
  composerAttachment: { flexDirection: 'row' },
  composerExtra: { flexDirection: 'row' },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  iconButton: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primarySoft },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderWidth: 1, borderColor: palette.line, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, color: palette.ink, backgroundColor: palette.surface, fontSize: 15 },
  send: { minHeight: 44, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  sendOff: { opacity: 0.4 },
  sendText: { color: palette.surface, ...type.label },

  listRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 },
  listRowPressed: { backgroundColor: palette.background },
  listText: { flex: 1, gap: 2 },
  listTitle: { color: palette.ink, ...type.label },
  listTitleUnread: { fontWeight: '800' },
  listPreview: { color: palette.muted, ...type.caption },
  listPreviewUnread: { color: palette.ink, fontWeight: '600' },
  listSide: { alignItems: 'flex-end', gap: 4, minWidth: 40 },
  listTimeUnread: { color: palette.secondary, fontWeight: '700' },
  unreadPill: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: palette.secondary, alignItems: 'center', justifyContent: 'center' },
  unreadText: { color: palette.surface, ...type.caption, fontWeight: '700', fontVariant: ['tabular-nums'] },
  unreadSpacer: { height: 22 },

  separatorRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginVertical: space.sm },
  separatorLine: { flex: 1, height: 1, backgroundColor: palette.line },
  separatorLineAccent: { backgroundColor: palette.secondary },
  separatorText: { color: palette.muted, ...type.caption, fontWeight: '600' },
  separatorTextAccent: { color: palette.secondary, fontWeight: '700' },
});
