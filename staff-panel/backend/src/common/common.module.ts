import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitService } from './rate-limit.service';

@Global()
@Module({
  providers: [
    RateLimitService,
    RateLimitGuard,
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
  exports: [RateLimitService, RateLimitGuard],
})
export class CommonModule {}
