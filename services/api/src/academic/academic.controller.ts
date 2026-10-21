import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { AuthRequest } from '../auth/auth-user';
import { Roles } from '../common/roles/roles.decorator';
import { Perfil } from '../generated/prisma/enums';
import { AcademicService } from './academic.service';
import * as D from './academic.dto';
import { FeedsService } from './feeds.service';

@Controller()
export class AcademicController {
  constructor(
    private readonly academic: AcademicService,
    private readonly feeds: FeedsService,
  ) {}

  @Get('academico/calendario')
  calendar(@Req() req: AuthRequest, @Query() query: D.CalendarioQuery) {
    return this.feeds.calendar(req.currentUser, query);
  }

  @Get('academico/avisos')
  notices(@Req() req: AuthRequest, @Query() query: D.FeedQuery) {
    return this.feeds.notices(req.currentUser, query);
  }

  @Get('academico/resumo')
  summary(@Req() req: AuthRequest, @Query() query: D.ResumoQuery) {
    return this.academic.snapshot(req.currentUser, query.turmaId);
  }
  @Get('turmas')
  classes(@Req() req: AuthRequest) {
    return this.academic.classes(req.currentUser);
  }
  @Post('turmas')
  @Roles(Perfil.ADMIN)
  createClass(@Req() req: AuthRequest, @Body() dto: D.TurmaDto) {
    return this.academic.createClass(req.currentUser, dto);
  }
  @Post('disciplinas')
  @Roles(Perfil.ADMIN)
  createSubject(@Req() req: AuthRequest, @Body() dto: D.DisciplinaDto) {
    return this.academic.createSubject(req.currentUser, dto);
  }
  @Post('matriculas')
  @Roles(Perfil.ADMIN)
  enroll(@Req() req: AuthRequest, @Body() dto: D.MatriculaDto) {
    return this.academic.enroll(req.currentUser, dto);
  }
  @Post('lotacoes')
  @Roles(Perfil.ADMIN)
  assignTeacher(@Req() req: AuthRequest, @Body() dto: D.LotacaoDto) {
    return this.academic.assignTeacher(req.currentUser, dto);
  }
  @Post('tutorias')
  @Roles(Perfil.ADMIN)
  assignTutor(@Req() req: AuthRequest, @Body() dto: D.TutoriaDto) {
    return this.academic.assignTutor(req.currentUser, dto);
  }
  @Patch('turmas/:id/fechamento')
  @Roles(Perfil.ADMIN)
  close(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: D.FechamentoDto,
  ) {
    return this.academic.closeClass(req.currentUser, id, dto.fechada);
  }
  @Post('aulas')
  @Roles(Perfil.PROFESSOR)
  createLesson(@Req() req: AuthRequest, @Body() dto: D.AulaDto) {
    return this.academic.createLesson(req.currentUser, dto);
  }
  @Put('aulas/:id/frequencia')
  @Roles(Perfil.PROFESSOR)
  attendance(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: D.FrequenciaDto,
  ) {
    return this.academic.attendance(req.currentUser, id, dto);
  }
  @Post('avaliacoes')
  @Roles(Perfil.PROFESSOR)
  createAssessment(@Req() req: AuthRequest, @Body() dto: D.AvaliacaoDto) {
    return this.academic.createAssessment(req.currentUser, dto);
  }
  @Put('avaliacoes/:id/notas')
  @Roles(Perfil.PROFESSOR)
  grades(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: D.NotasDto,
  ) {
    return this.academic.grades(req.currentUser, id, dto);
  }
  @Post('avaliacoes/:id/publicar')
  @Roles(Perfil.PROFESSOR)
  publishAssessment(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.academic.publishAssessment(req.currentUser, id);
  }
  @Post('atividades')
  @Roles(Perfil.PROFESSOR)
  createAssignment(@Req() req: AuthRequest, @Body() dto: D.AtividadeDto) {
    return this.academic.createAssignment(req.currentUser, dto);
  }
  @Post('atividades/:id/publicar')
  @Roles(Perfil.PROFESSOR)
  publishAssignment(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.academic.publishAssignment(req.currentUser, id);
  }
  @Put('atividades/:id/entrega')
  @Roles(Perfil.ALUNO)
  submit(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: D.EntregaDto,
  ) {
    return this.academic.submit(req.currentUser, id, dto);
  }
  @Put('atividades/:id/entregas/:matriculaId/correcao')
  @Roles(Perfil.PROFESSOR)
  correct(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('matriculaId', ParseUUIDPipe) matriculaId: string,
    @Body() dto: D.CorrecaoDto,
  ) {
    return this.academic.correct(req.currentUser, id, matriculaId, dto);
  }
  @Post('materiais')
  @Roles(Perfil.PROFESSOR)
  createMaterial(@Req() req: AuthRequest, @Body() dto: D.MaterialDto) {
    return this.academic.createMaterial(req.currentUser, dto);
  }
}
