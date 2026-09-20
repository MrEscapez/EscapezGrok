import { config as loadDotenv } from 'dotenv';

loadDotenv();

function required(name: string): string {
  const v = (process.env[name] || '').trim();
  if (!v) {
    throw new Error(`Missing required env: ${name}`);
  }
  return v;
}

function optional(name: string, fallback: string): string {
  const v = (process.env[name] || '').trim();
  return v || fallback;
}

export type BridgeConfig = {
  discordToken: string;
  staffPanelUrl: string;
  bridgeSecret: string;
  ticketCategoryIds: Set<string>;
  ticketChannelPrefix: string;
};

export function loadConfig(): BridgeConfig {
  const rawCats = (process.env.TICKET_CATEGORY_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (rawCats.length === 0) {
    throw new Error(
      'TICKET_CATEGORY_IDS is required (comma-separated Discord category IDs)',
    );
  }
  return {
    discordToken: required('DISCORD_BOT_TOKEN'),
    staffPanelUrl: optional(
      'STAFF_PANEL_URL',
      'https://staff.escapez.be',
    ).replace(/\/+$/, ''),
    bridgeSecret: required('STAFF_PANEL_BRIDGE_SECRET'),
    ticketCategoryIds: new Set(rawCats),
    ticketChannelPrefix: optional('TICKET_CHANNEL_PREFIX', 'ticket-'),
  };
}
