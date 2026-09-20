import { INestApplication } from '@nestjs/common';
import { createHmac } from 'crypto';
import request from 'supertest';
import { createTestApp, parseCookie } from './helpers';

describe('Tickets + Discord bridge + Ticket Tool webhook (e2e)', () => {
  let app: INestApplication;
  const cookieName = 'escapez_staff_session';
  const webhookSecret = 'test-webhook-secret-value';
  const bridgeSecret = 'test-discord-bridge-secret-value';

  beforeAll(async () => {
    const ctx = await createTestApp({
      TICKET_TOOL_WEBHOOK_SECRET: webhookSecret,
      DISCORD_BRIDGE_SECRET: bridgeSecret,
    });
    app = ctx.app;
  });

  afterAll(async () => {
    await app.close();
  });

  async function login(username: string, password: string) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username, password })
      .expect(200);
    const sid = parseCookie(res, cookieName);
    expect(sid).toBeTruthy();
    return `${cookieName}=${sid}`;
  }

  function sign(rawBody: string, timestamp: string): string {
    return createHmac('sha256', webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');
  }

  it('GET /tickets without tickets:view → 403', async () => {
    const adminCookie = await login('admin', 'CHANGE_ME');
    const roles = await request(app.getHttpServer())
      .get('/api/v1/roles')
      .set('Cookie', adminCookie)
      .expect(200);
    const helper = (
      roles.body.items as Array<{ id: string; permissions: string[] }>
    ).find((r) => r.id === 'helper');
    expect(helper).toBeTruthy();
    const withoutTickets = helper!.permissions.filter(
      (p) => p !== 'tickets:view' && p !== 'tickets:manage',
    );
    await request(app.getHttpServer())
      .put(`/api/v1/roles/${helper!.id}/permissions`)
      .set('Cookie', adminCookie)
      .send({ permissions: withoutTickets })
      .expect(200);

    const helperCookie = await login('helper', 'CHANGE_ME');
    await request(app.getHttpServer())
      .get('/api/v1/tickets')
      .set('Cookie', helperCookie)
      .expect(403);
  });

  it('bridge upsert rejects missing secret → 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/tickets/bridge/upsert')
      .send({
        channelId: 'ch-noauth',
        channelName: 'ticket-1',
        guildId: 'g1',
      })
      .expect(401);
  });

  it('bridge upsert rejects wrong secret → 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/tickets/bridge/upsert')
      .set('Authorization', 'Bearer wrong-secret')
      .send({
        channelId: 'ch-bad',
        channelName: 'ticket-2',
        guildId: 'g1',
      })
      .expect(401);
  });

  it('bridge upsert + message with secret; staff can list', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/tickets/bridge/upsert')
      .set('Authorization', `Bearer ${bridgeSecret}`)
      .send({
        channelId: 'ch-ok-1',
        channelName: 'ticket-99',
        guildId: 'guild-1',
        openerId: 'u-opener',
        openerTag: 'Speler#1234',
        categoryId: 'cat-1',
      })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/tickets/bridge/message')
      .set('X-Staff-Bridge-Secret', bridgeSecret)
      .send({
        channelId: 'ch-ok-1',
        messageId: 'msg-1',
        authorId: 'u-opener',
        authorTag: 'Speler#1234',
        content: 'Hallo staff',
        attachments: [],
        timestamp: new Date().toISOString(),
        isBot: false,
        isWebhook: false,
      })
      .expect(200);

    const adminCookie = await login('admin', 'CHANGE_ME');
    const list = await request(app.getHttpServer())
      .get('/api/v1/tickets')
      .set('Cookie', adminCookie)
      .expect(200);
    expect(Array.isArray(list.body.items)).toBe(true);
    const found = (
      list.body.items as Array<{
        id: string;
        subject: string;
        player: string;
        channelId: string | null;
      }>
    ).find((t) => t.id === 'ch-ok-1');
    expect(found).toBeTruthy();
    expect(found!.subject).toContain('ticket-99');
    expect(found!.player).toContain('Speler');
    expect(found!.channelId).toBe('ch-ok-1');

    const detail = await request(app.getHttpServer())
      .get('/api/v1/tickets/ch-ok-1')
      .set('Cookie', adminCookie)
      .expect(200);
    expect(detail.body.id).toBe('ch-ok-1');
    expect(detail.body.guildId).toBe('guild-1');
    expect(detail.body.channelName).toBe('ticket-99');
    expect(Array.isArray(detail.body.messages)).toBe(true);
    expect(detail.body.messages.length).toBeGreaterThanOrEqual(1);
    expect(detail.body.messages[0].content).toContain('Hallo');
  });

  it('bridge close marks ticket CLOSED', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/tickets/bridge/upsert')
      .set('Authorization', `Bearer ${bridgeSecret}`)
      .send({
        channelId: 'ch-close-1',
        channelName: 'ticket-7',
        guildId: 'guild-1',
      })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/tickets/bridge/close')
      .set('Authorization', `Bearer ${bridgeSecret}`)
      .send({ channelId: 'ch-close-1', reason: 'channel_deleted' })
      .expect(200);

    const adminCookie = await login('admin', 'CHANGE_ME');
    const detail = await request(app.getHttpServer())
      .get('/api/v1/tickets/ch-close-1')
      .set('Cookie', adminCookie)
      .expect(200);
    expect(detail.body.status).toBe('CLOSED');
    expect(detail.body.closedAt).toBeTruthy();
  });

  it('webhook rejects invalid signature', async () => {
    const rawBody = JSON.stringify({
      type: 'TICKET_CREATED',
      data: { id: 't-bad', ticketNumber: 1, subject: 'x' },
    });
    const ts = String(Math.floor(Date.now() / 1000));
    await request(app.getHttpServer())
      .post('/api/v1/tickets/webhook')
      .set('Content-Type', 'application/json')
      .set('X-TicketTool-Signature', 'deadbeef')
      .set('X-TicketTool-Timestamp', ts)
      .set('X-Webhook-Event', 'TICKET_CREATED')
      .send(rawBody)
      .expect(401);
  });

  it('webhook rejects skewed timestamp', async () => {
    const rawBody = JSON.stringify({
      type: 'TICKET_CREATED',
      data: { id: 't-skew', ticketNumber: 2, subject: 'skew' },
    });
    const ts = String(Math.floor(Date.now() / 1000) - 10_000);
    const signature = sign(rawBody, ts);
    await request(app.getHttpServer())
      .post('/api/v1/tickets/webhook')
      .set('Content-Type', 'application/json')
      .set('X-TicketTool-Signature', signature)
      .set('X-TicketTool-Timestamp', ts)
      .set('X-Webhook-Event', 'TICKET_CREATED')
      .send(rawBody)
      .expect(401);
  });

  it('webhook accepts valid signature and persists ticket; staff can list', async () => {
    const rawBody = JSON.stringify({
      type: 'TICKET_CREATED',
      data: {
        id: 't-ok-1',
        ticketNumber: 42,
        subject: 'Hulp nodig',
        status: 'OPEN',
        creator: { id: 'u1', username: 'SpelerEen' },
      },
    });
    const ts = String(Math.floor(Date.now() / 1000));
    const signature = sign(rawBody, ts);

    await request(app.getHttpServer())
      .post('/api/v1/tickets/webhook')
      .set('Content-Type', 'application/json')
      .set('X-TicketTool-Signature', signature)
      .set('X-TicketTool-Timestamp', ts)
      .set('X-Webhook-Event', 'TICKET_CREATED')
      .send(rawBody)
      .expect(200);

    const adminCookie = await login('admin', 'CHANGE_ME');
    const list = await request(app.getHttpServer())
      .get('/api/v1/tickets')
      .set('Cookie', adminCookie)
      .expect(200);
    expect(Array.isArray(list.body.items)).toBe(true);
    const found = (
      list.body.items as Array<{ id: string; subject: string }>
    ).find((t) => t.id === 't-ok-1');
    expect(found).toBeTruthy();
    expect(found!.subject).toContain('Hulp');

    const detail = await request(app.getHttpServer())
      .get('/api/v1/tickets/t-ok-1')
      .set('Cookie', adminCookie)
      .expect(200);
    expect(detail.body.id).toBe('t-ok-1');
  });

  it('settings discord-bridge never returns plaintext secret', async () => {
    const adminCookie = await login('admin', 'CHANGE_ME');
    await request(app.getHttpServer())
      .put('/api/v1/settings/discord-bridge')
      .set('Cookie', adminCookie)
      .send({
        bridgeSecret: 'super_secret_bridge_value_xyz',
      })
      .expect(200);

    const get = await request(app.getHttpServer())
      .get('/api/v1/settings/discord-bridge')
      .set('Cookie', adminCookie)
      .expect(200);

    const body = JSON.stringify(get.body);
    expect(body).not.toContain('super_secret_bridge_value_xyz');
    expect(get.body.configured).toBe(true);
    expect(get.body.secretHint).toBeTruthy();
    expect(get.body.helpNl).toBeTruthy();
  });

  it('settings ticket-tool never returns plaintext secrets', async () => {
    const adminCookie = await login('admin', 'CHANGE_ME');
    await request(app.getHttpServer())
      .put('/api/v1/settings/ticket-tool')
      .set('Cookie', adminCookie)
      .send({
        apiToken: 'tt_super_secret_token_value',
        webhookSecret: 'whsec_another_secret_value',
      })
      .expect(200);

    const get = await request(app.getHttpServer())
      .get('/api/v1/settings/ticket-tool')
      .set('Cookie', adminCookie)
      .expect(200);

    const body = JSON.stringify(get.body);
    expect(body).not.toContain('tt_super_secret_token_value');
    expect(body).not.toContain('whsec_another_secret_value');
    expect(get.body.apiTokenConfigured).toBe(true);
    expect(get.body.webhookSecretConfigured).toBe(true);
    expect(get.body.apiTokenHint).toBeTruthy();
  });
});
