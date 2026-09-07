/**
 * EscapezCore heartbeat is intentionally loose JSON (server status blob).
 * ValidationPipe skips non-class bodies; controller accepts Record<string, unknown>.
 * This file documents the expected shape for future hardening.
 */
export type HeartbeatBody = {
  serverId?: string;
  status?: string;
  playersOnline?: number;
  tps?: number;
  [key: string]: unknown;
};
