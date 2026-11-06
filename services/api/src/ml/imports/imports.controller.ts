import {
  BadRequestException,
  Controller,
  Get,
  Header,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  Req,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { AuthRequest } from '../../auth/auth-user';
import { Roles } from '../../common/roles/roles.decorator';
import { Perfil } from '../../generated/prisma/enums';
import { ImportsService } from './imports.service';
import { createImportTemplate } from './workbook-parser';

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MAX_SIZE = 1024 * 1024;

@Controller('ml/importacoes')
@Roles(Perfil.COORDENACAO)
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Get('modelo')
  @Header('Cache-Control', 'no-store')
  @Header('Content-Type', XLSX_MIME)
  @Header(
    'Content-Disposition',
    'attachment; filename="modelo-importacao-ml.xlsx"',
  )
  async template() {
    const bytes = await createImportTemplate();
    return new StreamableFile(bytes);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  recent(@Req() req: AuthRequest) {
    return this.imports.recent(req.currentUser);
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseInterceptors(
    FileInterceptor('arquivo', {
      limits: { fileSize: MAX_SIZE, files: 1, fields: 0 },
    }),
  )
  upload(
    @Req() req: AuthRequest,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_SIZE })],
      }),
    )
    file: { originalname: string; buffer: Buffer },
  ) {
    if (!file.originalname.toLowerCase().endsWith('.xlsx')) {
      throw new BadRequestException('Arquivo deve ter extensão .xlsx');
    }
    return this.imports.import(req.currentUser, file.buffer);
  }
}
