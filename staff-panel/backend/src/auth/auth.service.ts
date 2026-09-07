import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { ALL_PERMISSIONS, Permission } from '../rbac/permissions';

export interface StaffSession {
  userId: string;
  username: string;
  permissions: Permission[];
  createdAt: string;
}

/**
 * Local-demo auth: HttpOnly cookie sessions + bcrypt against bootstrap stub.
 * No JWT in localStorage. Real user store (Postgres) comes later.
 */
@Injectable()
export class AuthService implements OnModuleInit {
  private readonly sessions = new Map<string, StaffSession>();
  private bootstrapUsername = 'admin';
  private bootstrapPasswordHash = '';

  /** Simple in-memory rate limit: IP/username → attempts */
  private readonly loginAttempts = new Map<
    string,
    { count: number; resetAt: number }
  >();
  private readonly maxAttempts = 10;
  private readonly windowMs = 60_000;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.bootstrapUsername = this.config.get<string>(
      'STAFF_BOOTSTRAP_USERNAME',
      'admin',
    );
    const plaintext = this.config.get<string>(
      'STAFF_BOOTSTRAP_PASSWORD',
      'CHANGE_ME',
    );
    // Hash once at boot into memory — do not commit real secrets
    this.bootstrapPasswordHash = await bcrypt.hash(plaintext, 10);
  }

  assertNotRateLimited(key: string): void {
    const now = Date.now();
    const entry = this.loginAttempts.get(key);
    if (!entry || now > entry.resetAt) {
      this.loginAttempts.set(key, {
        count: 0,
        resetAt: now + this.windowMs,
      });
      return;
    }
    if (entry.count >= this.maxAttempts) {
      throw new UnauthorizedException(
        'Te veel pogingen. Probeer later opnieuw.',
      );
    }
  }

  private recordAttempt(key: string, success: boolean): void {
    const now = Date.now();
    const entry = this.loginAttempts.get(key) ?? {
      count: 0,
      resetAt: now + this.windowMs,
    };
    if (now > entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + this.windowMs;
    }
    if (success) {
      this.loginAttempts.delete(key);
      return;
    }
    entry.count += 1;
    this.loginAttempts.set(key, entry);
  }

  async verifyBootstrapCredentials(
    username: string,
    password: string,
  ): Promise<boolean> {
    if (!username || !password) return false;
    if (username !== this.bootstrapUsername) {
      // Still run compare to keep timing roughly similar
      await bcrypt.compare(password, this.bootstrapPasswordHash);
      return false;
    }
    return bcrypt.compare(password, this.bootstrapPasswordHash);
  }

  async login(
    username: string,
    password: string,
    rateKey = 'global',
  ): Promise<{ sessionId: string; session: StaffSession }> {
    this.assertNotRateLimited(rateKey);
    const ok = await this.verifyBootstrapCredentials(username, password);
    this.recordAttempt(rateKey, ok);
    if (!ok) {
      throw new UnauthorizedException('Ongeldige inloggegevens');
    }

    const sessionId = this.createSessionId();
    const session: StaffSession = {
      userId: `stub-${username}`,
      username,
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
    return `sess_${randomUUID()}`;
  }
}
