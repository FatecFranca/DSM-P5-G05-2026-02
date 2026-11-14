import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

// Regras de mensagens sem acesso a banco: quem pode o quê, formato das chaves e contagem de não lidos.
// Ficam aqui para serem testadas isoladamente; o serviço só consulta os dados e aplica estas regras.
//
// Decisões de produto adotadas por padrão (ajustáveis neste arquivo):
//  - Conversam e reagem: ALUNO e PROFESSOR. Tutoria só lê canais. Coordenação e secretaria não usam mensagens.
//  - Só o PROFESSOR publica em canais; ALUNO e PROFESSOR respondem.
//  - Uma conversa nova exige uma turma em andamento em comum entre todos os participantes.
//  - Turma fechada: canais ficam somente leitura.

export const MAX_TEXT = 2000;
export const MAX_GROUP_SIZE = 20;
/** Sem registro de leitura, só mensagens dos últimos dias contam como não lidas. */
export const UNREAD_WINDOW_MS = 30 * 86_400_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const canChat = (perfil: string) =>
  perfil === 'ALUNO' || perfil === 'PROFESSOR';
export const canReadChannels = (perfil: string) =>
  perfil === 'ALUNO' || perfil === 'PROFESSOR' || perfil === 'TUTOR';
export const canPostInChannel = (perfil: string) => perfil === 'PROFESSOR';
export const canReplyInChannel = (perfil: string) =>
  perfil === 'ALUNO' || perfil === 'PROFESSOR';

export function requireChat(perfil: string) {
  if (!canChat(perfil)) throw new ForbiddenException();
}

/** Uma única conversa direta por par de pessoas: a chave não depende de quem começou. */
export const directKey = (a: string, b: string) => [a, b].sort().join(':');

/** Canal da turma ("turmaId:geral") ou de uma disciplina ("turmaId:disciplinaId"). */
export const channelKey = (turmaId: string, disciplinaId: string | null) =>
  `${turmaId}:${disciplinaId ?? 'geral'}`;

export function parseChannelKey(
  key: string,
): { turmaId: string; disciplinaId: string | null } | null {
  const parts = key.split(':');
  if (parts.length !== 2 || !UUID.test(parts[0])) return null;
  if (parts[1] === 'geral') return { turmaId: parts[0], disciplinaId: null };
  return UUID.test(parts[1])
    ? { turmaId: parts[0], disciplinaId: parts[1] }
    : null;
}

export function requireChannelKey(key: string) {
  const parsed = parseChannelKey(key);
  if (!parsed) throw new NotFoundException('Canal não encontrado');
  return parsed;
}

/** Turmas presentes em todos os conjuntos. */
export function commonTurmas(sets: string[][]): string[] {
  if (!sets.length) return [];
  return [...new Set(sets[0])].filter((id) =>
    sets.every((other) => other.includes(id)),
  );
}

/** Texto limpo. Em conversa e resposta, o texto pode faltar se houver anexo; em publicação, não. */
export function cleanText(
  text: string | undefined,
  hasAttachment: boolean,
  textRequired: boolean,
) {
  const value = (text ?? '').trim();
  if (!value && (textRequired || !hasAttachment)) {
    throw new BadRequestException('Escreva uma mensagem antes de enviar');
  }
  if (value.length > MAX_TEXT) {
    throw new BadRequestException(
      `A mensagem deve ter até ${MAX_TEXT} caracteres`,
    );
  }
  return value;
}

/** Remove repetidos e a própria pessoa. Conversa sem outro participante não existe. */
export function normalizeParticipants(actorId: string, ids: string[]) {
  const others = [...new Set(ids)].filter((id) => id !== actorId);
  if (!others.length) {
    throw new BadRequestException('Escolha ao menos uma pessoa para conversar');
  }
  if (others.length + 1 > MAX_GROUP_SIZE) {
    throw new BadRequestException(
      `Um grupo comporta até ${MAX_GROUP_SIZE} pessoas`,
    );
  }
  return others;
}

/** Duas pessoas formam uma conversa direta; três ou mais, um grupo (que exige título). */
export function conversationKind(
  otherCount: number,
  title: string | undefined,
) {
  if (otherCount === 1) return { tipo: 'DIRETA' as const, titulo: null };
  const titulo = (title ?? '').trim();
  if (!titulo) throw new BadRequestException('Informe o título do grupo');
  return { tipo: 'GRUPO' as const, titulo };
}

export function requireSharedOpenTurma(openCommon: string[]) {
  if (!openCommon.length) {
    throw new ForbiddenException(
      'As pessoas precisam participar de uma mesma turma em andamento',
    );
  }
}

// ----------------------------------------------------------------------------- não lidos

export const unreadBaseline = (now: number) => new Date(now - UNREAD_WINDOW_MS);

/** A leitura nunca vale de antes da janela: quem nunca abriu não recebe um número gigante. */
export function effectiveReadAt(lidoAte: Date | null, now: number) {
  const floor = unreadBaseline(now);
  return lidoAte && lidoAte > floor ? lidoAte : floor;
}

export interface ChannelEvent {
  turmaId: string;
  disciplinaId: string | null;
  autorId: string;
  autor: string;
  texto: string;
  anexo: string | null;
  criadaEm: Date;
}

/**
 * Última atividade e não lidas por canal, a partir das publicações e respostas recentes.
 * Só conta o que é de outra pessoa e veio depois da leitura; só olha os canais permitidos.
 */
export function channelActivity(
  events: ChannelEvent[],
  reads: Map<string, Date>,
  allowed: Set<string>,
  viewerId: string,
  now: number,
) {
  const result = new Map<
    string,
    { ultima: ChannelEvent | null; naoLidas: number }
  >();
  for (const key of allowed) result.set(key, { ultima: null, naoLidas: 0 });
  for (const event of events) {
    const key = channelKey(event.turmaId, event.disciplinaId);
    const entry = result.get(key);
    if (!entry) continue;
    if (!entry.ultima || event.criadaEm > entry.ultima.criadaEm) {
      entry.ultima = event;
    }
    if (
      event.autorId !== viewerId &&
      event.criadaEm > effectiveReadAt(reads.get(key) ?? null, now)
    ) {
      entry.naoLidas += 1;
    }
  }
  return result;
}
