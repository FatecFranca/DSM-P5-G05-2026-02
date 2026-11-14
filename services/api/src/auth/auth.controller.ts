import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthRequest } from './auth-user';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from './public.decorator';
import { Roles } from '../common/roles/roles.decorator';
import { Perfil } from '../generated/prisma/enums';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Get('health')
  health() {
    return this.auth.health();
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('instituicoes')
  instituicoes() {
    return this.auth.listInstituicoes();
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto);
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.auth.logout(dto);
  }

  @Get('me')
  @Roles(
    Perfil.COORDENACAO,
    Perfil.SECRETARIA,
    Perfil.PROFESSOR,
    Perfil.TUTOR,
    Perfil.ALUNO,
  )
  me(@Req() request: AuthRequest) {
    return request.currentUser;
  }

  @Post('trocar-senha')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @Req() request: AuthRequest,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.auth.changePassword(request.currentUser, dto);
  }
}
