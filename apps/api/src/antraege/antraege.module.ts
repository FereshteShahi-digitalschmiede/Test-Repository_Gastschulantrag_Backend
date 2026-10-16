import { Module } from '@nestjs/common';
import { FahrzeitModule } from '../fahrzeit/fahrzeit.module.js';
import { SchulenModule } from '../schulen/schulen.module.js';
import { AntraegeController } from './antraege.controller.js';
import { AntraegeService } from './antraege.service.js';

@Module({
  imports: [FahrzeitModule, SchulenModule],
  controllers: [AntraegeController],
  providers: [AntraegeService],
})
export class AntraegeModule {}
