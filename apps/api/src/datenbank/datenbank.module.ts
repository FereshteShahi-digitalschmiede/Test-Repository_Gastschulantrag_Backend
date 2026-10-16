import { Global, Module } from '@nestjs/common';
import { CONFIG, loadConfig } from '../config.js';
import { PrismaService } from './prisma.service.js';

@Global()
@Module({
  providers: [{ provide: CONFIG, useFactory: () => loadConfig() }, PrismaService],
  exports: [CONFIG, PrismaService],
})
export class DatenbankModule {}
