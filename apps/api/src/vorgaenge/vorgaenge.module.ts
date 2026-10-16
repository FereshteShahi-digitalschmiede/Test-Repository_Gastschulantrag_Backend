import { Module } from '@nestjs/common';
import { VorgaengeController } from './vorgaenge.controller.js';
import { ErklaerungenService } from './erklaerungen.service.js';
import { VorgaengeService } from './vorgaenge.service.js';

@Module({
  controllers: [VorgaengeController],
  providers: [VorgaengeService, ErklaerungenService],
  exports: [VorgaengeService],
})
export class VorgaengeModule {}
