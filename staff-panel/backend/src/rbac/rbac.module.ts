import { Global, Module } from '@nestjs/common';
import { RbacStore } from './rbac.store';

/**
 * Global RBAC store (roles/users + data/rbac.json).
 * Guards live in AuthModule to avoid circular imports.
 */
@Global()
@Module({
  providers: [RbacStore],
  exports: [RbacStore],
})
export class RbacModule {}
