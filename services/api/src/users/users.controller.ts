import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { AuthRequest } from '../auth/auth-user';
import { Perfil } from '../generated/prisma/enums';
import { Roles } from '../common/roles/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { UsersService } from './users.service';

@Controller('usuarios')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Req() request: AuthRequest, @Query() query: ListUsersDto) {
    return this.users.list(request.currentUser, query);
  }

  @Get(':id')
  findOne(@Req() request: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.findOne(request.currentUser, id);
  }

  @Post()
  @Roles(Perfil.ADMIN)
  create(@Req() request: AuthRequest, @Body() dto: CreateUserDto) {
    return this.users.create(request.currentUser, dto);
  }
}
