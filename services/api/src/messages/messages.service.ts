import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  ContatosQuery,
  CriarConversaDto,
  CurtidaDto,
  EnviarMensagemDto,
  NovaPublicacaoDto,
  PaginaQuery,
} from './messages.dto';
import {
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
  requireChannelKey,
  requireChat,
  requireSharedOpenTurma,
  type ChannelEvent,
} from './messages.policy';
import {
  channelDisciplines,
  channelPostWhere,
  turmaAccess,
} from './messages.scope';

const personSelect = { id: true, nome: true, perfil: true } as const;
const fileSelect = { id: true, nome: true, mime: true, tamanho: true } as const;
/** Quanto do passado a lista de canais olha para montar prévia e não lidas. */
const PREVIEW_WINDOW_MS = 90 * 86_400_000;
const REPLY_LIMIT = 500;

/**
 * Itens anteriores ao cursor na ordem (criadaEm, id) decrescente. O desempate por id evita perder
 * itens que chegaram no mesmo milissegundo do cursor.
 */
const olderThan = (cursor: { id: string; criadaEm: Date }) => ({
  OR: [
    { criadaEm: { lt: cursor.criadaEm } },
    { criadaEm: cursor.criadaEm, id: { lt: cursor.id } },
  ],
});

const likeSelect = (actorId: string) =>
  ({
    _count: { select: { curtidas: true } },
    curtidas: { where: { usuarioId: actorId }, select: { usuarioId: true } },
  }) as const;

@Injectable()
export class MessagesService {
  constructor(private readonly db: PrismaService) {}

  // ----------------------------------------------------------------------- apoio

  private async audit(
    tx: Prisma.TransactionClient,
    actor: AuthUser,
    action: string,
    resourceId: string,
  ) {
    await tx.auditoria.create({
      data: {
        instituicaoId: actor.instituicaoId,
        autorId: actor.id,
        acao: action,
        recurso: 'MENSAGENS',
        recursoId: resourceId,
      },
    });
  }

  /** Turmas de cada pessoa: matrícula para estudante, lotação em alguma disciplina para docente. */
  private async turmasOf(
    instituicaoId: string,
    people: { id: string; perfil: string }[],
  ) {
    const map = new Map<string, string[]>(people.map((p) => [p.id, []]));
    const students = people
      .filter((p) => p.perfil === 'ALUNO')
      .map((p) => p.id);
    const teachers = people
      .filter((p) => p.perfil === 'PROFESSOR')
      .map((p) => p.id);
    const [enrollments, assignments] = await Promise.all([
      students.length
        ? this.db.matricula.findMany({
            where: { instituicaoId, alunoId: { in: students } },
            select: { alunoId: true, turmaId: true },
          })
        : Promise.resolve([]),
      teachers.length
        ? this.db.lotacao.findMany({
            where: { instituicaoId, professorId: { in: teachers } },
            select: {
              professorId: true,
              disciplina: { select: { turmaId: true } },
            },
          })
        : Promise.resolve([]),
    ]);
    for (const e of enrollments) {
      const list = map.get(e.alunoId);
      if (list && !list.includes(e.turmaId)) list.push(e.turmaId);
    }
    for (const a of assignments) {
      const list = map.get(a.professorId);
      const turmaId = a.disciplina.turmaId;
      if (list && !list.includes(turmaId)) list.push(turmaId);
    }
    return map;
  }

  private async attachment(actor: AuthUser, arquivoId?: string) {
    if (!arquivoId) return null;
    const file = await this.db.arquivo.findFirst({
      where: {
        id: arquivoId,
        instituicaoId: actor.instituicaoId,
        autorId: actor.id,
      },
      select: { id: true },
    });
    if (!file) throw new NotFoundException('Arquivo não encontrado');
    return file.id;
  }

  // ------------------------------------------------------------------- conversas

  private async participation(actor: AuthUser, conversaId: string) {
    requireChat(actor.perfil);
    const row = await this.db.conversaParticipante.findFirst({
      where: {
        instituicaoId: actor.instituicaoId,
        conversaId,
        usuarioId: actor.id,
      },
      select: { lidoAte: true },
    });
    if (!row) throw new NotFoundException('Conversa não encontrada');
    return row;
  }

