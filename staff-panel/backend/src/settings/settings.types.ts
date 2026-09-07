/** Stable EscapezCore module ids — do not invent extras in the staff contract. */
export const MODULE_IDS = [
  'scoreboard',
  'tips',
  'vote',
  'resourcepack',
  'reports',
  'staffchat',
  'items',
] as const;

export type ModuleId = (typeof MODULE_IDS)[number];

/** Where the enabled flag is considered authoritative / sync state. */
export type ModuleSource = 'local' | 'core' | 'pending';

export type SyncStatus = 'synced' | 'pending' | 'local';

export type ModuleStatus = {
  id: ModuleId;
  label: string;
  enabled: boolean;
  source: ModuleSource;
};

export type ModulePatchResult = ModuleStatus & {
  syncStatus: SyncStatus;
  softReload: true;
  note: string;
};

export type ModulesFileShape = {
  modules: Array<{
    id: ModuleId;
    enabled: boolean;
    source: ModuleSource;
  }>;
  updatedAt?: string;
};

export const MODULE_CATALOG: ReadonlyArray<{
  id: ModuleId;
  label: string;
  description: string;
  defaultEnabled: boolean;
}> = [
  {
    id: 'scoreboard',
    label: 'Scoreboard',
    description: 'Sidebar-scoreboard voor spelers.',
    defaultEnabled: true,
  },
  {
    id: 'tips',
    label: 'Tips',
    description: 'Periodieke tips in chat.',
    defaultEnabled: true,
  },
  {
    id: 'vote',
    label: 'Vote-herinnering',
    description: 'Herinneringen om te stemmen.',
    defaultEnabled: true,
  },
  {
    id: 'resourcepack',
    label: 'Resourcepack',
    description: 'Resourcepack-aanbod / enforce.',
    defaultEnabled: true,
  },
  {
    id: 'reports',
    label: 'Reports',
    description: 'In-game report-systeem.',
    defaultEnabled: true,
  },
  {
    id: 'staffchat',
    label: 'Staffchat',
    description: 'Staff-only chatkanaal.',
    defaultEnabled: true,
  },
  {
    id: 'items',
    label: 'Custom items',
    description: 'Custom items / item-API.',
    defaultEnabled: true,
  },
];

export function isModuleId(value: string): value is ModuleId {
  return (MODULE_IDS as readonly string[]).includes(value);
}
