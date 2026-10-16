import { type CanActivate, type ExecutionContext, Inject, Injectable, SetMetadata, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Benutzer } from './benutzer.js';
import { TOKEN_PRUEFER, type TokenPruefer } from './token-pruefer.js';

const OEFFENTLICH = 'oeffentlich';
/** Endpunkt ohne Anmeldung erreichbar (Antragstellerseite, Schuldaten, Fahrzeit, Health) */
export const Oeffentlich = () => SetMetadata(OEFFENTLICH, true);

type MitBenutzer = Request & { benutzer?: Benutzer };

/** Die per Token angemeldete Person (nur in nicht-öffentlichen Endpunkten gesetzt) */
export const AktuellerBenutzer = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<MitBenutzer>().benutzer!);

/** Standardmäßig ist jeder Endpunkt geschützt; Ausnahmen werden mit @Oeffentlich() markiert. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, @Inject(TOKEN_PRUEFER) private readonly pruefer: TokenPruefer) {}

  async canActivate(ctx: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>(OEFFENTLICH, [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest<MitBenutzer>();
    const [art, token] = (req.headers.authorization ?? '').split(' ');
    if (art !== 'Bearer' || !token) throw new UnauthorizedException('Anmeldung erforderlich');
    try {
      req.benutzer = await this.pruefer.pruefe(token);
    } catch {
      throw new UnauthorizedException('Anmeldung ungültig oder abgelaufen – bitte erneut anmelden');
    }
    return true;
  }
}
