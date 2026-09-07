import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, parseCookie } from './helpers';

describe('RBAC settings:manage (e2e)', () => {
  let app: INestApplication;
  const cookieName = 'escapez_staff_session';

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
  });

  afterAll(async () => {
    await app.close();
  });

  async function loginCookie(username: string, password: string) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username, password })
      .expect(200);
    const sid = parseCookie(res, cookieName);
    expect(sid).toBeTruthy();
    return `${cookieName}=${sid}`;
  }

  it('helper lacks settings:manage → PATCH modules returns 403', async () => {
    const cookie = await loginCookie('helper', 'CHANGE_ME');

    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', cookie)
      .expect(200);
    expect(me.body.permissions).not.toContain('settings:manage');

    await request(app.getHttpServer())
      .patch('/api/v1/settings/modules/tips')
      .set('Cookie', cookie)
      .send({ enabled: false })
      .expect(403);
  });

  it('admin with settings:manage is allowed to PATCH modules', async () => {
    const cookie = await loginCookie('admin', 'CHANGE_ME');

    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', cookie)
      .expect(200);
    expect(me.body.permissions).toContain('settings:manage');

    const res = await request(app.getHttpServer())
      .patch('/api/v1/settings/modules/tips')
      .set('Cookie', cookie)
      .send({ enabled: false })
      .expect(200);

    expect(res.body.id).toBe('tips');
    expect(res.body.enabled).toBe(false);
    expect(['pending', 'local', 'core']).toContain(res.body.source);
  });
});
