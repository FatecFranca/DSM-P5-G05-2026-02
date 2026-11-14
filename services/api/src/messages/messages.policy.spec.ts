import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  MAX_GROUP_SIZE,
  MAX_TEXT,
  UNREAD_WINDOW_MS,
  canChat,
  canPostInChannel,
  canReadChannels,
  canReplyInChannel,
  channelActivity,
  channelKey,
  cleanText,
  commonTurmas,
  conversationKind,
  directKey,
  effectiveReadAt,
  normalizeParticipants,
  parseChannelKey,
  requireChannelKey,
  requireChat,
  requireSharedOpenTurma,
  type ChannelEvent,
} from './messages.policy';

const TURMA = '11111111-1111-4111-8111-111111111111';
const DISC = '22222222-2222-4222-8222-222222222222';
const NOW = Date.parse('2026-11-08T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000);

function event(over: Partial<ChannelEvent> = {}): ChannelEvent {
  return {
    turmaId: TURMA,
    disciplinaId: null,
    autorId: 'outra-pessoa',
    autor: 'Outra Pessoa',
    texto: 'Olá',
    anexo: null,
    criadaEm: hoursAgo(1),
    ...over,
  };
}

describe('perfis nas mensagens', () => {
  it('estudante e docente conversam; tutoria só lê canais; gestão não participa', () => {
    expect(canChat('ALUNO')).toBe(true);
    expect(canChat('PROFESSOR')).toBe(true);
    expect(canChat('TUTOR')).toBe(false);
    expect(canChat('COORDENACAO')).toBe(false);
    expect(canChat('SECRETARIA')).toBe(false);
    expect(canReadChannels('TUTOR')).toBe(true);
    expect(canReadChannels('COORDENACAO')).toBe(false);
  });

  it('só o docente publica; estudante e docente respondem; tutoria não', () => {
    expect(canPostInChannel('PROFESSOR')).toBe(true);
    expect(canPostInChannel('ALUNO')).toBe(false);
    expect(canPostInChannel('TUTOR')).toBe(false);
    expect(canReplyInChannel('ALUNO')).toBe(true);
    expect(canReplyInChannel('PROFESSOR')).toBe(true);
    expect(canReplyInChannel('TUTOR')).toBe(false);
  });

  it('requireChat recusa quem não conversa', () => {
    expect(() => requireChat('ALUNO')).not.toThrow();
    expect(() => requireChat('TUTOR')).toThrow(ForbiddenException);
  });
});

describe('chaves', () => {
  it('a chave da conversa direta não depende de quem começou', () => {
    expect(directKey('b', 'a')).toBe(directKey('a', 'b'));
    expect(directKey('a', 'b')).toBe('a:b');
  });

  it('canal da turma e de disciplina fazem ida e volta', () => {
    expect(channelKey(TURMA, null)).toBe(`${TURMA}:geral`);
    expect(parseChannelKey(`${TURMA}:geral`)).toEqual({
      turmaId: TURMA,
      disciplinaId: null,
    });
    expect(parseChannelKey(channelKey(TURMA, DISC))).toEqual({
      turmaId: TURMA,
      disciplinaId: DISC,
    });
  });

  it('chave malformada vira "não encontrado" em vez de chegar ao banco', () => {
    for (const bad of [
      '',
      'geral',
      `${TURMA}`,
      `${TURMA}:x`,
      'a:b:c',
      `${TURMA}:${DISC}:x`,
    ]) {
      expect(parseChannelKey(bad)).toBeNull();
    }
    expect(() => requireChannelKey('lixo')).toThrow(NotFoundException);
  });
});

describe('turmas em comum', () => {
  it('interseção de todos os conjuntos', () => {
    expect(commonTurmas([['a', 'b'], ['b', 'c'], ['b']])).toEqual(['b']);
    expect(commonTurmas([['a'], ['b']])).toEqual([]);
    expect(commonTurmas([])).toEqual([]);
  });

  it('exige ao menos uma turma em comum em andamento', () => {
    expect(() => requireSharedOpenTurma(['a'])).not.toThrow();
    expect(() => requireSharedOpenTurma([])).toThrow(ForbiddenException);
  });
});

describe('texto', () => {
  it('apara espaços e rejeita vazio', () => {
    expect(cleanText('  oi  ', false, false)).toBe('oi');
    expect(() => cleanText('   ', false, false)).toThrow(BadRequestException);
    expect(() => cleanText(undefined, false, false)).toThrow(
      BadRequestException,
    );
  });

  it('conversa e resposta aceitam só anexo; publicação exige texto', () => {
    expect(cleanText(undefined, true, false)).toBe('');
    expect(() => cleanText('', true, true)).toThrow(BadRequestException);
  });

  it('limita o tamanho', () => {
    expect(cleanText('x'.repeat(MAX_TEXT), false, false)).toHaveLength(
      MAX_TEXT,
    );
    expect(() => cleanText('x'.repeat(MAX_TEXT + 1), false, false)).toThrow(
      BadRequestException,
    );
  });
});

describe('participantes', () => {
  it('remove repetidos e a própria pessoa', () => {
    expect(normalizeParticipants('eu', ['a', 'a', 'eu', 'b'])).toEqual([
      'a',
      'b',
    ]);
  });

  it('não existe conversa sem outra pessoa', () => {
    expect(() => normalizeParticipants('eu', ['eu'])).toThrow(
      BadRequestException,
    );
    expect(() => normalizeParticipants('eu', [])).toThrow(BadRequestException);
  });

  it('respeita o tamanho máximo do grupo (contando quem cria)', () => {
    const ok = Array.from({ length: MAX_GROUP_SIZE - 1 }, (_, i) => `p${i}`);
    expect(normalizeParticipants('eu', ok)).toHaveLength(MAX_GROUP_SIZE - 1);
    expect(() => normalizeParticipants('eu', [...ok, 'extra'])).toThrow(
      BadRequestException,
    );
  });

  it('um outro participante é conversa direta; mais de um é grupo e exige título', () => {
    expect(conversationKind(1, undefined)).toEqual({
      tipo: 'DIRETA',
      titulo: null,
    });
    expect(conversationKind(1, 'ignorado')).toEqual({
      tipo: 'DIRETA',
      titulo: null,
    });
    expect(conversationKind(2, '  Grupo de estudo ')).toEqual({
      tipo: 'GRUPO',
      titulo: 'Grupo de estudo',
    });
    expect(() => conversationKind(2, '  ')).toThrow(BadRequestException);
    expect(() => conversationKind(3, undefined)).toThrow(BadRequestException);
  });
});

describe('não lidos', () => {
  it('a leitura nunca vale de antes da janela', () => {
    const floor = new Date(NOW - UNREAD_WINDOW_MS);
    expect(effectiveReadAt(null, NOW)).toEqual(floor);
    expect(effectiveReadAt(new Date(NOW - 2 * UNREAD_WINDOW_MS), NOW)).toEqual(
      floor,
    );
    const recent = hoursAgo(3);
    expect(effectiveReadAt(recent, NOW)).toEqual(recent);
  });

  const allowed = new Set([channelKey(TURMA, null), channelKey(TURMA, DISC)]);
  const run = (events: ChannelEvent[], reads = new Map<string, Date>()) =>
    channelActivity(events, reads, allowed, 'eu', NOW);

  it('todo canal permitido aparece, mesmo sem atividade', () => {
    const result = run([]);
    expect([...result.keys()].sort()).toEqual([...allowed].sort());
    expect(result.get(channelKey(TURMA, null))).toEqual({
      ultima: null,
      naoLidas: 0,
    });
  });

  it('conta o que é de outras pessoas depois da leitura e guarda a última', () => {
    const result = run(
      [
        event({ criadaEm: hoursAgo(10), texto: 'antiga' }),
        event({ criadaEm: hoursAgo(2), texto: 'recente' }),
        event({ criadaEm: hoursAgo(1), autorId: 'eu', texto: 'minha' }),
      ],
      new Map([[channelKey(TURMA, null), hoursAgo(5)]]),
    );
    const info = result.get(channelKey(TURMA, null));
    expect(info?.naoLidas).toBe(1);
    expect(info?.ultima?.texto).toBe('minha');
  });

  it('sem registro de leitura, conta só a janela recente', () => {
    const result = run([
      event({ criadaEm: new Date(NOW - UNREAD_WINDOW_MS - 3_600_000) }),
      event({ criadaEm: hoursAgo(1) }),
    ]);
    expect(result.get(channelKey(TURMA, null))?.naoLidas).toBe(1);
  });

  it('cada canal conta separado e canal não permitido é ignorado', () => {
    const result = run([
      event({ disciplinaId: DISC }),
      event({ disciplinaId: DISC }),
      event(),
      event({ turmaId: '33333333-3333-4333-8333-333333333333' }),
    ]);
    expect(result.get(channelKey(TURMA, DISC))?.naoLidas).toBe(2);
    expect(result.get(channelKey(TURMA, null))?.naoLidas).toBe(1);
    expect(result.size).toBe(2);
  });
});
