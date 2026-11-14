import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { ScholarshipService } from './scholarship/scholarship.service';
import { ScholarshipController } from './scholarship/scholarship.controller';

@Module({
  providers: [BillingService, ScholarshipService],
  controllers: [BillingController, ScholarshipController],
})
export class BillingModule {}
