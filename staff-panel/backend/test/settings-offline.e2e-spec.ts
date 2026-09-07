import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, parseCookie } from './helpers';

describe('Settings Core proxy offline (e2e)', () => {
  const cookieName = 'escapez_staff_session';
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  async function loginAdmin(app: INestApplication) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'CHANGE_ME' })
      .expect(200);
    return `${cookieName}=${parseCookie(res, cookieName)}`;
  }

  it('CORE_API_BASE=off → GET/PATCH work locally with pending/local source', async () => {
    const ctx = await createTestApp({ CORE_API_BASE: 'off' });
    const app = ctx.app;
    try {
      const cookie = await loginAdmin(app);

      const list = await request(app.getHttpServer())
        .get('/api/v1/settings/modules')
        .set('Cookie', cookie)
        .expect(200);

      expect(Array.isArray(list.body.modules)).toBe(true);
      expect(list.body.modules.length).toBeGreaterThan(0);
      for (const m of list.body.modules) {
        expect(['local', 'pending', 'core']).toContain(m.source);
      }

      const patched = await request(app.getHttpServer())
        .patch('/api/v1/settings/modules/scoreboard')
        .set('Cookie', cookie)
        .send({ enabled: true })
        .expect(200);

      expect(patched.body.id).toBe('scoreboard');
      expect(patched.body.enabled).toBe(true);
      expect(patched.body.syncStatus).toBe('pending');
      expect(patched.body.source).toBe('pending');
      expect(String(patched.body.note)).toMatch(/proxy uitgeschakeld|CORE_API_BASE=off/i);
    } finally {
      await app.close();
    }
  });

  it('mock fetch failure → PATCH still persists locally with pending', async () => {
    const ctx = await createTestApp({
      CORE_API_BASE: 'http://127.0.0.1:8765',
      CORE_API_TIMEOUT_MS: '100',
    });
    const app = ctx.app;

    global.fetch = jest.fn(async () => {
      throw new Error('network down (mocked)');
    }) as unknown as typeof fetch;

    try {
      const cookie = await loginAdmin(app);

      const list = await request(app.getHttpServer())
        .get('/api/v1/settings/modules')
        .set('Cookie', cookie)
        .expect(200);
      expect(list.body.modules.length).toBeGreaterThan(0);

      const patched = await request(app.getHttpServer())
        .patch('/api/v1/settings/modules/vote')
        .set('Cookie', cookie)
        .send({ enabled: false })
        .expect(200);

      expect(patched.body.id).toBe('vote');
      expect(patched.body.enabled).toBe(false);
      expect(patched.body.syncStatus).toBe('pending');
      expect(patched.body.source).toBe('pending');
      expect(String(patched.body.note)).toMatch(/onbereikbaar|pending|offline/i);

      expect(global.fetch).toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
