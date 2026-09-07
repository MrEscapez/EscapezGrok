import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, parseCookie } from './helpers';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  const cookieName = 'escapez_staff_session';

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('login success returns user + sets HttpOnly session cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'CHANGE_ME' })
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.user.username).toBe('admin');
    expect(Array.isArray(res.body.user.permissions)).toBe(true);
    expect(res.body.user.permissions).toContain('settings:manage');

    const sid = parseCookie(res, cookieName);
    expect(sid).toBeTruthy();
    expect(String(res.headers['set-cookie'])).toMatch(/HttpOnly/i);
  });

  it('login fail returns 401 for bad password', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'wrong-password' })
      .expect(401);

    expect(res.body.message).toBeDefined();
    expect(JSON.stringify(res.body)).not.toContain('wrong-password');
  });

  it('GET /auth/me returns 401 without cookie', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('logout clears session so /auth/me becomes 401', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'CHANGE_ME' })
      .expect(200);

    const sid = parseCookie(login, cookieName)!;
    const cookie = `${cookieName}=${sid}`;

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', cookie)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', cookie)
      .expect(401);
  });
});
