import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { AppModule } from '../src/app.module';

export type TestApp = {
  app: INestApplication;
  dataDir: string;
};

/**
 * Boot full AppModule with isolated temp data paths and offline Core proxy.
 * No real network to :8765 — CORE_API_BASE=off by default.
 */
export async function createTestApp(
  env: Record<string, string> = {},
): Promise<TestApp> {
  const dataDir = mkdtempSync(join(tmpdir(), 'staff-panel-e2e-'));

  const defaults: Record<string, string> = {
    NODE_ENV: 'test',
    SESSION_COOKIE_NAME: 'escapez_staff_session',
    SESSION_MAX_AGE_MS: '86400000',
    SESSION_COOKIE_SECURE: 'false',
    STAFF_BOOTSTRAP_USERNAME: 'admin',
    STAFF_BOOTSTRAP_PASSWORD: 'CHANGE_ME',
    STAFF_SEED_HELPER: 'true',
    STAFF_HELPER_USERNAME: 'helper',
    STAFF_HELPER_PASSWORD: 'CHANGE_ME',
    BRIDGE_API_KEY: 'test-bridge-key',
    CORE_API_BASE: 'off',
    CORE_API_TIMEOUT_MS: '50',
    MODULES_DATA_PATH: join(dataDir, 'modules.json'),
    RBAC_DATA_PATH: join(dataDir, 'rbac.json'),
    PTERO_DATA_PATH: join(dataDir, 'ptero.json'),
    CORS_ORIGIN: 'http://localhost:5173',
  };

  for (const [k, v] of Object.entries({ ...defaults, ...env })) {
    process.env[k] = v;
  }

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();

  return { app, dataDir };
}

export function parseCookie(
  res: { headers: Record<string, unknown> },
  name: string,
): string | undefined {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [String(raw)] : [];
  for (const line of list) {
    const part = String(line).split(';')[0];
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const k = part.slice(0, eq);
    const v = part.slice(eq + 1);
    if (k === name) return v;
  }
  return undefined;
}
