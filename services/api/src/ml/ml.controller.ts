import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { Perfil } from '../generated/prisma/enums';
import { Roles } from '../common/roles/roles.decorator';
import { MlPreviewDto } from './dto/ml-preview.dto';
import { MlClientService } from './ml-client.service';
import { Throttle } from '@nestjs/throttler';

@Roles(Perfil.ADMIN)
@Controller('ml')
export class MlController {
  constructor(private readonly ml: MlClientService) {}

  @Get('schema')
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
