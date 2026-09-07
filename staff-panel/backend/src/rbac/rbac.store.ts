import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import { dirname, isAbsolute, join } from 'path';
import {
  ALL_PERMISSIONS,
  normalizePermissions,
  Permission,
  Permissions,
} from './permissions';
import type {
  PublicStaffUser,
  RbacFileShape,
  StaffRole,
  StaffUserRecord,
} from './rbac.types';

const MODERATOR_PERMISSIONS: Permission[] = [
  Permissions.DASHBOARD_VIEW,
  Permissions.PLAYERS_VIEW,
  Permissions.PLAYERS_MANAGE,
  Permissions.REPORTS_VIEW,
  Permissions.REPORTS_MANAGE,
  Permissions.PUNISHMENTS_VIEW,
  Permissions.PUNISHMENTS_MANAGE,
  Permissions.TICKETS_VIEW,
  Permissions.TICKETS_MANAGE,
  Permissions.APPEALS_VIEW,
  Permissions.APPEALS_MANAGE,
  Permissions.PLANNER_VIEW,
  Permissions.PLANNER_MANAGE,
  Permissions.SETTINGS_VIEW,
  Permissions.SERVER_VIEW,
  Permissions.CONSOLE_READ,
  Permissions.CONSOLE_WRITE,
  Permissions.SERVER_COMMAND,
  Permissions.AUDIT_VIEW,
  Permissions.USERS_VIEW,
  // no settings:manage, users:manage, server:power, planner:publish
];

const HELPER_PERMISSIONS: Permission[] = [
  Permissions.DASHBOARD_VIEW,
  Permissions.PLAYERS_VIEW,
  Permissions.REPORTS_VIEW,
  Permissions.TICKETS_VIEW,
];

