import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { API_VERSION } from '@gastschulantrag/shared';
import { PrismaService } from '../datenbank/prisma.service.js';

@ApiTags('System')
@Controller('health')
export class HealthController {
  constructor(private readonly db: PrismaService) {}

  @Get()
  @ApiOkResponse({ description: 'Die API ist erreichbar; „datenbank" zeigt, ob PostgreSQL antwortet.' })
  async get() {
    const datenbank = await this.db.$queryRaw`SELECT 1`.then(() => 'ok' as const, () => 'nicht erreichbar' as const);
    return { status: 'ok', version: API_VERSION, datenbank };
  }
}