  private conversationSelect() {
    return {
      id: true,
      tipo: true,
      titulo: true,
      criadaEm: true,
      participantes: { select: { usuario: { select: personSelect } } },
      mensagens: {
        orderBy: { criadaEm: 'desc' },
        take: 1,
        select: {
          id: true,
          texto: true,
          criadaEm: true,
          autorId: true,
          autor: { select: { nome: true } },
          arquivo: { select: { nome: true } },
        },
      },
    } as const;
  }

  async listConversations(actor: AuthUser) {
    requireChat(actor.perfil);
    const now = Date.now();
    const rows = await this.db.conversaParticipante.findMany({
      where: { instituicaoId: actor.instituicaoId, usuarioId: actor.id },
      select: {
        lidoAte: true,
        conversa: { select: this.conversationSelect() },
      },
    });
    const unread = await Promise.all(
      rows.map((row) =>
        this.db.mensagem.count({
          where: {
            instituicaoId: actor.instituicaoId,
            conversaId: row.conversa.id,
            autorId: { not: actor.id },
            criadaEm: { gt: effectiveReadAt(row.lidoAte, now) },
          },
        }),
      ),
    );
    return rows
      .map((row, index) => this.conversationView(row.conversa, unread[index]))
      .sort(
        (a, b) =>
          Date.parse(b.ultimaMensagem?.criadaEm ?? b.criadaEm) -
          Date.parse(a.ultimaMensagem?.criadaEm ?? a.criadaEm),
      );
  }

  private conversationView(
    conversa: {
      id: string;
      tipo: string;
      titulo: string | null;
      criadaEm: Date;
      participantes: {
        usuario: { id: string; nome: string; perfil: string };
      }[];
      mensagens: {
        id: string;
        texto: string;
        criadaEm: Date;
        autorId: string;
        autor: { nome: string };
        arquivo: { nome: string } | null;
      }[];
    },
    naoLidas: number,
  ) {
    const last = conversa.mensagens[0];
    return {
      id: conversa.id,
      tipo: conversa.tipo,
      titulo: conversa.titulo,
      criadaEm: conversa.criadaEm.toISOString(),
      participantes: conversa.participantes.map((p) => p.usuario),
      ultimaMensagem: last
        ? {
            id: last.id,
            autorId: last.autorId,
            autor: last.autor.nome,
            texto: last.texto,
            arquivo: last.arquivo?.nome ?? null,
            criadaEm: last.criadaEm.toISOString(),
          }
        : null,
      naoLidas,
    };
  }

  private async conversationById(actor: AuthUser, id: string) {
    const row = await this.db.conversaParticipante.findFirst({
      where: {
        instituicaoId: actor.instituicaoId,
        conversaId: id,
        usuarioId: actor.id,
      },
      select: {
        lidoAte: true,
        conversa: { select: this.conversationSelect() },
      },
    });
    if (!row) throw new NotFoundException('Conversa não encontrada');
    const unread = await this.db.mensagem.count({
      where: {
        instituicaoId: actor.instituicaoId,
        conversaId: id,
        autorId: { not: actor.id },
        criadaEm: { gt: effectiveReadAt(row.lidoAte, Date.now()) },
      },
    });
    return this.conversationView(row.conversa, unread);
  }

  async getConversation(actor: AuthUser, id: string) {
    requireChat(actor.perfil);
    return this.conversationById(actor, id);
  }

