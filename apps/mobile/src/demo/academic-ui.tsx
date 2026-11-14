import { Children, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ScrollViewInstance } from 'react-native';
import { Icon, type IconName } from '@/components/icons';
import { TopBar, useGoBack } from '@/components/top-bar';
import { palette, radius, space, type } from '@/constants/design';
import { initials } from '@/features/connected/collaboration';

/** `backHref` leva sempre ao destino fixo; sem ele, Voltar usa o histórico e, sem histórico, `fallbackHref`. */
export function AcademicHeader({ title, subtitle, back = false, backHref, fallbackHref = '/home' }: { title: string; subtitle?: string; back?: boolean; backHref?: Href; fallbackHref?: Href }) {
  const router = useRouter();
  const goBack = useGoBack(fallbackHref);
  return <View style={styles.header}>
    <TopBar onBack={back ? backHref ? () => router.replace(backHref) : goBack : undefined} />
    <Text accessibilityRole="header" style={styles.title}>{title}</Text>
    {subtitle ? <Text style={styles.body}>{subtitle}</Text> : null}
  </View>;
}

/** Aviso único do modo demonstração: uma faixa, duas informações (dados fictícios e alterações só locais). */
export function AcademicDemoNotice() {
  return <View style={styles.notice}>
    <View style={styles.noticeDot} />
    <Text style={styles.noticeText}><Text style={styles.noticeStrong}>Dados fictícios.</Text> Alterações ficam só neste aparelho e não vão ao servidor.</Text>
  </View>;
}

export function Panel({ children }: { children: ReactNode }) {
  return <View style={styles.panel}>{children}</View>;
}

export function PanelTitle({ children }: { children: ReactNode }) {
  return <Text accessibilityRole="header" style={styles.panelTitle}>{children}</Text>;
}

/** Título do painel com uma ação à direita ("Ver todas"). A ação é um destino, não um comando. */
export function PanelHeader({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) {
  return <View style={styles.panelHeader}>
    <Text accessibilityRole="header" style={[styles.panelTitle, styles.panelHeaderTitle]}>{title}</Text>
    {actionLabel && onAction
      ? <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} hitSlop={6} onPress={onAction} style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}>
        <Text style={styles.headerActionText}>{actionLabel}</Text><Icon name="chevronRight" color={palette.secondary} size={18} />
      </Pressable>
      : null}
  </View>;
}

