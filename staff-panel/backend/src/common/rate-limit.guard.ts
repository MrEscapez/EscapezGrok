import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import {
  RATE_LIMIT_KEY,
  RateLimitOptions,
} from './rate-limit.decorator';
import { RateLimitService } from './rate-limit.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimit: RateLimitService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!options) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const ip =
      req.ip ||
      req.socket?.remoteAddress ||
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      'unknown';

    let key = `ip:${ip}:${req.method}:${req.path}`;
    if (options.key === 'ip+username') {
      const body = req.body as { username?: string } | undefined;
      const username = (body?.username || '').toString().trim().toLowerCase();
      key = `login:${ip}:${username}`;
    }

    this.rateLimit.assertAllowed(
      key,
      options.limit,
      options.windowMs,
      options.message,
    );
    return true;
  }
}
