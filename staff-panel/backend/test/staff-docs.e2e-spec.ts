import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, parseCookie } from './helpers';

describe('Staff docs RBAC (e2e)', () => {
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

  it('helper has staff_docs:read but not write → POST article returns 403', async () => {
    const cookie = await loginCookie('helper', 'CHANGE_ME');

    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', cookie)
      .expect(200);
    expect(me.body.permissions).toContain('staff_docs:read');
    expect(me.body.permissions).not.toContain('staff_docs:write');

    await request(app.getHttpServer())
      .get('/api/v1/staff-docs/categories')
      .set('Cookie', cookie)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/staff-docs/articles')
      .set('Cookie', cookie)
      .send({
        categoryId: 'cat_panel_basics',
        title: 'Hack poging',
        body: 'mag niet',
      })
      .expect(403);
  });

  it('admin with staff_docs:write can create and update article', async () => {
    const cookie = await loginCookie('admin', 'CHANGE_ME');

    const cats = await request(app.getHttpServer())
      .get('/api/v1/staff-docs/categories')
      .set('Cookie', cookie)
      .expect(200);
    expect(Array.isArray(cats.body.items)).toBe(true);
    expect(cats.body.items.length).toBeGreaterThan(0);
    const categoryId = cats.body.items[0].id as string;

    const created = await request(app.getHttpServer())
      .post('/api/v1/staff-docs/articles')
      .set('Cookie', cookie)
      .send({
        categoryId,
        title: 'Test artikel',
        body: 'Inhoud van het testartikel.',
      })
      .expect(200);

    expect(created.body.title).toBe('Test artikel');
    expect(created.body.createdBy).toBe('admin');
    expect(created.body.updatedBy).toBe('admin');

    const updated = await request(app.getHttpServer())
      .put(`/api/v1/staff-docs/articles/${created.body.id}`)
      .set('Cookie', cookie)
      .send({ title: 'Test artikel (bijgewerkt)', body: 'Nieuwe inhoud.' })
      .expect(200);

    expect(updated.body.title).toBe('Test artikel (bijgewerkt)');
    expect(updated.body.updatedBy).toBe('admin');
    expect(updated.body.updatedAt).not.toBe(created.body.updatedAt);
  });
});
