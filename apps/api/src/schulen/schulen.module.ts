import { Module } from '@nestjs/common';
import { FesteSchuldaten, SCHULDATEN_QUELLE } from './schuldaten.js';
import { SchulenController } from './schulen.controller.js';

@Module({
  controllers: [SchulenController],
  providers: [{ provide: SCHULDATEN_QUELLE, useClass: FesteSchuldaten }],
  exports: [SCHULDATEN_QUELLE],
})
export class SchulenModule {}