export function BodyText({ children }: { children: ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
}

export function Stat({ label, value }: { label: string; value: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

export interface StatItem {
  label: string;
  value: string;
  /** `attention` pinta o número de âmbar: é trabalho pendente, não um resultado. */
  tone?: 'attention';
}

/**
 * Indicadores de um recorte num único contêiner, separados por filetes. Substitui uma grade de
 * cartões iguais: o conjunto lê como uma linha de resumo, e só o que pede ação ganha cor.
 */
export function StatStrip({ items, columns }: { items: StatItem[]; columns?: number }) {
  const cols = columns ?? (items.length <= 3 ? items.length : 2);
  return <View style={styles.strip}>
    {items.map((item, index) => <View
      key={item.label}
      accessible
      accessibilityLabel={`${item.label}: ${item.value}`}
      style={[styles.stripCell, { width: `${100 / cols}%` }, (index + 1) % cols !== 0 && styles.stripRule, index >= cols && styles.stripTop]}>
      <Text style={[styles.stripValue, item.tone === 'attention' && styles.stripValueAttention]}>{item.value}</Text>
      <Text style={styles.stripLabel}>{item.label}</Text>
    </View>)}
  </View>;
}

/** Agrupa linhas com filete entre elas, sem caixa por linha. */
export function RowList({ children }: { children: ReactNode }) {
  return <View>{Children.toArray(children).map((row, index) => <View key={index} style={index > 0 ? styles.rowDivider : undefined}>{row}</View>)}</View>;
}

export type BadgeTone = 'attention' | 'danger' | 'ok' | 'neutral' | 'quiet';
const badgeTone: Record<BadgeTone, { color: string; background: string }> = {
  attention: { color: palette.warning, background: palette.goldSoft },
  danger: { color: palette.dangerStrong, background: palette.dangerSoft },
  ok: { color: palette.success, background: palette.successSoft },
  neutral: { color: palette.primary, background: palette.primarySoft },
  // Sem fundo: para o estado esperado, que não deve competir com a exceção ao lado.
  quiet: { color: palette.muted, background: 'transparent' },
};

/** Marca de estado ou contagem. O texto diz o que é; a cor só reforça. */
export function Badge({ text, tone }: { text: string; tone: BadgeTone }) {
  return <View style={[styles.badge, { backgroundColor: badgeTone[tone].background }]}><Text style={[styles.badgeText, { color: badgeTone[tone].color }]}>{text}</Text></View>;
}

/**
 * Linha de lista. Com `onPress`, a linha inteira é o alvo de toque e mostra o chevron: não há
 * mais um "Detalhes" pequeno ao lado de texto. `badge` marca contagem ou estado (o texto sempre
 * diz o que é; a cor só reforça); `value` é um número simples, em algarismos tabulares.
 */
export function ListRow({ title, meta, value, badge, onPress, leading, unread = false, muted = false }: {
  title: string;
  meta?: string;
  value?: string;
  badge?: { text: string; tone: BadgeTone };
  onPress?: () => void;
  /** Avatar ou ícone de tipo à esquerda (pessoas, eventos). */
  leading?: ReactNode;
  /** Item novo: ponto à esquerda e título em negrito. O texto da linha continua sendo a fonte do significado. */
  unread?: boolean;
  /** Item inativo (conta desativada): título esmaecido. O motivo continua dito em `badge`, nunca só pela cor. */
  muted?: boolean;
}) {
  const content = <>
    {unread ? <View style={styles.unreadDot} /> : null}
    {leading}
    <View style={styles.listText}>
      <Text style={[styles.listTitle, unread && styles.listTitleUnread, muted && styles.listTitleMuted]}>{title}</Text>
      {meta ? <Text style={academicStyles.meta}>{meta}</Text> : null}
    </View>
    {value ? <Text style={styles.listValue}>{value}</Text> : null}
    {badge ? <Badge text={badge.text} tone={badge.tone} /> : null}
    {onPress ? <Icon name="chevronRight" color={palette.muted} size={20} /> : null}
  </>;
  if (!onPress) return <View style={styles.listRow}>{content}</View>;
  const label = [unread ? 'Novo' : '', title, meta, value, badge?.text].filter(Boolean).join('. ');
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.listRow, pressed && styles.listRowPressed]}>{content}</Pressable>;
}

/**
 * Abas de seção ao estilo do Teams: texto com sublinhado na ativa e contagem opcional. Servem para
 * alternar visões do mesmo objeto (as seções de uma turma), não para passos de uma sequência.
 */
export function SegmentTabs<K extends string>({ items, selected, onSelect, label }: {
  items: { key: K; label: string; count?: number }[];
  selected: K;
  onSelect: (key: K) => void;
  label: string;
}) {
  const scroller = useRef<ScrollViewInstance>(null);
  const offsets = useRef<Record<string, number>>({});
  // Com várias abas a faixa rola; a aba ativa nunca pode ficar escondida do lado de fora.
  useEffect(() => {
    const x = offsets.current[selected];
    if (x !== undefined) scroller.current?.scrollTo({ x: Math.max(0, x - space.xl), animated: true });
  }, [selected]);
  return <View style={styles.tabsWrap}>
    <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" accessibilityLabel={label} contentContainerStyle={styles.tabsRow}>
      {items.map((item) => {
        const active = item.key === selected;
        return <Pressable
          key={item.key}
          accessibilityRole="tab"
          aria-selected={active}
          accessibilityLabel={item.count ? `${item.label}, ${item.count}` : item.label}
          onLayout={(event) => { offsets.current[item.key] = event.nativeEvent.layout.x; }}
          onPress={() => onSelect(item.key)}
          style={({ pressed }) => [styles.tab, active && styles.tabActive, pressed && styles.pressed]}>
          <Text style={[styles.tabText, active && styles.tabTextActive]}>{item.label}</Text>
          {item.count ? <View style={styles.tabCount}><Text style={styles.tabCountText}>{item.count}</Text></View> : null}
        </Pressable>;
      })}
    </ScrollView>
  </View>;
}

const avatarTones = [
  { background: palette.primarySoft, color: palette.primary },
  { background: palette.goldSoft, color: palette.warning },
  { background: palette.successSoft, color: palette.success },
  { background: palette.dangerSoft, color: palette.dangerStrong },
];

/** Iniciais num disco. A cor vem do nome, então a mesma pessoa tem sempre o mesmo avatar. */
export function Avatar({ name, size = 40, square = false, label }: { name: string; size?: number; /** Equipes (turmas) usam cantos arredondados; pessoas, disco. */ square?: boolean; /** Texto no lugar das iniciais (a sigla do curso, para turmas). */ label?: string }) {
  const text = label ?? initials(name);
  const tone = avatarTones[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % avatarTones.length];
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.avatar, { width: size, height: size, borderRadius: square ? size * 0.28 : size / 2, backgroundColor: tone.background }]}>
    <Text style={[styles.avatarText, { color: tone.color, fontSize: size * (text.length > 2 ? 0.3 : 0.38) }]}>{text}</Text>
  </View>;
}

