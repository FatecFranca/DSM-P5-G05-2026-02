import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { AuthRequest } from '../auth/auth-user';
import { Perfil } from '../generated/prisma/enums';
import { Roles } from '../common/roles/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { ImportQuery, UpdateUserDto } from './dto/update-user.dto';
import { UsersAdminService } from './users-admin.service';
import { UsersService } from './users.service';

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MAX_IMPORT_SIZE = 1024 * 1024;

@Controller('usuarios')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly admin: UsersAdminService,
  ) {}

  @Get()
  @Roles(
    Perfil.COORDENACAO,
    Perfil.SECRETARIA,
    Perfil.PROFESSOR,
    Perfil.TUTOR,
    Perfil.ALUNO,
  )
  list(@Req() request: AuthRequest, @Query() query: ListUsersDto) {
    return this.users.list(request.currentUser, query);
  }

  // Rotas fixas antes das parametrizadas, para "importacoes" nunca ser lido como :id.
  @Get('importacoes/modelo')
  @Roles(Perfil.COORDENACAO, Perfil.SECRETARIA)
  @Header('Cache-Control', 'no-store')
  @Header('Content-Type', XLSX_MIME)
  async template(@Req() request: AuthRequest, @Query() query: ImportQuery) {
    const bytes = await this.admin.template(request.currentUser, query.perfil);
    return new StreamableFile(bytes, {
      disposition: `attachment; filename="modelo-cadastro-${query.perfil === 'ALUNO' ? 'alunos' : 'professores'}.xlsx"`,
    });
  }

  @Post('importacoes')
  @Roles(Perfil.COORDENACAO, Perfil.SECRETARIA)
  @Header('Cache-Control', 'no-store')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('arquivo', {
      limits: { fileSize: MAX_IMPORT_SIZE, files: 1, fields: 0 },
    }),
  )
  importPeople(
    @Req() request: AuthRequest,
    @Query() query: ImportQuery,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_IMPORT_SIZE })],
      }),
    )
    file: { originalname: string; buffer: Buffer },
  ) {
    if (!file.originalname.toLowerCase().endsWith('.xlsx')) {
      throw new BadRequestException('Arquivo deve ter extensão .xlsx');
    }
    return this.admin.importPeople(request.currentUser, file.buffer, query);
  }

  @Get(':id')
  @Roles(
    Perfil.COORDENACAO,
    Perfil.SECRETARIA,
    Perfil.PROFESSOR,
    Perfil.TUTOR,
    Perfil.ALUNO,
  )
  findOne(@Req() request: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.findOne(request.currentUser, id);
  }

  @Post()
  @Roles(Perfil.COORDENACAO, Perfil.SECRETARIA)
  create(@Req() request: AuthRequest, @Body() dto: CreateUserDto) {
    return this.users.create(request.currentUser, dto);
  }

  @Patch(':id')
  @Roles(Perfil.COORDENACAO, Perfil.SECRETARIA)
  update(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.admin.update(request.currentUser, id, dto);
  }

  @Post(':id/redefinir-senha')
  @Roles(Perfil.COORDENACAO, Perfil.SECRETARIA)
  @Header('Cache-Control', 'no-store')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  resetPassword(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.admin.resetPassword(request.currentUser, id);
  }
}
