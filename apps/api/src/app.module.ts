import { Module } from '@nestjs/common';
import { AntraegeModule } from './antraege/antraege.module.js';
import { AuthModule } from './auth/auth.module.js';
import { DatenbankModule } from './datenbank/datenbank.module.js';
import { FahrzeitModule } from './fahrzeit/fahrzeit.module.js';
import { HealthController } from './health/health.controller.js';
import { KonfigurationController } from './konfiguration/konfiguration.controller.js';
import { SchulenModule } from './schulen/schulen.module.js';
import { SpeicherModule } from './speicher/speicher.module.js';
import { VorgaengeModule } from './vorgaenge/vorgaenge.module.js';

@Module({
  imports: [DatenbankModule, AuthModule, SpeicherModule, SchulenModule, FahrzeitModule, AntraegeModule, VorgaengeModule],
  controllers: [HealthController, KonfigurationController],
})
export class AppModule {}
