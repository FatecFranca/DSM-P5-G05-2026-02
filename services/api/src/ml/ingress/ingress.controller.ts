import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthRequest } from '../../auth/auth-user';
import { Roles } from '../../common/roles/roles.decorator';
import { Perfil } from '../../generated/prisma/enums';
import { IngressDeclarationDto } from '../dto/ingress-declaration.dto';
import { IngressSourceDto } from '../dto/ingress-source.dto';
import { IngressService } from './ingress.service';
import { IngressEnrollmentSearchDto } from './ingress-search.dto';

@Controller('ml/matriculas/:id')
export class IngressController {
  constructor(private readonly ingress: IngressService) {}

  @Get('declaracao-ingresso')
  @Roles(Perfil.ALUNO)
  @Header('Cache-Control', 'no-store')
  declaration(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.ingress.declaration(req.currentUser, id);
  }

  @Put('declaracao-ingresso')
  @Roles(Perfil.ALUNO)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  saveDeclaration(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IngressDeclarationDto,
  ) {
    return this.ingress.saveDeclaration(req.currentUser, id, dto);
  }

  @Get('ingresso')
  @Roles(Perfil.COORDENACAO, Perfil.SECRETARIA)
  @Header('Cache-Control', 'no-store')
  source(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.ingress.source(req.currentUser, id);
  }

  @Put('ingresso')
  @Roles(Perfil.COORDENACAO, Perfil.SECRETARIA)
  @Header('Cache-Control', 'no-store')
  saveSource(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IngressSourceDto,
  ) {
    return this.ingress.saveSource(req.currentUser, id, dto);
  }
}

@Controller('ml/ingressos')
export class IngressQueueController {
  constructor(private readonly ingress: IngressService) {}

  @Get('matriculas')
  @Roles(Perfil.COORDENACAO, Perfil.SECRETARIA)
  @Header('Cache-Control', 'no-store')
  searchEnrollments(
    @Req() req: AuthRequest,
    @Query() query: IngressEnrollmentSearchDto,
  ) {
    return this.ingress.searchEnrollments(req.currentUser, query.registro);
  }

  @Get('pendentes')
  @Roles(Perfil.COORDENACAO, Perfil.SECRETARIA)
  @Header('Cache-Control', 'no-store')
  pending(@Req() req: AuthRequest) {
    return this.ingress.pending(req.currentUser);
  }
}
