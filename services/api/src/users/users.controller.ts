import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import type { AuthRequest } from '../auth/auth-user';
import { Perfil } from '../generated/prisma/enums';
import { Roles } from '../common/roles/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

@Roles(Perfil.ADMIN)
@Controller('usuarios')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Req() request: AuthRequest) {
    return this.users.list(request.currentUser.instituicaoId);
  }

  @Get(':id')
  findOne(@Req() request: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.findOne(request.currentUser.instituicaoId, id);
  }

  @Post()
  create(@Req() request: AuthRequest, @Body() dto: CreateUserDto) {
    return this.users.create(request.currentUser, dto);
  }
}