  async createConversation(actor: AuthUser, dto: CriarConversaDto) {
    requireChat(actor.perfil);
    const others = normalizeParticipants(actor.id, dto.participanteIds);
    const kind = conversationKind(others.length, dto.titulo);
    const users = await this.db.usuario.findMany({
      where: {
        instituicaoId: actor.instituicaoId,
        id: { in: others },
        ativo: true,
        perfil: { in: ['ALUNO', 'PROFESSOR'] },
      },
      select: personSelect,
    });
    if (users.length !== others.length) {
      throw new NotFoundException('Pessoa não encontrada');
    }
    const turmas = await this.turmasOf(actor.instituicaoId, [
      { id: actor.id, perfil: actor.perfil },
      ...users,
    ]);
    const common = commonTurmas([...turmas.values()]);
    const open = common.length
      ? await this.db.turma.findMany({
          where: {
            instituicaoId: actor.instituicaoId,
            id: { in: common },
            fechada: false,
          },
          select: { id: true },
        })
      : [];
    requireSharedOpenTurma(open.map((t) => t.id));

    const chave =
      kind.tipo === 'DIRETA' ? directKey(actor.id, others[0]) : null;
    const existing = chave
      ? await this.db.conversa.findUnique({
          where: {
            instituicaoId_chaveDireta: {
              instituicaoId: actor.instituicaoId,
              chaveDireta: chave,
            },
          },
          select: { id: true },
        })
      : null;
    if (existing) return this.conversationById(actor, existing.id);

    try {
      const created = await this.db.$transaction(async (tx) => {
        const conversa = await tx.conversa.create({
          data: {
            instituicaoId: actor.instituicaoId,
            tipo: kind.tipo,
            titulo: kind.titulo,
            chaveDireta: chave,
            criadaPorId: actor.id,
          },
          select: { id: true },
        });
        await tx.conversaParticipante.createMany({
          data: [actor.id, ...others].map((usuarioId) => ({
            instituicaoId: actor.instituicaoId,
            conversaId: conversa.id,
            usuarioId,
          })),
        });
        await this.audit(tx, actor, 'CRIAR_CONVERSA', conversa.id);
        return conversa;
      });
      return await this.conversationById(actor, created.id);
    } catch (error) {
      // Duas pessoas abrindo a mesma conversa direta ao mesmo tempo: a segunda recebe a primeira.
      if (
        chave &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raced = await this.db.conversa.findUnique({
          where: {
            instituicaoId_chaveDireta: {
              instituicaoId: actor.instituicaoId,
              chaveDireta: chave,
            },
          },
          select: { id: true },
        });
        if (raced) return this.conversationById(actor, raced.id);
      }
      throw error;
    }
  }

  private messageSelect(actorId: string) {
    return {
      id: true,
      conversaId: true,
      autorId: true,
      texto: true,
      criadaEm: true,
      autor: { select: { nome: true } },
      arquivo: { select: fileSelect },
      ...likeSelect(actorId),
    } as const;
  }

  private messageView(m: {
    id: string;
    conversaId: string;
    autorId: string;
    texto: string;
    criadaEm: Date;
    autor: { nome: string };
    arquivo: { id: string; nome: string; mime: string; tamanho: number } | null;
    _count: { curtidas: number };
    curtidas: { usuarioId: string }[];
  }) {
    return {
      id: m.id,
      conversaId: m.conversaId,
      autorId: m.autorId,
      autor: m.autor.nome,
      texto: m.texto,
      arquivo: m.arquivo,
      criadaEm: m.criadaEm.toISOString(),
      curtidas: m._count.curtidas,
      curtidaPorMim: m.curtidas.length > 0,
    };
  }

  /** Mensagens em ordem cronológica; `antes` carrega as mais antigas. */
  async listMessages(actor: AuthUser, conversaId: string, query: PaginaQuery) {
    await this.participation(actor, conversaId);
    const cursor = query.antes
      ? await this.db.mensagem.findFirst({
          where: {
            id: query.antes,
            instituicaoId: actor.instituicaoId,
            conversaId,
          },
          select: { id: true, criadaEm: true },
        })
      : null;
    if (query.antes && !cursor)
      throw new BadRequestException('Cursor inválido');
    const rows = await this.db.mensagem.findMany({
      where: {
        instituicaoId: actor.instituicaoId,
        conversaId,
        ...(cursor ? olderThan(cursor) : {}),
      },
      orderBy: [{ criadaEm: 'desc' }, { id: 'desc' }],
      take: query.limite + 1,
      select: this.messageSelect(actor.id),
    });
    const hasMore = rows.length > query.limite;
    return {
      itens: rows
        .slice(0, query.limite)
        .reverse()
        .map((row) => this.messageView(row)),
      temMais: hasMore,
    };
  }