@Injectable()
export class RbacStore implements OnModuleInit {
  private readonly logger = new Logger(RbacStore.name);
  private roles = new Map<string, StaffRole>();
  private users = new Map<string, StaffUserRecord>();
  private dataPath = '';
  private ready = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.dataPath = this.resolveDataPath();
    await this.loadOrSeed();
    this.ready = true;
  }

  private resolveDataPath(): string {
    const configured = this.config.get<string>('RBAC_DATA_PATH');
    if (configured && configured.trim()) {
      return isAbsolute(configured)
        ? configured
        : join(process.cwd(), configured);
    }
    return join(process.cwd(), 'data', 'rbac.json');
  }

  isReady(): boolean {
    return this.ready;
  }

  private seedRoles(): StaffRole[] {
    return [
      {
        id: 'admin',
        name: 'Admin',
        permissions: [...ALL_PERMISSIONS],
      },
      {
        id: 'moderator',
        name: 'Moderator',
        permissions: [...MODERATOR_PERMISSIONS],
      },
      {
        id: 'helper',
        name: 'Helper',
        permissions: [...HELPER_PERMISSIONS],
      },
    ];
  }

  private async loadOrSeed(): Promise<void> {
    try {
      const raw = await readFile(this.dataPath, 'utf8');
      const parsed = JSON.parse(raw) as RbacFileShape;
      if (parsed?.version === 1 && Array.isArray(parsed.roles)) {
        this.applyFile(parsed);
        // Ensure admin role always has full catalog after upgrades
        const admin = this.roles.get('admin');
        if (admin) {
          admin.permissions = [...ALL_PERMISSIONS];
          this.roles.set('admin', admin);
        }
        await this.ensureBootstrapUsers();
        await this.persist();
        this.logger.log(`RBAC geladen uit ${this.dataPath}`);
        return;
      }
    } catch {
      // missing or invalid → seed
    }

    for (const role of this.seedRoles()) {
      this.roles.set(role.id, role);
    }
    await this.ensureBootstrapUsers();
    await this.persist();
    this.logger.log(`RBAC geseeded naar ${this.dataPath}`);
  }

  private applyFile(file: RbacFileShape): void {
    this.roles.clear();
    this.users.clear();
    for (const role of file.roles) {
      this.roles.set(role.id, {
        id: role.id,
        name: role.name,
        permissions: normalizePermissions(role.permissions ?? []),
      });
    }
    // Ensure seed role ids exist
    for (const seed of this.seedRoles()) {
      if (!this.roles.has(seed.id)) {
        this.roles.set(seed.id, seed);
      }
    }
    for (const user of file.users ?? []) {
      if (!user?.id || !user?.username || !user?.passwordHash) continue;
      this.users.set(user.id, {
        id: user.id,
        username: user.username,
        passwordHash: user.passwordHash,
        roleIds: Array.isArray(user.roleIds) ? [...user.roleIds] : [],
      });
    }
  }

  private async ensureBootstrapUsers(): Promise<void> {
    const adminUser =
      this.config.get<string>('STAFF_BOOTSTRAP_USERNAME', 'admin') || 'admin';
    const adminPass =
      this.config.get<string>('STAFF_BOOTSTRAP_PASSWORD', 'CHANGE_ME') ||
      'CHANGE_ME';

    let admin = this.findUserByUsername(adminUser);
    if (!admin) {
      const hash = await bcrypt.hash(adminPass, 10);
      admin = {
        id: `user_${randomUUID()}`,
        username: adminUser,
        passwordHash: hash,
        roleIds: ['admin'],
      };
      this.users.set(admin.id, admin);
    } else {
      // Keep admin role; refresh password hash from env only when still CHANGE_ME seed
      // Always ensure admin has admin role
      if (!admin.roleIds.includes('admin')) {
        admin.roleIds = ['admin', ...admin.roleIds.filter((r) => r !== 'admin')];
      }
      // Re-hash bootstrap password each boot so .env CHANGE_ME stays authoritative for demo
      admin.passwordHash = await bcrypt.hash(adminPass, 10);
      this.users.set(admin.id, admin);
    }

    const helperEnabled =
      (this.config.get<string>('STAFF_SEED_HELPER', 'true') || 'true')
        .toLowerCase() !== 'false';
    if (helperEnabled) {
      const helperUser =
        this.config.get<string>('STAFF_HELPER_USERNAME', 'helper') || 'helper';
      const helperPass =
        this.config.get<string>('STAFF_HELPER_PASSWORD', 'CHANGE_ME') ||
        'CHANGE_ME';
      let helper = this.findUserByUsername(helperUser);
      if (!helper) {
        const hash = await bcrypt.hash(helperPass, 10);
        helper = {
          id: `user_${randomUUID()}`,
          username: helperUser,
          passwordHash: hash,
          roleIds: ['helper'],
        };
        this.users.set(helper.id, helper);
      } else {
        helper.passwordHash = await bcrypt.hash(helperPass, 10);
        if (!helper.roleIds.includes('helper')) {
          helper.roleIds = ['helper'];
        }
        this.users.set(helper.id, helper);
      }
    }
  }

  private async persist(): Promise<void> {
    const payload: RbacFileShape = {
      version: 1,
      roles: [...this.roles.values()].map((r) => ({
        id: r.id,
        name: r.name,
        permissions: [...r.permissions],
      })),
      users: [...this.users.values()].map((u) => ({
        id: u.id,
        username: u.username,
        passwordHash: u.passwordHash,
        roleIds: [...u.roleIds],
      })),
    };
    await mkdir(dirname(this.dataPath), { recursive: true });
    const tmp = `${this.dataPath}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(payload, null, 2), 'utf8');
    await rename(tmp, this.dataPath);
  }

  listRoles(): StaffRole[] {
    return [...this.roles.values()].map((r) => ({
      id: r.id,
      name: r.name,
      permissions: [...r.permissions],
    }));
  }

  getRole(id: string): StaffRole | null {
    const r = this.roles.get(id);
    if (!r) return null;
    return {
      id: r.id,
      name: r.name,
      permissions: [...r.permissions],
    };
  }

  findUserByUsername(username: string): StaffUserRecord | null {
    const needle = username.trim().toLowerCase();
    for (const u of this.users.values()) {
      if (u.username.toLowerCase() === needle) return u;
    }
    return null;
  }

  getUser(id: string): StaffUserRecord | null {
    return this.users.get(id) ?? null;
  }

  effectivePermissions(roleIds: string[]): Permission[] {
    const set = new Set<Permission>();
    for (const rid of roleIds) {
      const role = this.roles.get(rid);
      if (!role) continue;
      for (const p of role.permissions) set.add(p);
    }
    return [...set];
  }

  toPublicUser(user: StaffUserRecord): PublicStaffUser {
    const roles = user.roleIds
      .map((id) => this.roles.get(id))
      .filter((r): r is StaffRole => !!r)
      .map((r) => ({ id: r.id, name: r.name }));
    return {
      id: user.id,
      username: user.username,
      roleIds: [...user.roleIds],
      roles,
      permissions: this.effectivePermissions(user.roleIds),
    };
  }

  listUsersPublic(): PublicStaffUser[] {
    return [...this.users.values()]
      .map((u) => this.toPublicUser(u))
      .sort((a, b) => a.username.localeCompare(b.username));
  }

  async createUser(input: {
    username: string;
    password: string;
    roleIds: string[];
  }): Promise<PublicStaffUser> {
    const username = input.username.trim();
    if (!username) {
      throw new Error('Gebruikersnaam is verplicht');
    }
    if (this.findUserByUsername(username)) {
      throw new Error('Gebruikersnaam bestaat al');
    }
    const roleIds = this.sanitizeRoleIds(input.roleIds);
    const passwordHash = await bcrypt.hash(input.password, 10);
    const user: StaffUserRecord = {
      id: `user_${randomUUID()}`,
      username,
      passwordHash,
      roleIds,
    };
    this.users.set(user.id, user);
    await this.persist();
    return this.toPublicUser(user);
  }

  async updateUser(
    id: string,
    input: { roleIds?: string[]; password?: string },
  ): Promise<PublicStaffUser> {
    const user = this.users.get(id);
    if (!user) {
      throw new Error('Gebruiker niet gevonden');
    }
    if (input.roleIds) {
      user.roleIds = this.sanitizeRoleIds(input.roleIds);
    }
    if (input.password && input.password.length > 0) {
      user.passwordHash = await bcrypt.hash(input.password, 10);
    }
    this.users.set(id, user);
    await this.persist();
    return this.toPublicUser(user);
  }

  async setRolePermissions(
    roleId: string,
    permissions: string[],
  ): Promise<StaffRole> {
    const role = this.roles.get(roleId);
    if (!role) {
      throw new Error('Rol niet gevonden');
    }
    // Admin always keeps all permissions
    if (roleId === 'admin') {
      role.permissions = [...ALL_PERMISSIONS];
    } else {
      role.permissions = normalizePermissions(permissions);
    }
    this.roles.set(roleId, role);
    await this.persist();
    return this.getRole(roleId)!;
  }

  private sanitizeRoleIds(roleIds: string[]): string[] {
    const unique = [...new Set(roleIds.filter((id) => this.roles.has(id)))];
    return unique.length > 0 ? unique : ['helper'];
  }

  async verifyPassword(
    user: StaffUserRecord,
    password: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }
}
