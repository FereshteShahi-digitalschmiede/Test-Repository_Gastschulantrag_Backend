import { Body, Controller, Get, Headers, HttpCode, Param, Post, UploadedFile, UseFilters, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse, ApiBody, ApiConsumes, ApiCreatedResponse, ApiHeader, ApiNotFoundResponse, ApiOkResponse, ApiOperation,
  ApiPayloadTooLargeResponse, ApiTags, ApiUnauthorizedResponse, ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { AntragEingereicht, AntragEinreichen, AntragStand, Dokument, NACHWEIS_MAX_BYTES, ZUGANGSSCHLUESSEL_HEADER } from '@gastschulantrag/shared';
import { DateiZuGrossFilter } from '../common/fehler.filter.js';
import { openapi, ZodPipe } from '../common/zod.js';
import { AntraegeService } from './antraege.service.js';

/** Von multer (FileInterceptor, Speicherung im Arbeitsspeicher) bereitgestellte Datei */
interface HochgeladeneDatei { originalname: string; buffer: Buffer; size: number }

const SCHLUESSEL_DOKU = {
  name: 'X-Zugangsschluessel',
  required: true,
  description: 'Zugangsschlüssel aus der Antwort von POST /antraege (Übergangslösung bis zur Anmeldung über BayernID)',
};

@ApiTags('Anträge')
@Controller('antraege')
export class AntraegeController {
  constructor(private readonly antraege: AntraegeService) {}

  @Post()
  @ApiOperation({
    summary: 'Antrag einreichen',
    description: 'Legt den Vorgang mit Laufweg an (Sprengelschule, Gastschule, beide Sachaufwandsträger; Regierung bei Dissens). Bei Grund „fahrzeit" wird die Fahrzeitenprüfung automatisch durchgeführt. Die Antwort enthält einmalig den Zugangsschlüssel.',
  })
  @ApiBody({ schema: openapi(AntragEinreichen, 'input') })
  @ApiCreatedResponse({ schema: openapi(AntragEingereicht) })
  @ApiBadRequestResponse({ description: 'Eingabe ungültig – Antwort enthält die Liste der Fehler je Feld' })
  einreichen(@Body(new ZodPipe(AntragEinreichen)) antrag: AntragEinreichen) {
    return this.antraege.einreichen(antrag);
  }

  @Get(':aktenzeichen')
  @ApiOperation({ summary: 'Stand des eigenen Antrags', description: 'Status-Ablauf, Nachrichten und Nachweise für die antragstellende Person.' })
  @ApiHeader(SCHLUESSEL_DOKU)
  @ApiOkResponse({ schema: openapi(AntragStand) })
  @ApiUnauthorizedResponse({ description: 'Zugangsschlüssel fehlt' })
  @ApiNotFoundResponse({ description: 'Antrag unbekannt oder Schlüssel falsch' })
  stand(@Param('aktenzeichen') aktenzeichen: string, @Headers(ZUGANGSSCHLUESSEL_HEADER) schluessel?: string) {
    return this.antraege.stand(aktenzeichen, schluessel);
  }

  @Post(':aktenzeichen/dokumente')
  @HttpCode(201)
  @UseFilters(DateiZuGrossFilter)
  @UseInterceptors(FileInterceptor('datei', { limits: { fileSize: NACHWEIS_MAX_BYTES, files: 1 } }))
  @ApiOperation({ summary: 'Nachweis hochladen', description: 'PDF, PNG oder JPG bis 10 MB; der Dateiinhalt wird geprüft. Optional als Gesundheitsnachweis (Art. 9 DSGVO) kennzeichnen.' })
  @ApiHeader(SCHLUESSEL_DOKU)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['datei'],
      properties: {
        datei: { type: 'string', format: 'binary' },
        besondereKategorie: { type: 'boolean', description: 'Gesundheitsdaten (Art. 9 DSGVO) – nur für Sprengelschule und Regierung sichtbar' },
      },
    },
  })
  @ApiCreatedResponse({ schema: openapi(Dokument) })
  @ApiUnauthorizedResponse({ description: 'Zugangsschlüssel fehlt' })
  @ApiNotFoundResponse({ description: 'Antrag unbekannt oder Schlüssel falsch' })
  @ApiPayloadTooLargeResponse({ description: 'Datei größer als 10 MB' })
  @ApiUnprocessableEntityResponse({ description: 'Dateityp nicht zulässig oder zu viele Nachweise' })
  hochladen(
    @Param('aktenzeichen') aktenzeichen: string,
    @Headers(ZUGANGSSCHLUESSEL_HEADER) schluessel: string | undefined,
    @UploadedFile() datei: HochgeladeneDatei | undefined,
    @Body('besondereKategorie') besondereKategorie?: string,
  ) {
    return this.antraege.nachweisHochladen(aktenzeichen, schluessel, datei, besondereKategorie === 'true');
  }
}