  async sendMessage(
    actor: AuthUser,
    conversaId: string,
    dto: EnviarMensagemDto,
  ) {
    await this.participation(actor, conversaId);
    const arquivoId = await this.attachment(actor, dto.arquivoId);
    const texto = cleanText(dto.texto, arquivoId !== null, false);
    const now = new Date();
    const created = await this.db.$transaction(async (tx) => {
      const message = await tx.mensagem.create({
        data: {
          instituicaoId: actor.instituicaoId,
          conversaId,
          autorId: actor.id,
          texto,
          arquivoId,
          criadaEm: now,
        },
        select: this.messageSelect(actor.id),
      });
      // Quem escreve já leu até aqui.
      await tx.conversaParticipante.update({
        where: {
          instituicaoId_conversaId_usuarioId: {
            instituicaoId: actor.instituicaoId,
            conversaId,
            usuarioId: actor.id,
          },
        },
        data: { lidoAte: now },
      });
      return message;
    });
    return this.messageView(created);
  }

  async markConversationRead(actor: AuthUser, conversaId: string) {
    await this.participation(actor, conversaId);
    const lidoAte = new Date();
    await this.db.conversaParticipante.update({
      where: {
        instituicaoId_conversaId_usuarioId: {
          instituicaoId: actor.instituicaoId,
          conversaId,
          usuarioId: actor.id,
        },
      },
      data: { lidoAte },
    });
    return { lidoAte: lidoAte.toISOString() };
  }

  // -------------------------------------------------------------------- contatos

  /** Pessoas com quem se pode começar uma conversa: quem divide uma turma com você. */
  async contacts(actor: AuthUser, query: ContatosQuery) {
    requireChat(actor.perfil);
    const mine = await this.turmasOf(actor.instituicaoId, [
      { id: actor.id, perfil: actor.perfil },
    ]);
    const myTurmas = mine.get(actor.id) ?? [];
    if (!myTurmas.length) return [];
    const name = query.q
      ? { nome: { contains: query.q, mode: 'insensitive' as const } }
      : {};
    const base = {
      instituicaoId: actor.instituicaoId,
      ativo: true,
      id: { not: actor.id },
      ...name,
    };
    const [students, teachers] = await Promise.all([
      this.db.usuario.findMany({
        where: {
          ...base,
          perfil: 'ALUNO',
          matriculas: { some: { turmaId: { in: myTurmas } } },
        },
        select: {
          ...personSelect,
          matriculas: {
            where: { turmaId: { in: myTurmas } },
            select: { turma: { select: { nome: true } } },
          },
        },
        orderBy: { nome: 'asc' },
        take: 100,
      }),
      this.db.usuario.findMany({
        where: {
          ...base,
          perfil: 'PROFESSOR',
          lotacoes: {
            some: { disciplina: { turmaId: { in: myTurmas } } },
          },
        },
        select: {
          ...personSelect,
          lotacoes: {
            where: { disciplina: { turmaId: { in: myTurmas } } },
            select: {
              disciplina: { select: { turma: { select: { nome: true } } } },
            },
          },
        },
        orderBy: { nome: 'asc' },
        take: 100,
      }),
    ]);
    const people = [
      ...students.map((s) => ({
        id: s.id,
        nome: s.nome,
        perfil: s.perfil,
        turmas: [...new Set(s.matriculas.map((m) => m.turma.nome))],
      })),
      ...teachers.map((t) => ({
        id: t.id,
        nome: t.nome,
        perfil: t.perfil,
        turmas: [...new Set(t.lotacoes.map((l) => l.disciplina.turma.nome))],
      })),
    ];
    return people
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .slice(0, 100);
  }

  // ---------------------------------------------------------------------- canais

