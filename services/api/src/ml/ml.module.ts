import { Module } from '@nestjs/common';
import { MlClientService } from './ml-client.service';
import { MlController } from './ml.controller';
import { EnrollmentMlService } from './enrollment-ml.service';

@Module({
  controllers: [MlController],
  providers: [MlClientService, EnrollmentMlService],
  exports: [MlClientService],
})
export class MlModule {}
