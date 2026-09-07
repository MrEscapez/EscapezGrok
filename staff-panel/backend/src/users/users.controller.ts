import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import {
  ALL_PERMISSIONS,
  PERMISSION_LABELS,
  Permissions,
} from '../rbac/permissions';
import { RbacStore } from '../rbac/rbac.store';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller()
export class UsersController {
  constructor(
    private readonly rbac: RbacStore,
    private readonly auth: AuthService,
  ) {}

  @Get('users')
  @RequirePermissions(Permissions.USERS_VIEW)
  listUsers() {
    return { items: this.rbac.listUsersPublic() };
  }

  @Post('users')
  @HttpCode(200)
  @RequirePermissions(Permissions.USERS_MANAGE)
  async createUser(@Body() body: CreateUserDto) {
    try {
      const user = await this.rbac.createUser({
        username: body.username,
        password: body.password,
        roleIds: body.roleIds,
      });
      return { ok: true, user };
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Aanmaken mislukt',
      );
    }
  }

  @Patch('users/:id')
  @RequirePermissions(Permissions.USERS_MANAGE)
  async updateUser(@Param('id') id: string, @Body() body: UpdateUserDto) {
    try {
      const user = await this.rbac.updateUser(id, {
        roleIds: body.roleIds,
        password: body.password,
      });
      if (body.password) {
        this.auth.invalidateUserSessions(id);
      } else {
        this.auth.refreshUserSessions(id);
      }
      return { ok: true, user };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bijwerken mislukt';
      if (msg.includes('niet gevonden')) {
        throw new NotFoundException(msg);
      }
      throw new BadRequestException(msg);
    }
  }

  @Get('roles')
  @RequirePermissions(Permissions.USERS_VIEW)
  listRoles() {
    return {
      items: this.rbac.listRoles(),
      catalog: ALL_PERMISSIONS.map((id) => ({
        id,
        label: PERMISSION_LABELS[id],
      })),
    };
  }

  @Put('roles/:id/permissions')
  @RequirePermissions(Permissions.USERS_MANAGE)
  async updateRolePermissions(
    @Param('id') id: string,
    @Body() body: UpdateRolePermissionsDto,
  ) {
    try {
      const role = await this.rbac.setRolePermissions(id, body.permissions);
      this.auth.refreshAllSessions();
      return { ok: true, role };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bijwerken mislukt';
      if (msg.includes('niet gevonden')) {
        throw new NotFoundException(msg);
      }
      throw new BadRequestException(msg);
    }
  }
}
