import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permission } from './permissions';
import { REQUIRE_PERMISSIONS_KEY } from './require-permissions.decorator';
import type { StaffRequest } from './staff-request';

/**
 * Enforces @RequirePermissions(...). If metadata is missing, allows
 * (authenticated-only routes). All listed permissions are required (AND).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(
      REQUIRE_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<StaffRequest>();
    const session = req.staffSession;
    if (!session) {
      throw new ForbiddenException('Geen rechten voor deze actie');
    }

    const have = new Set(session.permissions);
    const missing = required.filter((p) => !have.has(p));
    if (missing.length > 0) {
      throw new ForbiddenException('Geen rechten voor deze actie');
    }
    return true;
  }
}
