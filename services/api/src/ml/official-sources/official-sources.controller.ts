import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Put,
  Req,
} from '@nestjs/common';
import type { AuthRequest } from '../../auth/auth-user';
import { Roles } from '../../common/roles/roles.decorator';
import { Perfil } from '../../generated/prisma/enums';
import {
  MacroCohortDto,
  MacroSourceDto,
  SemesterSourceDto,
} from './official-sources.dto';
import { OfficialSourcesService } from './official-sources.service';

function country(value: string) {
  if (!/^[A-Z]{2}$/.test(value)) throw new BadRequestException('País inválido');
  return value;
}

function year(value: number) {
  if (value < 1990 || value > 2100)
    throw new BadRequestException('Ano inválido');
  return value;
}

@Controller('ml')
export class OfficialSourcesController {
  constructor(private readonly sources: OfficialSourcesService) {}

  @Get('matriculas/:id/semestres/:semestre')
  @Roles(Perfil.COORDENACAO, Perfil.SECRETARIA)
  @Header('Cache-Control', 'no-store')
  semester(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('semestre', ParseIntPipe) semestre: number,
  ) {
    return this.sources.semester(req.currentUser, id, semestre);
  }

  @Put('matriculas/:id/semestres/:semestre')
  @Roles(Perfil.COORDENACAO, Perfil.SECRETARIA)
  @Header('Cache-Control', 'no-store')
  saveSemester(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('semestre', ParseIntPipe) semestre: number,
    @Body() dto: SemesterSourceDto,
  ) {
    return this.sources.saveSemester(req.currentUser, id, semestre, dto);
  }

  @Get('matriculas/:id/coorte-macro')
  @Roles(Perfil.COORDENACAO, Perfil.SECRETARIA)
  @Header('Cache-Control', 'no-store')
  cohort(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.sources.cohort(req.currentUser, id);
  }

  @Put('matriculas/:id/coorte-macro')
  @Roles(Perfil.COORDENACAO, Perfil.SECRETARIA)
  @Header('Cache-Control', 'no-store')
  setCohort(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MacroCohortDto,
  ) {
    return this.sources.setCohort(req.currentUser, id, dto);
  }

  @Get('fontes/macro/:pais/:ano')
  @Roles(Perfil.COORDENACAO, Perfil.SECRETARIA)
  @Header('Cache-Control', 'no-store')
  macro(
    @Req() req: AuthRequest,
    @Param('pais') pais: string,
    @Param('ano', ParseIntPipe) ano: number,
  ) {
    return this.sources.macro(req.currentUser, country(pais), year(ano));
  }

  @Put('fontes/macro/:pais/:ano')
  @Roles(Perfil.COORDENACAO)
  @Header('Cache-Control', 'no-store')
  saveMacro(
    @Req() req: AuthRequest,
    @Param('pais') pais: string,
    @Param('ano', ParseIntPipe) ano: number,
    @Body() dto: MacroSourceDto,
  ) {
    return this.sources.saveMacro(
      req.currentUser,
      country(pais),
      year(ano),
      dto,
    );
  }
}
