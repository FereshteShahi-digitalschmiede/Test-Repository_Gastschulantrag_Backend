import { CreateBucketCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { CONFIG, type Config } from '../config.js';
import type { DateiSpeicher } from './datei-speicher.js';

@Injectable()
export class S3DateiSpeicher implements DateiSpeicher, OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Dateispeicher');
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(@Inject(CONFIG) config: Config) {
    this.bucket = config.S3_BUCKET;
    this.s3 = new S3Client({
      endpoint: config.S3_ENDPOINT,
      region: config.S3_REGION,
      forcePathStyle: true,
      credentials: { accessKeyId: config.S3_ACCESS_KEY, secretAccessKey: config.S3_SECRET_KEY },
    });
  }

  /** Legt den Bucket an, falls er fehlt. Ist der Speicher nicht erreichbar, startet die API trotzdem (Upload meldet dann den Fehler). */
  async onModuleInit() {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.log.log(`Bucket „${this.bucket}" angelegt`);
      } catch (e) {
        this.log.warn(`S3-Speicher nicht erreichbar – Uploads schlagen fehl, bis er läuft (${(e as Error).message})`);
      }
    }
  }

  onModuleDestroy() {
    this.s3.destroy();
  }

  async ablegen(schluessel: string, inhalt: Buffer, inhaltstyp: string) {
    await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: schluessel, Body: inhalt, ContentType: inhaltstyp }));
  }

  async lesen(schluessel: string) {
    const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: schluessel }));
    return Buffer.from(await res.Body!.transformToByteArray());
  }
}