  private async channelContext(actor: AuthUser, canal: string) {
    const key = requireChannelKey(canal);
    const access = canReadChannels(actor.perfil) ? turmaAccess(actor) : null;
    if (!access) throw new ForbiddenException();
    const turma = await this.db.turma.findFirst({
      where: { id: key.turmaId, instituicaoId: actor.instituicaoId, ...access },
      select: { id: true, nome: true, fechada: true },
    });
    if (!turma) throw new NotFoundException('Canal não encontrado');
    let disciplina: { id: string; nome: string } | null = null;
    if (key.disciplinaId) {
      disciplina = await this.db.disciplina.findFirst({
        where: {
          id: key.disciplinaId,
          turmaId: turma.id,
          instituicaoId: actor.instituicaoId,
          ...channelDisciplines(actor),
        },
        select: { id: true, nome: true },
      });
      if (!disciplina) throw new NotFoundException('Canal não encontrado');
    }
    return {
      turma,
      disciplina,
      key: channelKey(turma.id, disciplina?.id ?? null),
      canPost: canPostInChannel(actor.perfil) && !turma.fechada,
      canReply: canReplyInChannel(actor.perfil) && !turma.fechada,
    };
  }

  async listChannels(actor: AuthUser) {
    const access = canReadChannels(actor.perfil) ? turmaAccess(actor) : null;
    if (!access) throw new ForbiddenException();
    const now = Date.now();
    const turmas = await this.db.turma.findMany({
      where: { instituicaoId: actor.instituicaoId, ...access },
      orderBy: [{ nome: 'asc' }],
      select: {
        id: true,
        nome: true,
        curso: true,
        fechada: true,
        disciplinas: {
          where: channelDisciplines(actor),
          orderBy: { nome: 'asc' },
          select: { id: true, nome: true },
        },
      },
    });
    if (!turmas.length) return [];
    const turmaIds = turmas.map((t) => t.id);
    const since = new Date(now - PREVIEW_WINDOW_MS);
    const [posts, replies, readRows] = await Promise.all([
      this.db.publicacao.findMany({
        where: {
          instituicaoId: actor.instituicaoId,
          turmaId: { in: turmaIds },
          criadaEm: { gte: since },
        },
        orderBy: { criadaEm: 'desc' },
        take: 1000,
        select: {
          turmaId: true,
          disciplinaId: true,
          autorId: true,
          texto: true,
          criadaEm: true,
          autor: { select: { nome: true } },
          arquivo: { select: { nome: true } },
        },
      }),
      this.db.respostaPublicacao.findMany({
        where: {
          instituicaoId: actor.instituicaoId,
          criadaEm: { gte: since },
          publicacao: { turmaId: { in: turmaIds } },
        },
        orderBy: { criadaEm: 'desc' },
        take: 1000,
        select: {
          autorId: true,
          texto: true,
          criadaEm: true,
          autor: { select: { nome: true } },
          arquivo: { select: { nome: true } },
          publicacao: { select: { turmaId: true, disciplinaId: true } },
        },
      }),
      this.db.leituraCanal.findMany({
        where: { instituicaoId: actor.instituicaoId, usuarioId: actor.id },
        select: { canal: true, lidoAte: true },
      }),
    ]);
    const events: ChannelEvent[] = [
      ...posts.map((p) => ({
        turmaId: p.turmaId,
        disciplinaId: p.disciplinaId,
        autorId: p.autorId,
        autor: p.autor.nome,
        texto: p.texto,
        anexo: p.arquivo?.nome ?? null,
        criadaEm: p.criadaEm,
      })),
      ...replies.map((r) => ({
        turmaId: r.publicacao.turmaId,
        disciplinaId: r.publicacao.disciplinaId,
        autorId: r.autorId,
        autor: r.autor.nome,
        texto: r.texto,
        anexo: r.arquivo?.nome ?? null,
        criadaEm: r.criadaEm,
      })),
    ];
    const allowed = new Set(
      turmas.flatMap((t) => [
        channelKey(t.id, null),
        ...t.disciplinas.map((d) => channelKey(t.id, d.id)),
      ]),
    );
    const activity = channelActivity(
      events,
      new Map(readRows.map((r) => [r.canal, r.lidoAte])),
      allowed,
      actor.id,
      now,
    );
    const canPostHere = (fechada: boolean) =>
      canPostInChannel(actor.perfil) && !fechada;
    return turmas.flatMap((t) =>
      [{ id: null, nome: 'Geral' }, ...t.disciplinas].map((d) => {
        const key = channelKey(t.id, d.id);
        const info = activity.get(key);
        return {
          id: key,
          turmaId: t.id,
          turma: t.nome,
          curso: t.curso,
          disciplinaId: d.id,
          nome: d.nome,
          ultima: info?.ultima
            ? {
                autor: info.ultima.autor,
                texto:
                  info.ultima.texto ||
                  (info.ultima.anexo ? `Anexo: ${info.ultima.anexo}` : ''),
                criadaEm: info.ultima.criadaEm.toISOString(),
              }
            : null,
          naoLidas: info?.naoLidas ?? 0,
          podePublicar: canPostHere(t.fechada),
        };
      }),
    );
  }

