import {
  Controller,
  MessageEvent,
  Req,
  Sse,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, interval, map, merge, takeUntil, Subject } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { BridgeService } from '../bridge/bridge.service';

/**
 * Server-Sent Events stream for staff browsers (cookie session required).
 * GET /api/v1/realtime/stream
 */
@Controller('realtime')
export class RealtimeController {
  constructor(
    private readonly auth: AuthService,
    private readonly bridge: BridgeService,
  ) {}

  @Sse('stream')
  stream(@Req() req: Request): Observable<MessageEvent> {
    const sessionId = req.cookies?.[this.auth.cookieName()] as
      | string
      | undefined;
    const session = this.auth.getSession(sessionId);
    if (!session) {
      throw new UnauthorizedException('Niet ingelogd');
    }

    const close$ = new Subject<void>();
    req.on('close', () => {
      close$.next();
      close$.complete();
    });

    const recent = this.bridge.getRecentEvents(20).map(
      (event): MessageEvent => ({
        data: {
          kind: 'event',
          data: event,
          at: event.timestamp,
          replay: true,
        },
      }),
    );

    const heartbeatStatus = this.bridge.getLastHeartbeat();
    const bootstrap: MessageEvent[] = [
      {
        data: {
          kind: 'hello',
          data: {
            username: session.username,
            bufferSize: this.bridge.getBufferSize(),
            lastHeartbeat: heartbeatStatus,
          },
          at: new Date().toISOString(),
        },
      },
      ...recent,
    ];

    const live$ = this.bridge.getRealtimeStream().pipe(
      map(
        (msg): MessageEvent => ({
          data: msg,
        }),
      ),
    );

    const ping$ = interval(25_000).pipe(
      map(
        (): MessageEvent => ({
          data: {
            kind: 'ping',
            data: null,
            at: new Date().toISOString(),
          },
        }),
      ),
    );

    const bootstrap$ = new Observable<MessageEvent>((subscriber) => {
      for (const msg of bootstrap) {
        subscriber.next(msg);
      }
      subscriber.complete();
    });

    return merge(bootstrap$, live$, ping$).pipe(takeUntil(close$));
  }
}
