/**
 * EscapezCraft Staff Panel — RBAC permission constants (FASE 11–12 skeleton).
 * Real enforcement / DB roles come later.
 */
export const Permissions = {
  DASHBOARD_VIEW: 'dashboard:view',
  PLAYERS_VIEW: 'players:view',
  PLAYERS_MANAGE: 'players:manage',
  REPORTS_VIEW: 'reports:view',
  REPORTS_MANAGE: 'reports:manage',
  PUNISHMENTS_VIEW: 'punishments:view',
  PUNISHMENTS_MANAGE: 'punishments:manage',
  TICKETS_VIEW: 'tickets:view',
  TICKETS_MANAGE: 'tickets:manage',
  APPEALS_VIEW: 'appeals:view',
  APPEALS_MANAGE: 'appeals:manage',
  PLANNER_VIEW: 'planner:view',
  PLANNER_MANAGE: 'planner:manage',
  SERVER_VIEW: 'server:view',
  SERVER_MANAGE: 'server:manage',
  AUDIT_VIEW: 'audit:view',
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_MANAGE: 'settings:manage',
  USERS_VIEW: 'users:view',
  USERS_MANAGE: 'users:manage',
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];

export const ALL_PERMISSIONS: Permission[] = Object.values(Permissions);
