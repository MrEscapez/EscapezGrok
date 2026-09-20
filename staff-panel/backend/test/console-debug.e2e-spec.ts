import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, parseCookie } from './helpers';

describe('Console + Debug RBAC (e2e)', () => {
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

  it('admin has debug:view; helper does not', async () => {
    const adminCookie = await loginCookie('admin', 'CHANGE_ME');
    const adminMe = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', adminCookie)
      .expect(200);
    expect(adminMe.body.permissions).toContain('debug:view');
    expect(adminMe.body.permissions).toContain('console:read');

    const helperCookie = await loginCookie('helper', 'CHANGE_ME');
    const helperMe = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', helperCookie)
      .expect(200);
    expect(helperMe.body.permissions).not.toContain('debug:view');
    expect(helperMe.body.permissions).not.toContain('console:read');
  });

  it('helper cannot GET /debug/overview (403)', async () => {
    const cookie = await loginCookie('helper', 'CHANGE_ME');
    await request(app.getHttpServer())
      .get('/api/v1/debug/overview')
      .set('Cookie', cookie)
      .expect(403);
  });

  it('admin can GET /debug/overview', async () => {
    const cookie = await loginCookie('admin', 'CHANGE_ME');
    const res = await request(app.getHttpServer())
      .get('/api/v1/debug/overview')
      .set('Cookie', cookie)
      .expect(200);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('servers');
    expect(res.body).toHaveProperty('pterodactyl');
    expect(res.body).toHaveProperty('clientApiKeyConfigured');
    // Never leak secrets
    const raw = JSON.stringify(res.body);
    expect(raw).not.toMatch(/ptlc_|ptla_|password/i);
  });

  it('helper cannot GET console websocket (403)', async () => {
    const cookie = await loginCookie('helper', 'CHANGE_ME');
    await request(app.getHttpServer())
      .get('/api/v1/server/console/websocket')
      .set('Cookie', cookie)
      .expect(403);
  });

  it('admin GET console websocket without client key → stub empty state', async () => {
    const cookie = await loginCookie('admin', 'CHANGE_ME');
    const res = await request(app.getHttpServer())
      .get('/api/v1/server/console/websocket')
      .set('Cookie', cookie)
      .expect(200);
    expect(res.body.configured).toBe(false);
    expect(res.body.stub).toBe(true);
    expect(String(res.body.message || '')).toMatch(/Client API/i);
    expect(res.body.token).toBeUndefined();
    expect(res.body).not.toHaveProperty('clientApiKey');
  });

  it('helper cannot POST console command (403)', async () => {
    const cookie = await loginCookie('helper', 'CHANGE_ME');
    await request(app.getHttpServer())
      .post('/api/v1/server/console/command')
      .set('Cookie', cookie)
      .send({ command: 'list' })
      .expect(403);
  });

  it('admin POST console command without client key returns stub failure (no secret leak)', async () => {
    const cookie = await loginCookie('admin', 'CHANGE_ME');
    const res = await request(app.getHttpServer())
      .post('/api/v1/server/console/command')
      .set('Cookie', cookie)
      .send({ command: 'list' })
      .expect(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.command).toBe('list');
    const raw = JSON.stringify(res.body);
    expect(raw).not.toMatch(/ptlc_|ptla_/i);
  });
});
