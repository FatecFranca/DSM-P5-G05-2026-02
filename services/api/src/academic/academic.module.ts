import { Module } from '@nestjs/common';
import { AcademicService } from './academic.service';
import { AcademicController } from './academic.controller';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { FeedsService } from './feeds.service';

@Module({
  providers: [AcademicService, FilesService, FeedsService],
  controllers: [AcademicController, FilesController],
})
export class AcademicModule {}
