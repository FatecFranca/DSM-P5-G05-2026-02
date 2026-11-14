import {
  Controller,
  FileTypeValidator,
  Get,
  Header,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { AuthRequest } from '../auth/auth-user';
import { Roles } from '../common/roles/roles.decorator';
import { Perfil } from '../generated/prisma/enums';
import { FilesService } from './files.service';
import type { AcademicUpload } from './files.service';

@Controller('arquivos')
export class FilesController {
  constructor(private readonly files: FilesService) {}
  @Post()
  @Roles(Perfil.PROFESSOR, Perfil.ALUNO)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseInterceptors(
    FileInterceptor('arquivo', {
      limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0 },
    }),
  )
  upload(
    @Req() req: AuthRequest,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new FileTypeValidator({
            fileType:
              /^(application\/pdf|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|presentationml\.presentation)|application\/vnd\.oasis\.opendocument\.text)$/,
            overrideMimeType: true,
          }),
        ],
      }),
    )
    file: AcademicUpload,
  ) {
    return this.files.upload(req.currentUser, file);
  }
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  download(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.files.download(req.currentUser, id);
  }
}
