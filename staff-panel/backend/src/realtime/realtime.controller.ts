import {
  Controller,
  MessageEvent,
  Req,
  Sse,
} from '@nestjs/common';
import { Observable, interval, map, merge, takeUntil, Subject } from 'rxjs';
import { Permissions } from '../rbac/permissions';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import type { StaffRequest } from '../rbac/staff-request';
import { BridgeService } from '../bridge/bridge.service';

/**
 * Server-Sent Events stream for staff browsers (cookie session required).
 * GET /api/v1/realtime/stream
 */
@Controller('realtime')
export class RealtimeController {
  constructor(private readonly bridge: BridgeService) {}

  @Sse('stream')
  @RequirePermissions(Permissions.DASHBOARD_VIEW)
  stream(@Req() req: StaffRequest): Observable<MessageEvent> {
    const session = req.staffSession!;

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
