import { Module } from '@nestjs/common';
import { VorgaengeController } from './vorgaenge.controller.js';
import { VorgaengeService } from './vorgaenge.service.js';

@Module({
  controllers: [VorgaengeController],
  providers: [VorgaengeService],
  exports: [VorgaengeService],
})
export class VorgaengeModule {}