/** Ícone de tipo num disco, para o feed de Atividade: o desenho acelera reconhecer o tipo de evento. */
export function TypeIcon({ name, size = 40 }: { name: IconName; size?: number }) {
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.typeIcon, { width: size, height: size, borderRadius: size / 2 }]}>
    <Icon name={name} color={palette.primary} size={size * 0.5} />
  </View>;
}

/**
 * Linha que expande para mostrar o detalhe (avaliações de uma disciplina, aulas de uma chamada).
 * O cabeçalho inteiro é o alvo de toque e o estado fica exposto como `expanded`. O conteúdo
 * aninhado ganha um filete lateral para ler como parte da linha, não como um cartão novo.
 */
export function Disclosure({ title, meta, value, badge, leading, summary, children, defaultExpanded = false, alignValues = true }: {
  title: string;
  /** Avatar ou ícone à esquerda, como em `ListRow`. */
  leading?: ReactNode;
  meta?: string;
  value?: string;
  badge?: { text: string; tone: BadgeTone };
  /** Fica entre o cabeçalho e o detalhe (por exemplo, um `Meter`) e não alterna o estado. */
  summary?: ReactNode;
  children: ReactNode;
  defaultExpanded?: boolean;
  /** Reserva a largura do chevron no corpo para os valores alinharem com o do cabeçalho. Desligue com formulários. */
  alignValues?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const label = [title, meta, value, badge?.text].filter(Boolean).join('. ');
  return <View>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={expanded ? 'Recolhe os detalhes' : 'Mostra os detalhes'}
      aria-expanded={expanded}
      onPress={() => setExpanded((current) => !current)}
      style={({ pressed }) => [styles.disclosureHead, pressed && styles.listRowPressed]}>
      {leading}
      <View style={styles.listText}>
        <Text style={styles.listTitle}>{title}</Text>
        {meta ? <Text style={academicStyles.meta}>{meta}</Text> : null}
      </View>
      {value ? <Text style={styles.listValue}>{value}</Text> : null}
      {badge ? <Badge text={badge.text} tone={badge.tone} /> : null}
      <View style={expanded ? styles.chevronOpen : undefined}><Icon name="chevronDown" color={palette.muted} size={20} /></View>
    </Pressable>
    {summary ? <View style={styles.disclosureSummary}>{summary}</View> : null}
    {expanded ? <View style={[styles.disclosureBody, !alignValues && styles.disclosureBodyWide]}>{children}</View> : null}
  </View>;
}

/**
 * Barra de progresso com o valor escrito ao lado. É neutra de propósito: nenhuma faixa de cor
 * sugere limite ou reprovação, porque a regra institucional vem da API e não está definida aqui.
 */
export function Meter({ value, label, valueLabel }: { value: number; label: string; valueLabel: string }) {
  const clamped = Math.max(0, Math.min(1, value));
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(clamped * 100)} aria-valuetext={valueLabel} style={styles.meter}>
    <View style={styles.meterHead}><Text style={academicStyles.meta}>{label}</Text><Text style={styles.meterValue}>{valueLabel}</Text></View>
    <View style={styles.meterTrack}><View style={[styles.meterFill, { width: `${clamped * 100}%` }]} /></View>
  </View>;
}

/** Contagem de trabalho pendente: com itens, âmbar e o número; sem itens, "Em dia". */
export function pendingBadge(count: number): { text: string; tone: BadgeTone } {
  return count > 0 ? { text: String(count), tone: 'attention' } : { text: 'Em dia', tone: 'ok' };
}

export type AttendanceKind = 'present' | 'absent' | 'justified' | 'none';

