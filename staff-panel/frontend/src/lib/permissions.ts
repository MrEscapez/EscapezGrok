/** Mirrors backend catalog — UI hide only; backend enforces. */
export const PERMISSIONS = {
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
  PLANNER_PUBLISH: 'planner:publish',
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_MANAGE: 'settings:manage',
  SERVER_VIEW: 'server:view',
  CONSOLE_READ: 'console:read',
  CONSOLE_WRITE: 'console:write',
  SERVER_POWER: 'server:power',
  SERVER_COMMAND: 'server:command',
  AUDIT_VIEW: 'audit:view',
  USERS_VIEW: 'users:view',
  USERS_MANAGE: 'users:manage',
} as const;

export type PermissionId = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export function can(
  permissions: string[] | undefined | null,
  permission: string,
): boolean {
  if (!permissions || permissions.length === 0) return false;
  return permissions.includes(permission);
}

export function canAny(
  permissions: string[] | undefined | null,
  required: string[],
): boolean {
  return required.some((p) => can(permissions, p));
}

export function canAll(
  permissions: string[] | undefined | null,
  required: string[],
): boolean {
  return required.every((p) => can(permissions, p));
}
