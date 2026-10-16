import { Inject, Injectable } from '@nestjs/common';
import { createRemoteJWKSet, type JWTPayload, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { CONFIG, type Config } from '../config.js';
import type { Benutzer } from './benutzer.js';

/** Prüft ein Login-Token und liefert die angemeldete Person – oder wirft bei ungültigem Token. */
export interface TokenPruefer {
  pruefe(token: string): Promise<Benutzer>;
}
export const TOKEN_PRUEFER = Symbol('TOKEN_PRUEFER');

const liste = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** Gemeinsame Prüfung für Keycloak und Tests: Signatur, Aussteller, Ablauf und zugelassener Client (azp). */
export async function pruefeMitSchluessel(token: string, schluessel: JWTVerifyGetKey, issuer: string, clients: string[]): Promise<Benutzer> {
  const { payload } = await jwtVerify(token, schluessel, { issuer, algorithms: ['RS256'] });
  const p = payload as JWTPayload & { azp?: string; name?: string; preferred_username?: string; organisationen?: unknown; rollen?: unknown };
  if (!p.azp || !clients.includes(p.azp)) throw new Error(`Token für Client „${p.azp}" ist hier nicht zugelassen`);
  return {
    id: p.sub ?? '',
    name: p.name ?? p.preferred_username ?? 'Unbekannt',
    organisationen: liste(p.organisationen),
    rollen: liste(p.rollen),
  };
}

/** Keycloak: öffentliche Schlüssel werden über JWKS geladen und zwischengespeichert. */
@Injectable()
export class KeycloakTokenPruefer implements TokenPruefer {
  private readonly jwks: JWTVerifyGetKey;

  constructor(@Inject(CONFIG) private readonly config: Config) {
    this.jwks = createRemoteJWKSet(new URL(`${config.OIDC_ISSUER}/protocol/openid-connect/certs`));
  }

  pruefe(token: string) {
    return pruefeMitSchluessel(token, this.jwks, this.config.OIDC_ISSUER, this.config.OIDC_CLIENTS);
  }
}
