// Regras de apresentação do trabalho em turma (tarefas, atividade, não lidos). Sem dependências de
// React nem de rotas, para poderem ser testadas com `node --test`.

const DAY = 86_400_000;

export type AssignmentState = 'assigned' | 'late' | 'submitted' | 'graded';

export interface ActivityLike { estado: 'RASCUNHO' | 'PUBLICADA' | 'ENCERRADA'; prazo: string }
export interface DeliveryLike { corrigidaEm: string | null }

/**
 * Situação da tarefa para o estudante, igual à do Teams: atribuída, atrasada, entregue ou corrigida.
 * Só a correção encerra o ciclo; entrega sem correção continua "enviada, aguardando".
 */
export function assignmentState(activity: ActivityLike, delivery: DeliveryLike | undefined, now: number): AssignmentState {
  if (delivery) return delivery.corrigidaEm ? 'graded' : 'submitted';
  return activity.estado === 'ENCERRADA' || Date.parse(activity.prazo) < now ? 'late' : 'assigned';
}

function startOfDay(ms: number) {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** Diferença em dias de calendário entre `iso` e `now` (positivo = futuro). */
export function dayDiff(iso: string, now: number) {
  return Math.round((startOfDay(Date.parse(iso)) - startOfDay(now)) / DAY);
}

/** "hoje", "amanhã", "ontem", "em 3 dias", "há 2 dias". */
export function relativeDay(iso: string, now: number) {
  const diff = dayDiff(iso, now);
  if (diff === 0) return 'hoje';
  if (diff === 1) return 'amanhã';
  if (diff === -1) return 'ontem';
  return diff > 0 ? `em ${diff} dias` : `há ${-diff} dias`;
}

/** Prazo próximo (hoje ou amanhã) merece destaque; o resto é informação. */
export function isDueSoon(iso: string, now: number) {
  const diff = dayDiff(iso, now);
  return diff === 0 || diff === 1;
}

export type DayGroupKey = 'upcoming' | 'today' | 'yesterday' | 'week' | 'older';
export interface DayGroup<T> { key: DayGroupKey; label: string; items: T[] }

const groupLabels: [DayGroupKey, string][] = [
  ['upcoming', 'Próximos'], ['today', 'Hoje'], ['yesterday', 'Ontem'], ['week', 'Esta semana'], ['older', 'Mais antigas'],
];

function bucket(diff: number): DayGroupKey {
  if (diff > 0) return 'upcoming';
  if (diff === 0) return 'today';
  if (diff === -1) return 'yesterday';
  return diff >= -6 ? 'week' : 'older';
}

/** Agrupa por dia como o feed de Atividade do Teams. Grupos vazios não aparecem. */
export function groupByDay<T extends { data: string }>(items: T[], now: number): DayGroup<T>[] {
  const buckets = new Map<DayGroupKey, T[]>();
  for (const item of items) {
    const key = bucket(dayDiff(item.data, now));
    buckets.set(key, [...(buckets.get(key) ?? []), item]);
  }
  return groupLabels.flatMap(([key, label]) => {
    const list = buckets.get(key);
    if (!list?.length) return [];
    // Futuro: o que vence primeiro vem antes. Passado: o mais recente vem antes.
    const sorted = [...list].sort((a, b) => key === 'upcoming' ? Date.parse(a.data) - Date.parse(b.data) : Date.parse(b.data) - Date.parse(a.data));
    return [{ key, label, items: sorted }];
  });
}

/**
 * Itens novos desde a última visita. Eventos futuros (prazos) nunca contam como novos, e sem
 * registro de visita não há contagem: a primeira abertura não pode começar com um número enorme.
 */
export function unreadItems<T extends { data: string }>(items: T[], lastSeen: string | null, now: number): T[] {
  if (lastSeen === null) return [];
  const seen = Date.parse(lastSeen);
  if (Number.isNaN(seen)) return [];
  return items.filter((item) => {
    const time = Date.parse(item.data);
    return time <= now && time > seen;
  });
}

export interface DeliverySummary { delivered: number; total: number; toGrade: number }

/** Resumo para a docência: quantos entregaram e quantas entregas esperam correção. */
export function deliverySummary(deliveries: { atividadeId: string; corrigidaEm: string | null }[], activityId: string, enrolled: number): DeliverySummary {
  const own = deliveries.filter((delivery) => delivery.atividadeId === activityId);
  return { delivered: own.length, total: enrolled, toGrade: own.filter((delivery) => !delivery.corrigidaEm).length };
}

const honorific = /^(prof|profa|dr|dra|sr|sra)\.?$/i;

/** Iniciais para avatar: primeira e última palavra do nome, sem tratamento ("Profa."), em maiúsculas. */
export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const names = words.filter((word) => !honorific.test(word));
  const used = names.length ? names : words;
  if (!used.length) return '?';
  const first = used[0].charAt(0);
  const last = used.length > 1 ? used[used.length - 1].charAt(0) : '';
  return (first + last).toLocaleUpperCase('pt-BR');
}

/** Tamanho de arquivo legível: "850 B", "120 KB", "1,5 MB". */
export function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

export const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase('pt-BR') + text.slice(1);

/** Horário na lista de conversas: hoje, a hora; ontem, "Ontem"; nesta semana, o dia; antes disso, dd/mm. */
export function listTimeLabel(iso: string, now: number) {
  const diff = dayDiff(iso, now);
  const date = new Date(iso);
  if (diff === 0) return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (diff === -1) return 'Ontem';
  if (diff < 0 && diff > -7) return date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/** Separador de dia dentro de uma conversa: "Hoje", "Ontem" ou "ter., 4 de nov.". */
export function daySeparator(iso: string, now: number) {
  const diff = dayDiff(iso, now);
  if (diff === 0) return 'Hoje';
  if (diff === -1) return 'Ontem';
  return new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
}
