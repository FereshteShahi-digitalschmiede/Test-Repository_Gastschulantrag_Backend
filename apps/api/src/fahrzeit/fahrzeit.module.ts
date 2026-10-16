import { Module } from '@nestjs/common';
import { SchulenModule } from '../schulen/schulen.module.js';
import { FahrzeitController } from './fahrzeit.controller.js';
import { FahrzeitService } from './fahrzeit.service.js';
import { OEPNV_AUSKUNFT } from './oepnv-auskunft.js';
import { SimulierteOepnvAuskunft } from './simulierte-oepnv-auskunft.js';

@Module({
  imports: [SchulenModule],
  controllers: [FahrzeitController],
  providers: [FahrzeitService, { provide: OEPNV_AUSKUNFT, useClass: SimulierteOepnvAuskunft }],
  exports: [FahrzeitService],
})
export class FahrzeitModule {}
