import { type ArgumentsHost, Catch, type ExceptionFilter, PayloadTooLargeException } from '@nestjs/common';
import { NACHWEIS_MAX_BYTES } from '@gastschulantrag/shared';
import type { Response } from 'express';

/** Übersetzt die englische Meldung des Upload-Moduls (Datei zu groß) in eine verständliche deutsche Antwort. */
@Catch(PayloadTooLargeException)
export class DateiZuGrossFilter implements ExceptionFilter {
  catch(_: PayloadTooLargeException, host: ArgumentsHost) {
    host.switchToHttp().getResponse<Response>().status(413).json({
      statusCode: 413,
      message: `Die Datei ist zu groß. Erlaubt sind höchstens ${NACHWEIS_MAX_BYTES / 1024 / 1024} MB.`,
    });
  }
}
