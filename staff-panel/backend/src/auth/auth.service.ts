import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ALL_PERMISSIONS, Permission } from '../rbac/permissions';

export interface StaffSession {
  userId: string;
  username: string;
  permissions: Permission[];
  createdAt: string;
}

/**
 * Skeleton auth service.
 * - Password verify is stubbed (accepts any non-empty password for local skeleton).
 * - Structure is ready for bcrypt/argon2id later (bcrypt dependency present).
 * - Sessions are in-memory stubs; real store (Redis/Postgres) comes later.
 * - Cookies are HttpOnly via controller — never JWT in localStorage.
 */
@Injectable()
export class AuthService {
  /** In-memory session store — skeleton only */
  private readonly sessions = new Map<string, StaffSession>();

  constructor(private readonly config: ConfigService) {}

  /**
   * Stub password verification.
   * Production: compare with bcrypt/argon2id hash from DB.
   */
  async verifyPasswordStub(
    _username: string,
    password: string,
  ): Promise<boolean> {
    // Skeleton: require non-empty password. Replace with bcrypt.compare / argon2.verify.
    void _username;
    return Boolean(password && password.length > 0);
  }

  async login(
    username: string,
    password: string,
  ): Promise<{ sessionId: string; session: StaffSession }> {
    const ok = await this.verifyPasswordStub(username, password);
    if (!ok) {
      throw new UnauthorizedException('Ongeldige inloggegevens');
    }

    const sessionId = this.createSessionId();
    const session: StaffSession = {
      userId: `stub-${username}`,
      username,
      // Skeleton: grant all permissions for local UI wiring
      permissions: [...ALL_PERMISSIONS],
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

  private createSessionId(): string {
    // Skeleton random id — replace with crypto.randomUUID / secure store later
    return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  }
}