  private postSelect(actorId: string) {
    return {
      id: true,
      turmaId: true,
      disciplinaId: true,
      autorId: true,
      texto: true,
      importante: true,
      criadaEm: true,
      autor: { select: personSelect },
      arquivo: { select: fileSelect },
      _count: { select: { respostas: true, curtidas: true } },
      curtidas: { where: { usuarioId: actorId }, select: { usuarioId: true } },
    } as const;
  }

  private postView(p: {
    id: string;
    turmaId: string;
    disciplinaId: string | null;
    autorId: string;
    texto: string;
    importante: boolean;
    criadaEm: Date;
    autor: { id: string; nome: string; perfil: string };
    arquivo: { id: string; nome: string; mime: string; tamanho: number } | null;
    _count: { respostas: number; curtidas: number };
    curtidas: { usuarioId: string }[];
  }) {
    return {
      id: p.id,
      canal: channelKey(p.turmaId, p.disciplinaId),
      turmaId: p.turmaId,
      disciplinaId: p.disciplinaId,
      autorId: p.autorId,
      autor: p.autor.nome,
      perfilAutor: p.autor.perfil,
      texto: p.texto,
      importante: p.importante,
      arquivo: p.arquivo,
      criadaEm: p.criadaEm.toISOString(),
      curtidas: p._count.curtidas,
      curtidaPorMim: p.curtidas.length > 0,
      respostas: p._count.respostas,
    };
  }

  async listPosts(actor: AuthUser, canal: string, query: PaginaQuery) {
    const ctx = await this.channelContext(actor, canal);
    const cursor = query.antes
      ? await this.db.publicacao.findFirst({
          where: {
            id: query.antes,
            instituicaoId: actor.instituicaoId,
            turmaId: ctx.turma.id,
            disciplinaId: ctx.disciplina?.id ?? null,
          },
          select: { id: true, criadaEm: true },
        })
      : null;
    if (query.antes && !cursor)
      throw new BadRequestException('Cursor inválido');
    const rows = await this.db.publicacao.findMany({
      where: {
        instituicaoId: actor.instituicaoId,
        turmaId: ctx.turma.id,
        disciplinaId: ctx.disciplina?.id ?? null,
        ...(cursor ? olderThan(cursor) : {}),
      },
      orderBy: [{ criadaEm: 'desc' }, { id: 'desc' }],
      take: query.limite + 1,
      select: this.postSelect(actor.id),
    });
    return {
      canal: ctx.key,
      podePublicar: ctx.canPost,
      podeResponder: ctx.canReply,
      itens: rows
        .slice(0, query.limite)
        .reverse()
        .map((row) => this.postView(row)),
      temMais: rows.length > query.limite,
    };
  }

