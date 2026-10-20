import { Module } from '@nestjs/common';
import { MlClientService } from './ml-client.service';
import { MlController } from './ml.controller';

@Module({
  controllers: [MlController],
  providers: [MlClientService],
  exports: [MlClientService],
})
export class MlModule {}
