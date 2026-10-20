import { Controller, Get } from '@nestjs/common';
import { Perfil } from '../generated/prisma/enums';
import { Roles } from '../common/roles/roles.decorator';
import { MlClientService } from './ml-client.service';

@Roles(Perfil.ADMIN)
@Controller('ml')
export class MlController {
  constructor(private readonly ml: MlClientService) {}

  @Get('status')
  status() {
    return this.ml.status();
  }
}
