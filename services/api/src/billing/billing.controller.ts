import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { Perfil } from '../generated/prisma/enums';
import { Roles } from '../common/roles/roles.decorator';
import type { AuthRequest } from '../auth/auth-user';
import { BillingService } from './billing.service';
import {
  CreateInvoiceDto,
  EnrollmentSearchDto,
  MonthlyPlanDto,
  RecordPaymentDto,
} from './billing.dto';

@Controller('faturas')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('matriculas')
  @Roles(Perfil.COORDENACAO, Perfil.SECRETARIA)
  @Header('Cache-Control', 'no-store')
  searchEnrollments(
    @Req() req: AuthRequest,
    @Query() query: EnrollmentSearchDto,
  ) {
    return this.billing.searchEnrollments(req.currentUser, query.registro);
  }

  @Post()
  @Roles(Perfil.COORDENACAO, Perfil.SECRETARIA)
  @Header('Cache-Control', 'no-store')
  create(@Req() req: AuthRequest, @Body() dto: CreateInvoiceDto) {
    return this.billing.create(req.currentUser, dto);
  }

  @Put('matriculas/:id/plano')
  @Roles(Perfil.COORDENACAO, Perfil.SECRETARIA)
  @Header('Cache-Control', 'no-store')
  setPlan(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MonthlyPlanDto,
  ) {
    return this.billing.setMonthlyPlan(req.currentUser, id, dto);
  }

  @Get('matriculas/:id/plano')
  @Roles(Perfil.COORDENACAO, Perfil.SECRETARIA)
  @Header('Cache-Control', 'no-store')
  getPlan(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.billing.getMonthlyPlan(req.currentUser, id);
  }

  @Post(':id/pagamentos')
  @Roles(Perfil.COORDENACAO, Perfil.SECRETARIA)
  @Header('Cache-Control', 'no-store')
  pay(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.billing.recordPayment(req.currentUser, id, dto);
  }

  @Post(':id/simular-pagamento')
  @Roles(Perfil.ALUNO)
  @Header('Cache-Control', 'no-store')
  simulatePayment(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.billing.simulatePayment(req.currentUser, id);
  }

  @Get('matriculas/:id/semestres')
  @Roles(Perfil.COORDENACAO, Perfil.SECRETARIA, Perfil.ALUNO)
  @Header('Cache-Control', 'no-store')
  semesters(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.billing.semesters(req.currentUser, id);
  }

  @Get('matriculas/:id')
  @Roles(Perfil.COORDENACAO, Perfil.SECRETARIA, Perfil.ALUNO)
  @Header('Cache-Control', 'no-store')
  list(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.billing.list(req.currentUser, id);
  }
}
