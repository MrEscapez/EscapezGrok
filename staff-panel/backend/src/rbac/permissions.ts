/**
 * EscapezCraft Staff Panel — RBAC permission catalog (granular).
 * Backend enforces these via PermissionsGuard; frontend only hides UI.
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
  PLANNER_PUBLISH: 'planner:publish',

  SETTINGS_VIEW: 'settings:view',
  SETTINGS_MANAGE: 'settings:manage',

  SERVER_VIEW: 'server:view',
  /** Read console / safe-command list (alias of console:read) */
  CONSOLE_READ: 'console:read',
  /** Write / send console output context (alias of console:write) */
  CONSOLE_WRITE: 'console:write',
  /** Power actions: start / stop / restart */
  SERVER_POWER: 'server:power',
  /** Send RCON / console commands */
  SERVER_COMMAND: 'server:command',

  AUDIT_VIEW: 'audit:view',

  USERS_VIEW: 'users:view',
  USERS_MANAGE: 'users:manage',
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];

export const ALL_PERMISSIONS: Permission[] = Object.values(Permissions);

/** Human-readable Dutch labels for UI matrices */
export const PERMISSION_LABELS: Record<Permission, string> = {
  'dashboard:view': 'Dashboard bekijken',
  'players:view': 'Spelers bekijken',
  'players:manage': 'Spelers beheren',
  'reports:view': 'Reports bekijken',
  'reports:manage': 'Reports beheren',
  'punishments:view': 'Straffen bekijken',
  'punishments:manage': 'Straffen beheren',
  'tickets:view': 'Tickets bekijken',
  'tickets:manage': 'Tickets beheren',
  'appeals:view': 'Appeals bekijken',
  'appeals:manage': 'Appeals beheren',
  'planner:view': 'Planner bekijken',
  'planner:manage': 'Planner beheren',
  'planner:publish': 'Planner publiceren',
  'settings:view': 'Instellingen bekijken',
  'settings:manage': 'Instellingen beheren',
  'server:view': 'Server status bekijken',
  'console:read': 'Console lezen',
  'console:write': 'Console schrijven',
  'server:power': 'Server power (start/stop/restart)',
  'server:command': 'RCON / console-commando’s',
  'audit:view': 'Auditlog bekijken',
  'users:view': 'Gebruikers bekijken',
  'users:manage': 'Gebruikers & rollen beheren',
};

/**
 * Map legacy permission strings (FASE 11–15) onto the current catalog.
 * Used when loading persisted rbac.json that may still contain old ids.
 */
export const LEGACY_PERMISSION_MAP: Record<string, Permission[]> = {
  'server:manage': [
    Permissions.SERVER_VIEW,
    Permissions.CONSOLE_READ,
    Permissions.CONSOLE_WRITE,
    Permissions.SERVER_COMMAND,
  ],
  'server:restart': [Permissions.SERVER_POWER],
  'server:console:read': [Permissions.CONSOLE_READ],
  'server:console:write': [Permissions.CONSOLE_WRITE],
};

/** Expand a list that may contain legacy ids into current Permission ids. */
export function normalizePermissions(raw: string[]): Permission[] {
  const out = new Set<Permission>();
  const known = new Set<string>(ALL_PERMISSIONS);
  for (const p of raw) {
    if (known.has(p)) {
      out.add(p as Permission);
      continue;
    }
    const mapped = LEGACY_PERMISSION_MAP[p];
    if (mapped) {
      for (const m of mapped) out.add(m);
    }
  }
  return [...out];
}

export function isPermission(value: string): value is Permission {
  return (ALL_PERMISSIONS as string[]).includes(value);
}
