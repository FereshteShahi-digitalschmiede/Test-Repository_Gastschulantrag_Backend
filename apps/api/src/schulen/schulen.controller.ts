import { Controller, Get, Inject, NotFoundException, Param } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Schule } from '@gastschulantrag/shared';
import { z } from 'zod';
import { openapi } from '../common/zod.js';
import { SCHULDATEN_QUELLE, type SchuldatenQuelle } from './schuldaten.js';

@ApiTags('Schulen')
@Controller('schulen')
export class SchulenController {
  constructor(@Inject(SCHULDATEN_QUELLE) private readonly schuldaten: SchuldatenQuelle) {}

  @Get()
  @ApiOperation({ summary: 'Alle Berufsschulen mit Adresse und Unterrichtszeiten (frühester Beginn, spätestes Ende)' })
  @ApiOkResponse({ schema: openapi(z.array(Schule)) })
  alle() {
    return this.schuldaten.alle();
  }

  @Get(':nr')
  @ApiOperation({ summary: 'Eine Berufsschule nach Schulnummer' })
  @ApiOkResponse({ schema: openapi(Schule) })
  @ApiNotFoundResponse({ description: 'Schulnummer unbekannt' })
  async eine(@Param('nr') nr: string) {
    const schule = await this.schuldaten.finde(nr);
    if (!schule) throw new NotFoundException(`Keine Schule mit der Schulnummer ${nr} in den Schuldaten`);
    return schule;
  }
}
