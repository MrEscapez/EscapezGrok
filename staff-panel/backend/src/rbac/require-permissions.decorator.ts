import { SetMetadata } from '@nestjs/common';
import type { Permission } from './permissions';

export const REQUIRE_PERMISSIONS_KEY = 'requirePermissions';

/**
 * Require ALL listed permissions (AND). Session must already be present
 * (SessionAuthGuard). Empty list = authenticated only.
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(REQUIRE_PERMISSIONS_KEY, permissions);
