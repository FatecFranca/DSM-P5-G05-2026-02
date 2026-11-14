import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { AuthRequest } from '../auth/auth-user';
import { Roles } from '../common/roles/roles.decorator';
import { Perfil } from '../generated/prisma/enums';
import * as D from './messages.dto';
import { MessagesService } from './messages.service';

// Quem conversa: estudante e docente. Tutoria apenas lê canais. As regras finas estão em messages.policy.ts.
const CHAT = [Perfil.ALUNO, Perfil.PROFESSOR] as const;
const CHANNELS = [Perfil.ALUNO, Perfil.PROFESSOR, Perfil.TUTOR] as const;

@Controller('mensagens')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get('resumo')
  @Roles(...CHANNELS)
  summary(@Req() req: AuthRequest) {
    return this.messages.summary(req.currentUser);
  }

  @Get('contatos')
  @Roles(...CHAT)
  contacts(@Req() req: AuthRequest, @Query() query: D.ContatosQuery) {
    return this.messages.contacts(req.currentUser, query);
  }

  @Get('conversas')
  @Roles(...CHAT)
  conversations(@Req() req: AuthRequest) {
    return this.messages.listConversations(req.currentUser);
  }

  @Post('conversas')
  @Roles(...CHAT)
  createConversation(@Req() req: AuthRequest, @Body() dto: D.CriarConversaDto) {
    return this.messages.createConversation(req.currentUser, dto);
  }

  @Get('conversas/:id')
  @Roles(...CHAT)
  conversation(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.messages.getConversation(req.currentUser, id);
  }

  @Get('conversas/:id/mensagens')
  @Roles(...CHAT)
  listMessages(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: D.PaginaQuery,
  ) {
    return this.messages.listMessages(req.currentUser, id, query);
  }

  @Post('conversas/:id/mensagens')
  @Roles(...CHAT)
  sendMessage(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: D.EnviarMensagemDto,
  ) {
    return this.messages.sendMessage(req.currentUser, id, dto);
  }

  @Put('conversas/:id/leitura')
  @Roles(...CHAT)
  markConversationRead(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.messages.markConversationRead(req.currentUser, id);
  }

  @Get('canais')
  @Roles(...CHANNELS)
  channels(@Req() req: AuthRequest) {
    return this.messages.listChannels(req.currentUser);
  }

  @Get('canais/:canal/publicacoes')
  @Roles(...CHANNELS)
  posts(
    @Req() req: AuthRequest,
    @Param('canal') canal: string,
    @Query() query: D.PaginaQuery,
  ) {
    return this.messages.listPosts(req.currentUser, canal, query);
  }

  @Post('canais/:canal/publicacoes')
  @Roles(Perfil.PROFESSOR)
  createPost(
    @Req() req: AuthRequest,
    @Param('canal') canal: string,
    @Body() dto: D.NovaPublicacaoDto,
  ) {
    return this.messages.createPost(req.currentUser, canal, dto);
  }

  @Put('canais/:canal/leitura')
  @Roles(...CHANNELS)
  markChannelRead(@Req() req: AuthRequest, @Param('canal') canal: string) {
    return this.messages.markChannelRead(req.currentUser, canal);
  }

  @Get('publicacoes/:id')
  @Roles(...CHANNELS)
  thread(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.messages.thread(req.currentUser, id);
  }

  @Post('publicacoes/:id/respostas')
  @Roles(...CHAT)
  reply(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: D.EnviarMensagemDto,
  ) {
    return this.messages.reply(req.currentUser, id, dto);
  }

  @Post('curtidas')
  @Roles(...CHAT)
  like(@Req() req: AuthRequest, @Body() dto: D.CurtidaDto) {
    return this.messages.like(req.currentUser, dto);
  }
}
