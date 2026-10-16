import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth.guard.js';
import { KeycloakTokenPruefer, TOKEN_PRUEFER } from './token-pruefer.js';

@Global()
@Module({
  providers: [{ provide: TOKEN_PRUEFER, useClass: KeycloakTokenPruefer }, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: [TOKEN_PRUEFER],
})
export class AuthModule {}