  async createPost(actor: AuthUser, canal: string, dto: NovaPublicacaoDto) {
    const ctx = await this.channelContext(actor, canal);
    if (!ctx.canPost) {
      throw new ForbiddenException(
        ctx.turma.fechada
          ? 'Período da turma fechado'
          : 'Somente docentes lotados publicam no canal',
      );
    }
    const arquivoId = await this.attachment(actor, dto.arquivoId);
    const texto = cleanText(dto.texto, arquivoId !== null, true);
    const created = await this.db.$transaction(async (tx) => {
      const post = await tx.publicacao.create({
        data: {
          instituicaoId: actor.instituicaoId,
          turmaId: ctx.turma.id,
          disciplinaId: ctx.disciplina?.id ?? null,
          autorId: actor.id,
          texto,
          importante: dto.importante === true,
          arquivoId,
        },
        select: this.postSelect(actor.id),
      });
      await tx.leituraCanal.upsert({
        where: {
          instituicaoId_usuarioId_canal: {
            instituicaoId: actor.instituicaoId,
            usuarioId: actor.id,
            canal: ctx.key,
          },
        },
        create: {
          instituicaoId: actor.instituicaoId,
          usuarioId: actor.id,
          canal: ctx.key,
          lidoAte: post.criadaEm,
        },
        update: { lidoAte: post.criadaEm },
      });
      await this.audit(tx, actor, 'PUBLICAR_CANAL', post.id);
      return post;
    });
    return this.postView(created);
  }

  async markChannelRead(actor: AuthUser, canal: string) {
    const ctx = await this.channelContext(actor, canal);
    const lidoAte = new Date();
    await this.db.leituraCanal.upsert({
      where: {
        instituicaoId_usuarioId_canal: {
          instituicaoId: actor.instituicaoId,
          usuarioId: actor.id,
          canal: ctx.key,
        },
      },
      create: {
        instituicaoId: actor.instituicaoId,
        usuarioId: actor.id,
        canal: ctx.key,
        lidoAte,
      },
      update: { lidoAte },
    });
    return { lidoAte: lidoAte.toISOString() };
  }

  private replySelect(actorId: string) {
    return {
      id: true,
      publicacaoId: true,
      autorId: true,
      texto: true,
      criadaEm: true,
      autor: { select: personSelect },
      arquivo: { select: fileSelect },
      ...likeSelect(actorId),
    } as const;
  }

  private replyView(r: {
    id: string;
    publicacaoId: string;
    autorId: string;
    texto: string;
    criadaEm: Date;
    autor: { id: string; nome: string; perfil: string };
    arquivo: { id: string; nome: string; mime: string; tamanho: number } | null;
    _count: { curtidas: number };
    curtidas: { usuarioId: string }[];
  }) {
    return {
      id: r.id,
      publicacaoId: r.publicacaoId,
      autorId: r.autorId,
      autor: r.autor.nome,
      perfilAutor: r.autor.perfil,
      texto: r.texto,
      arquivo: r.arquivo,
      criadaEm: r.criadaEm.toISOString(),
      curtidas: r._count.curtidas,
      curtidaPorMim: r.curtidas.length > 0,
    };
  }

  /** Quem pode ver uma publicação, e se pode responder (turma aberta e perfil que responde). */
  private async visiblePost(actor: AuthUser, id: string) {
    const where = channelPostWhere(actor);
    if (!where || !canReadChannels(actor.perfil)) {
      throw new ForbiddenException();
    }
    const post = await this.db.publicacao.findFirst({
      where: { ...where, id },
      select: {
        id: true,
        turma: { select: { fechada: true } },
      },
    });
    if (!post) throw new NotFoundException('Publicação não encontrada');
    return {
      id: post.id,
      canReply: canReplyInChannel(actor.perfil) && !post.turma.fechada,
    };
  }

  async thread(actor: AuthUser, id: string) {
    const visible = await this.visiblePost(actor, id);
    const [post, replies] = await Promise.all([
      this.db.publicacao.findFirstOrThrow({
        where: { id, instituicaoId: actor.instituicaoId },
        select: this.postSelect(actor.id),
      }),
      this.db.respostaPublicacao.findMany({
        where: { instituicaoId: actor.instituicaoId, publicacaoId: id },
        orderBy: [{ criadaEm: 'asc' }, { id: 'asc' }],
        take: REPLY_LIMIT,
        select: this.replySelect(actor.id),
      }),
    ]);
    return {
      publicacao: this.postView(post),
      podeResponder: visible.canReply,
      respostas: replies.map((reply) => this.replyView(reply)),
    };
  }