/** Presença como marca: só a falta ganha cor forte; "Presente" fica discreto para a exceção aparecer. */
export const attendanceBadge: Record<AttendanceKind, { text: string; tone: BadgeTone }> = {
  present: { text: 'Presente', tone: 'quiet' },
  absent: { text: 'Falta', tone: 'danger' },
  justified: { text: 'Justificada', tone: 'neutral' },
  none: { text: 'Não registrada', tone: 'quiet' },
};

/** Marcadores de carregamento no formato final da lista, para a tela não "pular" quando os dados chegam. */
export function SkeletonRows({ count = 3 }: { count?: number }) {
  return <View accessibilityRole="progressbar" accessibilityLabel="Carregando dados acadêmicos" style={styles.skeleton}>
    {Array.from({ length: count }, (_, index) => <View key={index} style={styles.skeletonRow}>
      <View style={[styles.skeletonBar, { width: `${62 - index * 8}%` }]} />
      <View style={[styles.skeletonBar, styles.skeletonBarShort]} />
    </View>)}
  </View>;
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text></Pressable>;
}

/**
 * Botão de ação. `secondary` é a ação de apoio (fundo suave); `danger` marca o que tira acesso ou apaga:
 * sozinho é o preenchido de confirmação, com `secondary` vira apenas o contorno que abre a confirmação.
 * `compact` não estica na largura, para ações lado a lado.
 */
export function ActionButton({ title, onPress, secondary = false, danger = false, compact = false, disabled = false }: { title: string; onPress: () => void; secondary?: boolean; danger?: boolean; compact?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, secondary && styles.actionSecondary, danger && (secondary ? styles.actionDangerQuiet : styles.actionDanger), compact && styles.actionCompact, pressed && styles.pressed, disabled && styles.disabled]}><Text style={[styles.actionText, secondary && styles.actionTextSecondary, danger && secondary && styles.actionTextDanger]}>{title}</Text></Pressable>;
}

export function FormField({ label, value, onChangeText, placeholder, keyboardType = 'default', multiline = false, secureTextEntry = false }: { label: string; value: string; onChangeText: (text: string) => void; placeholder?: string; keyboardType?: 'default' | 'numeric' | 'decimal-pad'; multiline?: boolean; secureTextEntry?: boolean }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={palette.muted} keyboardType={keyboardType} multiline={multiline} secureTextEntry={secureTextEntry} style={[styles.input, multiline && styles.multiline]} /></View>;
}

/** Estado vazio: diz o que pertence aqui e, quando há, oferece o passo seguinte em `action`. */
export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return <Panel><Text style={styles.listTitle}>{title}</Text><Text style={styles.body}>{detail}</Text>{action}</Panel>;
}

export function Feedback({ message, error = false }: { message: string; error?: boolean }) {
  return <Text accessibilityRole={error ? 'alert' : undefined} accessibilityLiveRegion="polite" style={[styles.feedback, error && styles.feedbackError]}>{message}</Text>;
}

export function formatAcademicDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatAcademicNumber(value: number | null, digits = 1) {
  return value === null ? '—' : value.toFixed(digits).replace('.', ',');
}

export const academicStyles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  stack: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  strong: { color: palette.ink, ...type.label },
  meta: { color: palette.muted, ...type.caption },
  // Conteúdo que a pessoa vai ler de verdade (instruções, comentários): tinta cheia e corpo de 14.
  prose: { color: palette.ink, ...type.body },
  link: { color: palette.secondary, fontSize: 13, fontWeight: '700', paddingVertical: space.sm },
  divider: { height: 1, backgroundColor: palette.line },
});

