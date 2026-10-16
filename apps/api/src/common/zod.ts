import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ApiResponseOptions } from '@nestjs/swagger';
import { z } from 'zod';

type SchemaObject = NonNullable<Extract<ApiResponseOptions, { schema?: unknown }>['schema']>;

/** Prüft Request-Daten gegen ein zod-Schema; Fehler kommen als verständliche Liste zurück. */
export class ZodPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Ungültige Eingabe',
        fehler: result.error.issues.map((i) => ({ feld: i.path.join('.'), meldung: i.message })),
      });
    }
    return result.data;
  }
}

/** zod-Schema → OpenAPI-Schema für die Dokumentation unter /docs */
export function openapi(schema: z.ZodType, io: 'input' | 'output' = 'output'): SchemaObject {
  return z.toJSONSchema(schema, { target: 'openapi-3.0', io, unrepresentable: 'any' }) as SchemaObject;
}
