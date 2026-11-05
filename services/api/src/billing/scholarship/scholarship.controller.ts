import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
} from '@nestjs/common';
import type { AuthRequest } from '../../auth/auth-user';
import { Roles } from '../../common/roles/roles.decorator';
import { Perfil } from '../../generated/prisma/enums';
import { ScholarshipDto } from './scholarship.dto';
import { ScholarshipService } from './scholarship.service';

@Controller('bolsas/matriculas')
export class ScholarshipController {
  constructor(private readonly scholarship: ScholarshipService) {}

  @Put(':id')
  @Roles(Perfil.ADMIN, Perfil.FINANCEIRO)
  @Header('Cache-Control', 'no-store')
  set(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ScholarshipDto,
  ) {
    return this.scholarship.set(req.currentUser, id, dto);
  }

  @Get(':id')
  @Roles(Perfil.ADMIN, Perfil.FINANCEIRO, Perfil.ALUNO)
  @Header('Cache-Control', 'no-store')
  get(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.scholarship.get(req.currentUser, id);
  }
}
