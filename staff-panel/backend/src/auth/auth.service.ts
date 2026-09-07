import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { RateLimitService } from '../common/rate-limit.service';
import { Permission } from '../rbac/permissions';
import { RbacStore } from '../rbac/rbac.store';

export interface StaffSession {
  userId: string;
  username: string;
  permissions: Permission[];
  roleIds: string[];
  createdAt: string;
}

/**
 * Local-demo auth: HttpOnly cookie sessions + bcrypt against RbacStore users.
 * No JWT in localStorage. Effective permissions = union of assigned roles.
 * Rate limiting for login is handled by RateLimitGuard (FASE 16).
 */
@Injectable()
export class AuthService {
  private readonly sessions = new Map<string, StaffSession>();

  constructor(
    private readonly config: ConfigService,
    private readonly rbac: RbacStore,
    private readonly rateLimit: RateLimitService,
  ) {}

  async login(
    username: string,
    password: string,
    rateKey?: string,
  ): Promise<{ sessionId: string; session: StaffSession }> {
    const user = this.rbac.findUserByUsername(username.trim());
    let ok = false;
    if (user) {
      ok = await this.rbac.verifyPassword(user, password);
    } else {
      // Timing pad: compare against a dummy hash path via helper user or admin
      const pad = this.rbac.findUserByUsername('admin');
      if (pad) {
        await this.rbac.verifyPassword(pad, password);
      }
    }

    if (!ok || !user) {
      throw new UnauthorizedException('Ongeldige inloggegevens');
    }

    if (rateKey) {
      this.rateLimit.reset(rateKey);
    }

    const permissions = this.rbac.effectivePermissions(user.roleIds);
    const sessionId = this.createSessionId();
    const session: StaffSession = {
      userId: user.id,
      username: user.username,
      permissions,
      roleIds: [...user.roleIds],
      createdAt: new Date().toISOString(),
    };
    this.sessions.set(sessionId, session);
    return { sessionId, session };
  }

  logout(sessionId: string | undefined): void {
    if (sessionId) {
      this.sessions.delete(sessionId);
    }
  }

  getSession(sessionId: string | undefined): StaffSession | null {
    if (!sessionId) return null;
    return this.sessions.get(sessionId) ?? null;
  }

  /**
   * Refresh effective permissions on an existing session (after role edits).
   * Returns null if session gone or user deleted.
   */
  refreshSessionPermissions(sessionId: string | undefined): StaffSession | null {
    if (!sessionId) return null;
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    const user = this.rbac.getUser(session.userId);
    if (!user) {
      this.sessions.delete(sessionId);
      return null;
    }
    session.permissions = this.rbac.effectivePermissions(user.roleIds);
    session.roleIds = [...user.roleIds];
    session.username = user.username;
    this.sessions.set(sessionId, session);
    return session;
  }

  /** Invalidate all sessions for a user id (e.g. after password reset). */
  invalidateUserSessions(userId: string): void {
    for (const [sid, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.sessions.delete(sid);
      }
    }
  }

  /** Recompute permissions for every live session of a user. */
  refreshUserSessions(userId: string): void {
    for (const [sid, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.refreshSessionPermissions(sid);
      }
    }
  }

  /** After role permission matrix change — refresh all sessions. */
  refreshAllSessions(): void {
    for (const sid of [...this.sessions.keys()]) {
      this.refreshSessionPermissions(sid);
    }
  }

  cookieName(): string {
    return this.config.get<string>(
      'SESSION_COOKIE_NAME',
      'escapez_staff_session',
    );
  }

  cookieMaxAgeMs(): number {
    return Number(
      this.config.get<string>('SESSION_MAX_AGE_MS', '86400000'),
    );
  }

  /** Secure cookie when SESSION_COOKIE_SECURE=true or NODE_ENV=production. */
  cookieSecure(): boolean {
    const flag = this.config.get<string>('SESSION_COOKIE_SECURE', '');
    if (flag === 'true' || flag === '1') return true;
    if (flag === 'false' || flag === '0') return false;
    return this.config.get<string>('NODE_ENV', 'development') === 'production';
  }

  private createSessionId(): string {
    return `sess_${randomUUID()}`;
  }
}
