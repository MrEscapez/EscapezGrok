import { Global, Module } from '@nestjs/common';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { SessionAuthGuard } from '../rbac/session-auth.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionAuthGuard, PermissionsGuard],
  exports: [AuthService, SessionAuthGuard, PermissionsGuard],
})
export class AuthModule {}