const styles = StyleSheet.create({
  header: { gap: space.xs },
  title: { color: palette.ink, ...type.title },
  body: { color: palette.muted, ...type.body },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.5 },

  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, backgroundColor: palette.goldSoft, borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: 10 },
  noticeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.gold, marginTop: 6 },
  noticeText: { flex: 1, color: palette.ink, ...type.caption },
  noticeStrong: { fontWeight: '700' },

  panel: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, borderRadius: radius.md, padding: space.lg, gap: space.md },
  panelTitle: { color: palette.ink, ...type.heading },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, minHeight: 28 },
  panelHeaderTitle: { flexShrink: 1 },
  headerAction: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingLeft: space.sm },
  headerActionText: { color: palette.secondary, ...type.label },

  stat: { flexGrow: 1, flexBasis: '43%', minWidth: 130, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, borderRadius: radius.md, padding: space.lg, gap: 5 },
  statValue: { color: palette.primary, ...type.figure },
  statLabel: { color: palette.muted, ...type.caption },

  strip: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, borderRadius: radius.md, overflow: 'hidden' },
  stripCell: { paddingVertical: 14, paddingHorizontal: space.lg, gap: 2, borderColor: palette.line },
  stripRule: { borderRightWidth: 1 },
  stripTop: { borderTopWidth: 1 },
  stripValue: { color: palette.primary, ...type.figure },
  stripValueAttention: { color: palette.warning },
  stripLabel: { color: palette.muted, ...type.caption },

  rowDivider: { borderTopWidth: 1, borderTopColor: palette.line },
  listRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 },
  listRowPressed: { backgroundColor: palette.background },
  listText: { flex: 1, gap: 2 },
  listTitleUnread: { fontWeight: '800' },
  listTitleMuted: { color: palette.muted },
  unreadDot: { position: 'absolute', left: -11, top: 24, width: 8, height: 8, borderRadius: 4, backgroundColor: palette.secondary },
  listTitle: { color: palette.ink, ...type.label },
  listValue: { color: palette.ink, ...type.figureSmall },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, minWidth: 28, alignItems: 'center' },
  badgeText: { ...type.caption, fontWeight: '700', fontVariant: ['tabular-nums'] },

  disclosureHead: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  disclosureBodyWide: { paddingRight: 0 },
  disclosureSummary: { paddingBottom: space.sm },
  // paddingRight = chevron (20) + espaço (12): os valores das linhas alinham com o do cabeçalho.
  disclosureBody: { marginBottom: space.sm, paddingLeft: space.md, paddingRight: 32, borderLeftWidth: 3, borderLeftColor: palette.primarySoft },

  tabsWrap: { borderBottomWidth: 1, borderBottomColor: palette.line },
  tabsRow: { gap: space.xs },
  tab: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, marginBottom: -1, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: palette.secondary },
  tabText: { color: palette.muted, ...type.label },
  tabTextActive: { color: palette.ink, fontWeight: '700' },
  tabCount: { minWidth: 20, paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.pill, backgroundColor: palette.primarySoft, alignItems: 'center' },
  tabCountText: { color: palette.primary, ...type.caption, fontWeight: '700', fontVariant: ['tabular-nums'] },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '700' },
  typeIcon: { backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },

  meter: { gap: 6 },
  meterHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.sm },
  meterValue: { color: palette.ink, ...type.figureSmall },
  meterTrack: { height: 8, borderRadius: 4, backgroundColor: palette.primarySoft, overflow: 'hidden' },
  meterFill: { height: 8, borderRadius: 4, backgroundColor: palette.secondary },

  skeleton: { gap: space.md },
  skeletonRow: { gap: 7, paddingVertical: 6 },
  skeletonBar: { height: 12, borderRadius: 6, backgroundColor: palette.line },
  skeletonBarShort: { width: '38%', height: 9, opacity: 0.6 },

  chip: { borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, borderRadius: radius.sm, minHeight: 44, paddingHorizontal: space.md, justifyContent: 'center' },
  chipSelected: { backgroundColor: palette.primary, borderColor: palette.primary },
  chipText: { color: palette.ink, fontSize: 13, fontWeight: '600' },
  chipTextSelected: { color: palette.surface },

  action: { minHeight: 48, backgroundColor: palette.primary, borderRadius: radius.sm, paddingHorizontal: space.lg, alignItems: 'center', justifyContent: 'center' },
  actionSecondary: { backgroundColor: palette.primarySoft },
  actionText: { color: palette.surface, ...type.label },
  actionTextSecondary: { color: palette.primary },
  actionDanger: { backgroundColor: palette.dangerStrong },
  actionDangerQuiet: { backgroundColor: 'transparent', borderWidth: 1, borderColor: palette.dangerStrong },
  actionTextDanger: { color: palette.dangerStrong },
  actionCompact: { alignSelf: 'flex-start' },

  field: { gap: 6 },
  fieldLabel: { color: palette.ink, ...type.caption, fontWeight: '700' },
  input: { minHeight: 48, borderWidth: 1, borderColor: palette.line, borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: 9, color: palette.ink, backgroundColor: palette.surface, fontSize: 15 },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  feedback: { color: palette.success, ...type.caption, fontWeight: '700' },
  feedbackError: { color: palette.danger },
});
