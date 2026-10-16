import { Global, Module } from '@nestjs/common';
import { DATEI_SPEICHER } from './datei-speicher.js';
import { S3DateiSpeicher } from './s3-datei-speicher.js';

@Global()
@Module({
  providers: [{ provide: DATEI_SPEICHER, useClass: S3DateiSpeicher }],
  exports: [DATEI_SPEICHER],
})
export class SpeicherModule {}
