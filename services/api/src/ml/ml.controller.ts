import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Param,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { Perfil } from '../generated/prisma/enums';
import { Roles } from '../common/roles/roles.decorator';
import { MlPreviewDto } from './dto/ml-preview.dto';
import { MlClientService } from './ml-client.service';
import { Throttle } from '@nestjs/throttler';
import type { AuthRequest } from '../auth/auth-user';
import { EnrollmentMlService } from './enrollment-ml.service';
import { MlProfileDto } from './dto/ml-profile.dto';
import { SelfReportDto } from './dto/self-report.dto';

@Roles(Perfil.ADMIN)
@Controller('ml')
export class MlController {
  constructor(
    private readonly ml: MlClientService,
    private readonly enrollmentMl: EnrollmentMlService,
  ) {}

  @Get('matriculas/:id/autodeclaracao')
  @Roles(Perfil.ALUNO)
  @Header('Cache-Control', 'no-store')
  selfReport(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.enrollmentMl.getSelfReport(req.currentUser, id);
  }

  @Put('matriculas/:id/autodeclaracao')
  @Roles(Perfil.ALUNO)
  @Header('Cache-Control', 'no-store')
  saveSelfReport(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SelfReportDto,
  ) {
    return this.enrollmentMl.saveSelfReport(req.currentUser, id, dto);
  }

  @Get('matriculas/:id')
  @Roles(Perfil.ADMIN, Perfil.COORDENACAO, Perfil.PROFESSOR, Perfil.TUTOR)
  @Header('Cache-Control', 'no-store')
  enrollment(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.enrollmentMl.get(req.currentUser, id);
  }

  @Get('matriculas/:id/demonstracao')
  @Roles(Perfil.ADMIN, Perfil.COORDENACAO, Perfil.PROFESSOR, Perfil.TUTOR)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  demoPreview(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.enrollmentMl.demoPreview(req.currentUser, id);
  }

  @Put('matriculas/:id')
  @Roles(Perfil.ADMIN, Perfil.COORDENACAO)
  @Header('Cache-Control', 'no-store')
  saveEnrollment(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MlProfileDto,
  ) {
    return this.enrollmentMl.save(req.currentUser, id, dto);
  }

  @Post('matriculas/:id/analisar')
  @Roles(Perfil.ADMIN, Perfil.COORDENACAO, Perfil.PROFESSOR, Perfil.TUTOR)
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  analyzeEnrollment(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.enrollmentMl.analyze(req.currentUser, id);
  }

  @Get('schema')
  @Roles(Perfil.ADMIN, Perfil.COORDENACAO)
  @Header('Cache-Control', 'no-store')
  schema() {
    return this.ml.schema();
  }

  @Get('status')
  status() {
    return this.ml.status();
  }

  @Post('preview')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Header('Cache-Control', 'no-store')
  @HttpCode(HttpStatus.OK)
  preview(@Body() dto: MlPreviewDto) {
    return this.ml.preview(dto.features, dto.inputFormat);
  }
}
