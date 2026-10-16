import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { VorgangDetail, VorgangKurz } from '@gastschulantrag/shared';
import { z } from 'zod';
import { openapi } from '../common/zod.js';
import { VorgaengeService } from './vorgaenge.service.js';

@ApiTags('Vorgänge')
@Controller('vorgaenge')
export class VorgaengeController {
  constructor(private readonly vorgaenge: VorgaengeService) {}

  @Get()
  @ApiOperation({ summary: 'Antragsübersicht', description: 'Noch ohne Anmeldung (nur Testdaten); Rechteprüfung folgt mit Keycloak.' })
  @ApiQuery({ name: 'schule', required: false, description: 'Schulnummer – nur Vorgänge, an denen diese Schule beteiligt ist' })
  @ApiOkResponse({ schema: openapi(z.array(VorgangKurz)) })
  liste(@Query('schule') schule?: string) {
    return this.vorgaenge.liste(schule);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Vorgang mit Laufweg, Dokumenten und Revisionsprotokoll', description: 'ID oder Aktenzeichen (z. B. GS-2026-88001)' })
  @ApiOkResponse({ schema: openapi(VorgangDetail) })
  @ApiNotFoundResponse({ description: 'Vorgang nicht gefunden' })
  detail(@Param('id') id: string) {
    return this.vorgaenge.detail(id);
  }
}
