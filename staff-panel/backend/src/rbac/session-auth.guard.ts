import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../auth/auth.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import type { StaffRequest } from './staff-request';

/**
 * Requires a valid staff cookie session unless @Public().
 * Attaches session to request.staffSession.
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<StaffRequest>();
    const sessionId = req.cookies?.[this.auth.cookieName()] as
      | string
      | undefined;
    const session = this.auth.getSession(sessionId);
    if (!session) {
      throw new UnauthorizedException('Niet ingelogd');
    }
    req.staffSession = session;
    req.staffSessionId = sessionId;
    return true;
  }
}