  async reply(actor: AuthUser, id: string, dto: EnviarMensagemDto) {
    const visible = await this.visiblePost(actor, id);
    if (!visible.canReply) {
      throw new ForbiddenException('Você não pode responder a esta publicação');
    }
    const arquivoId = await this.attachment(actor, dto.arquivoId);
    const texto = cleanText(dto.texto, arquivoId !== null, false);
    const created = await this.db.respostaPublicacao.create({
      data: {
        instituicaoId: actor.instituicaoId,
        publicacaoId: id,
        autorId: actor.id,
        texto,
        arquivoId,
      },
      select: this.replySelect(actor.id),
    });
    return this.replyView(created);
  }

  // ---------------------------------------------------------------------- curtidas

  async like(actor: AuthUser, dto: CurtidaDto) {
    requireChat(actor.perfil);
    const tenant = actor.instituicaoId;
    if (dto.tipo === 'MENSAGEM') {
      const found = await this.db.mensagem.findFirst({
        where: {
          id: dto.id,
          instituicaoId: tenant,
          conversa: { participantes: { some: { usuarioId: actor.id } } },
        },
        select: { id: true },
      });
      if (!found) throw new NotFoundException('Mensagem não encontrada');
      return this.db.$transaction(async (tx) => {
        const removed = await tx.curtidaMensagem.deleteMany({
          where: {
            instituicaoId: tenant,
            mensagemId: dto.id,
            usuarioId: actor.id,
          },
        });
        if (!removed.count) {
          await tx.curtidaMensagem.create({
            data: {
              instituicaoId: tenant,
              mensagemId: dto.id,
              usuarioId: actor.id,
            },
          });
        }
        const total = await tx.curtidaMensagem.count({
          where: { instituicaoId: tenant, mensagemId: dto.id },
        });
        return { curtidas: total, curtidaPorMim: !removed.count };
      });
    }
    const where = channelPostWhere(actor);
    if (!where) throw new ForbiddenException();
    if (dto.tipo === 'PUBLICACAO') {
      const found = await this.db.publicacao.findFirst({
        where: { ...where, id: dto.id },
        select: { id: true },
      });
      if (!found) throw new NotFoundException('Publicação não encontrada');
      return this.db.$transaction(async (tx) => {
        const removed = await tx.curtidaPublicacao.deleteMany({
          where: {
            instituicaoId: tenant,
            publicacaoId: dto.id,
            usuarioId: actor.id,
          },
        });
        if (!removed.count) {
          await tx.curtidaPublicacao.create({
            data: {
              instituicaoId: tenant,
              publicacaoId: dto.id,
              usuarioId: actor.id,
            },
          });
        }
        const total = await tx.curtidaPublicacao.count({
          where: { instituicaoId: tenant, publicacaoId: dto.id },
        });
        return { curtidas: total, curtidaPorMim: !removed.count };
      });
    }
    const found = await this.db.respostaPublicacao.findFirst({
      where: { id: dto.id, instituicaoId: tenant, publicacao: where },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Resposta não encontrada');
    return this.db.$transaction(async (tx) => {
      const removed = await tx.curtidaResposta.deleteMany({
        where: {
          instituicaoId: tenant,
          respostaId: dto.id,
          usuarioId: actor.id,
        },
      });
      if (!removed.count) {
        await tx.curtidaResposta.create({
          data: {
            instituicaoId: tenant,
            respostaId: dto.id,
            usuarioId: actor.id,
          },
        });
      }
      const total = await tx.curtidaResposta.count({
        where: { instituicaoId: tenant, respostaId: dto.id },
      });
      return { curtidas: total, curtidaPorMim: !removed.count };
    });
  }

  // ----------------------------------------------------------------------- resumo

  /** Total de não lidas para o selo da aba: canais e conversas somados. */
  async summary(actor: AuthUser) {
    if (!canReadChannels(actor.perfil)) throw new ForbiddenException();
    const [channels, conversations] = await Promise.all([
      this.listChannels(actor),
      canChat(actor.perfil)
        ? this.listConversations(actor)
        : Promise.resolve([]),
    ]);
    const canais = channels.reduce((sum, c) => sum + c.naoLidas, 0);
    const conversas = conversations.reduce((sum, c) => sum + c.naoLidas, 0);
    return { naoLidas: canais + conversas, canais, conversas };
  }
}
