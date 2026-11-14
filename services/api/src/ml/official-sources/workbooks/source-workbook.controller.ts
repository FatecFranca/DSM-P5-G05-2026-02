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
import type { AuthRequest } from '../../../auth/auth-user';
import { Roles } from '../../../common/roles/roles.decorator';
import { Perfil } from '../../../generated/prisma/enums';
import { sourceTemplate } from './source-workbook';
import { SourceWorkbookService } from './source-workbook.service';

const MAX_SIZE = 1024 * 1024;
const XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
type WorkbookFile = { originalname: string; buffer: Buffer };

function content(file: WorkbookFile): Buffer {
  if (!file.originalname.toLowerCase().endsWith('.xlsx'))
    throw new BadRequestException('Arquivo deve ter extensão .xlsx');
  return file.buffer;
}

@Controller('ml/fontes/importacoes')
export class SourceWorkbookController {
  constructor(private readonly workbooks: SourceWorkbookService) {}

  @Get('semestres/modelo')
  @Roles(Perfil.COORDENACAO, Perfil.SECRETARIA)
  @Header('Cache-Control', 'no-store')
  @Header('Content-Type', XLSX)
  @Header(
    'Content-Disposition',
    'attachment; filename="modelo-resumos-semestrais.xlsx"',
  )
  async semesterTemplate() {
    return new StreamableFile(await sourceTemplate('semestres'));
  }

  @Post('semestres')
  @Roles(Perfil.COORDENACAO, Perfil.SECRETARIA)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseInterceptors(
    FileInterceptor('arquivo', {
      limits: { fileSize: MAX_SIZE, files: 1, fields: 0 },
    }),
  )
  importSemesters(
    @Req() req: AuthRequest,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_SIZE })],
      }),
    )
    file: WorkbookFile,
  ) {
    return this.workbooks.semesters(req.currentUser, content(file));
  }

  @Get('macro/modelo')
  @Roles(Perfil.COORDENACAO)
  @Header('Cache-Control', 'no-store')
  @Header('Content-Type', XLSX)
  @Header(
    'Content-Disposition',
    'attachment; filename="modelo-indicadores-macro.xlsx"',
  )
  async macroTemplate() {
    return new StreamableFile(await sourceTemplate('macro'));
  }

  @Post('macro')
  @Roles(Perfil.COORDENACAO)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseInterceptors(
    FileInterceptor('arquivo', {
      limits: { fileSize: MAX_SIZE, files: 1, fields: 0 },
    }),
  )
  importMacro(
    @Req() req: AuthRequest,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_SIZE })],
      }),
    )
    file: WorkbookFile,
  ) {
    return this.workbooks.macro(req.currentUser, content(file));
  }
}
