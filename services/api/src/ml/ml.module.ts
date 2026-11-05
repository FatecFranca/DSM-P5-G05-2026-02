import { Module } from '@nestjs/common';
import { MlClientService } from './ml-client.service';
import { MlController } from './ml.controller';
import { EnrollmentMlService } from './enrollment-ml.service';
import { DemoAnalysisService } from './demo-analysis.service';
import { OfficialSourcesService } from './official-sources/official-sources.service';
import { OfficialSourcesController } from './official-sources/official-sources.controller';
import { IngressService } from './ingress/ingress.service';
import {
  IngressController,
  IngressQueueController,
} from './ingress/ingress.controller';
import { ImportsController } from './imports/imports.controller';
import { ImportsService } from './imports/imports.service';
import { AutomaticPredictionsService } from './automatic-predictions.service';
import { SourceWorkbookController } from './official-sources/workbooks/source-workbook.controller';
import { SourceWorkbookService } from './official-sources/workbooks/source-workbook.service';

@Module({
  controllers: [
    MlController,
    OfficialSourcesController,
    IngressController,
    IngressQueueController,
    ImportsController,
    SourceWorkbookController,
  ],
  providers: [
    MlClientService,
    EnrollmentMlService,
    DemoAnalysisService,
    OfficialSourcesService,
    IngressService,
    ImportsService,
    AutomaticPredictionsService,
    SourceWorkbookService,
  ],
  exports: [MlClientService],
})
export class MlModule {}
