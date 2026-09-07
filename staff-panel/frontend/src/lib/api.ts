/** API base — publieke URL alleen; nooit secrets in de client */
export const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? '/api/v1';

export type StaffUser = {
  id: string;
  username: string;
  permissions: string[];
  roleIds?: string[];
};

export type HealthStatus = {
  status: string;
  service: string;
  timestamp: string;
};

export type PlayerItem = {
  id: string;
  username: string;
  uuid: string | null;
};

export type PlayersResponse = {
  items: PlayerItem[];
  query: string;
};

export type ReportItem = {
  id: string;
  player: string;
  reason: string;
  status: string;
  createdAt: string;
};

export type ReportsResponse = {
  items: ReportItem[];
};

export type PunishmentItem = {
  id: string;
  player: string;
  type: 'ban' | 'mute' | 'warn' | string;
  reason: string;
  staff: string;
  until: string | null;
  status: string;
};

export type PunishmentsResponse = {
  items: PunishmentItem[];
};

export type TicketItem = {
  id: string;
  subject: string;
  player: string;
  status: string;
  createdAt: string;
};

export type TicketsResponse = {
  items: TicketItem[];
};

export type BridgeHeartbeat = {
  receivedAt: string;
  body: Record<string, unknown>;
};

export type BridgeStatus = {
  lastHeartbeat: BridgeHeartbeat | null;
  bufferSize: number;
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export function apiUrl(path: string): string {
  const base = API_BASE_URL.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as {
      message?: string | string[];
    };
    if (Array.isArray(data.message)) return data.message.join(', ');
    if (typeof data.message === 'string') return data.message;
  } catch {
    /* ignore */
  }
  return res.statusText || 'Onbekende fout';
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    throw new ApiError(res.status, await parseError(res));
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export function fetchMe(): Promise<StaffUser> {
  return apiFetch<StaffUser>('/auth/me');
}

export function fetchHealth(): Promise<HealthStatus> {
  return apiFetch<HealthStatus>('/health');
}

export function fetchPlayers(q: string): Promise<PlayersResponse> {
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  const qs = params.toString();
  return apiFetch<PlayersResponse>(`/players${qs ? `?${qs}` : ''}`);
}

export function fetchReports(): Promise<ReportsResponse> {
  return apiFetch<ReportsResponse>('/reports');
}

export function login(
  username: string,
  password: string,
): Promise<{ ok: boolean; user: StaffUser }> {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function logout(): Promise<{ ok: boolean }> {
  return apiFetch('/auth/logout', { method: 'POST' });
}

export function fetchPunishments(): Promise<PunishmentsResponse> {
  return apiFetch<PunishmentsResponse>('/punishments');
}

export function fetchTickets(): Promise<TicketsResponse> {
  return apiFetch<TicketsResponse>('/tickets');
}

export function fetchBridgeStatus(): Promise<BridgeStatus> {
  return apiFetch<BridgeStatus>('/bridge/status');
}

/** SSE URL via Vite proxy — same origin so EventSource sends cookies */
export function realtimeStreamUrl(): string {
  return apiUrl('/realtime/stream');
}

export type ShiftType = "EARLY" | "DAY" | "LATE" | "NIGHT" | "OFF";
export type ScheduleStatus = "DRAFT" | "PUBLISHED";
export type ValidationLevel = "OK" | "WARNING" | "ERROR";

export type PlannerShift = {
  id: string;
  staffUserId: string;
  staffName: string;
  date: string;
  type: ShiftType;
  startTime?: string;
  endTime?: string;
};

export type ChangelogEntry = {
  at: string;
  action: string;
  by: string;
  detail?: string;
};

export type PlannerSchedule = {
  id: string;
  weekStart: string;
  status: ScheduleStatus;
  version: number;
  shifts: PlannerShift[];
  updatedAt: string;
  changelog: ChangelogEntry[];
  holidayExceptions: string[];
};

export type SchedulesResponse = {
  items: PlannerSchedule[];
};

export type ValidationResult = {
  rule: string;
  level: ValidationLevel;
  message: string;
};

export type ValidateResponse = {
  results: ValidationResult[];
};

export function fetchPlannerSchedules(
  weekStart?: string,
): Promise<SchedulesResponse> {
  const params = new URLSearchParams();
  if (weekStart) params.set("weekStart", weekStart);
  const qs = params.toString();
  return apiFetch<SchedulesResponse>(
    `/planner/schedules${qs ? `?${qs}` : ""}`,
  );
}

export function fetchPlannerSchedule(id: string): Promise<PlannerSchedule> {
  return apiFetch<PlannerSchedule>(`/planner/schedules/${id}`);
}

export function createPlannerSchedule(
  weekStart: string,
): Promise<PlannerSchedule> {
  return apiFetch<PlannerSchedule>("/planner/schedules", {
    method: "POST",
    body: JSON.stringify({ weekStart }),
  });
}

export function updatePlannerShifts(
  id: string,
  version: number,
  shifts: PlannerShift[],
): Promise<PlannerSchedule> {
  return apiFetch<PlannerSchedule>(`/planner/schedules/${id}/shifts`, {
    method: "PUT",
    body: JSON.stringify({ version, shifts }),
  });
}

export function validatePlannerSchedule(
  id: string,
): Promise<ValidateResponse> {
  return apiFetch<ValidateResponse>(`/planner/schedules/${id}/validate`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function publishPlannerSchedule(id: string): Promise<PlannerSchedule> {
  return apiFetch<PlannerSchedule>(`/planner/schedules/${id}/publish`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function revertPlannerToDraft(id: string): Promise<PlannerSchedule> {
  return apiFetch<PlannerSchedule>(`/planner/schedules/${id}/draft`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export type ModuleSource = 'local' | 'core' | 'pending';
export type SyncStatus = 'synced' | 'pending' | 'local';

export type ModuleStatus = {
  id: string;
  label: string;
  enabled: boolean;
  source: ModuleSource;
};

export type ModulesResponse = {
  modules: ModuleStatus[];
};

export type ModulePatchResponse = ModuleStatus & {
  syncStatus: SyncStatus;
  softReload: true;
  note: string;
};

export function fetchSettingsModules(): Promise<ModulesResponse> {
  return apiFetch<ModulesResponse>('/settings/modules');
}

export function patchSettingsModule(
  id: string,
  enabled: boolean,
): Promise<ModulePatchResponse> {
  return apiFetch<ModulePatchResponse>(`/settings/modules/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  });
}

export type ServerPower = 'online' | 'offline' | 'unknown';
export type ServerStatusSource = 'rcon' | 'ptero' | 'stub';

export type ServerStatus = {
  power: ServerPower;
  playersOnline?: number;
  maxPlayers?: number;
  source: ServerStatusSource;
  pterodactyl?: { state: string };
  rconConfigured: boolean;
  pteroConfigured: boolean;
  stub: boolean;
  message?: string;
};

export type ServerPowerAction = 'start' | 'stop' | 'restart';

export type ServerPowerResult = {
  ok: boolean;
  stub: boolean;
  action: string;
  message: string;
  pteroConfigured: boolean;
};

export type ServerRconResult = {
  ok: boolean;
  stub: boolean;
  connected: boolean;
  command: string;
  response?: string;
  message: string;
  requiredConfirm?: boolean;
};

export type SafeCommandsResponse = {
  commands: string[];
};

/** Never log passwords / RCON secrets — body is command text only. */
export function fetchServerStatus(): Promise<ServerStatus> {
  return apiFetch<ServerStatus>('/server/status');
}

export function fetchSafeRconCommands(): Promise<SafeCommandsResponse> {
  return apiFetch<SafeCommandsResponse>('/server/rcon/safe-commands');
}

export function postServerPower(
  action: ServerPowerAction,
  confirm: true,
  serverIdentifier?: string,
): Promise<ServerPowerResult> {
  const body: {
    action: ServerPowerAction;
    confirm: true;
    serverIdentifier?: string;
  } = { action, confirm };
  if (serverIdentifier) body.serverIdentifier = serverIdentifier;
  return apiFetch<ServerPowerResult>('/server/power', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function postServerRcon(
  command: string,
  confirm?: boolean,
): Promise<ServerRconResult> {
  const body: { command: string; confirm?: boolean } = { command };
  if (confirm === true) body.confirm = true;
  return apiFetch<ServerRconResult>('/server/rcon', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export type PteroServerSummary = {
  id: number | string;
  identifier: string;
  uuid: string;
  name: string;
  description: string;
  suspended: boolean;
  status: string | null;
  node?: number | string;
  power: 'running' | 'starting' | 'stopping' | 'offline' | 'unknown';
  playersOnline?: number;
  maxPlayers?: number;
};

export type ServerListResponse = {
  configured: boolean;
  stub: boolean;
  items: PteroServerSummary[];
  message?: string;
};

export type PteroPublicConfig = {
  configured: boolean;
  baseUrlConfigured: boolean;
  baseUrlHost: string | null;
  apiKeyConfigured: boolean;
  apiKeyHint: string | null;
  clientApiKeyConfigured: boolean;
  clientApiKeyHint: string | null;
  defaultServerIdConfigured: boolean;
  defaultServerIdHint: string | null;
  source: 'file' | 'env' | 'none';
};

export type PteroTestResult = {
  ok: boolean;
  stub: boolean;
  message: string;
  httpStatus?: number;
  serverCount?: number;
};

export type PteroConfigSaveInput = {
  baseUrl?: string;
  /** Write-only — omit to keep existing; never log this value. */
  apiKey?: string;
  clientApiKey?: string;
  defaultServerId?: string;
  clearApiKey?: boolean;
  clearClientApiKey?: boolean;
};

export function fetchServerList(): Promise<ServerListResponse> {
  return apiFetch<ServerListResponse>('/server/list');
}

export function fetchPteroSettings(): Promise<PteroPublicConfig> {
  return apiFetch<PteroPublicConfig>('/settings/pterodactyl');
}

/** Never log apiKey / clientApiKey values. */
export function savePteroSettings(
  input: PteroConfigSaveInput,
): Promise<PteroPublicConfig> {
  const body: PteroConfigSaveInput = {};
  if (typeof input.baseUrl === 'string') body.baseUrl = input.baseUrl;
  if (typeof input.apiKey === 'string' && input.apiKey.trim()) {
    body.apiKey = input.apiKey.trim();
  }
  if (typeof input.clientApiKey === 'string' && input.clientApiKey.trim()) {
    body.clientApiKey = input.clientApiKey.trim();
  }
  if (typeof input.defaultServerId === 'string') {
    body.defaultServerId = input.defaultServerId;
  }
  if (input.clearApiKey) body.clearApiKey = true;
  if (input.clearClientApiKey) body.clearClientApiKey = true;
  return apiFetch<PteroPublicConfig>('/settings/pterodactyl', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function testPteroConnection(): Promise<PteroTestResult> {
  return apiFetch<PteroTestResult>('/settings/pterodactyl/test', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}


export type StaffRole = {
  id: string;
  name: string;
  permissions: string[];
};

export type StaffUserListItem = {
  id: string;
  username: string;
  roleIds: string[];
  roles: Array<{ id: string; name: string }>;
  permissions: string[];
};

export type UsersListResponse = {
  items: StaffUserListItem[];
};

export type RolesListResponse = {
  items: StaffRole[];
  catalog: Array<{ id: string; label: string }>;
};

export function fetchStaffUsers(): Promise<UsersListResponse> {
  return apiFetch<UsersListResponse>('/users');
}

export function createStaffUser(input: {
  username: string;
  password: string;
  roleIds: string[];
}): Promise<{ ok: boolean; user: StaffUserListItem }> {
  return apiFetch('/users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateStaffUser(
  id: string,
  input: { roleIds?: string[]; password?: string },
): Promise<{ ok: boolean; user: StaffUserListItem }> {
  return apiFetch(`/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function fetchRoles(): Promise<RolesListResponse> {
  return apiFetch<RolesListResponse>('/roles');
}

export function updateRolePermissions(
  id: string,
  permissions: string[],
): Promise<{ ok: boolean; role: StaffRole }> {
  return apiFetch(`/roles/${encodeURIComponent(id)}/permissions`, {
    method: 'PUT',
    body: JSON.stringify({ permissions }),
  });
}
