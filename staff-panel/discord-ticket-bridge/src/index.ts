import {
  ChannelType,
  Client,
  GatewayIntentBits,
  Partials,
  type GuildBasedChannel,
  type TextChannel,
} from 'discord.js';
import { loadConfig } from './config';
import { StaffPanelClient } from './staff-panel-client';

const cfg = loadConfig();
const api = new StaffPanelClient(cfg);

/** Channel IDs we have successfully upserted (tracked tickets). */
const tracked = new Set<string>();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

function isTicketChannel(ch: GuildBasedChannel | null | undefined): boolean {
  if (!ch || ch.type !== ChannelType.GuildText) return false;
  const parentId = ch.parentId;
  if (!parentId || !cfg.ticketCategoryIds.has(parentId)) return false;
  const prefix = cfg.ticketChannelPrefix;
  if (prefix && !ch.name.toLowerCase().startsWith(prefix.toLowerCase())) {
    return false;
  }
  return true;
}

function looksArchived(ch: GuildBasedChannel): boolean {
  // Ticket Tool free often moves closed tickets to an archive category
  // outside our watched set, or renames with closed-/archived- prefix.
  if (ch.type !== ChannelType.GuildText) return false;
  const name = ch.name.toLowerCase();
  if (name.startsWith('closed-') || name.startsWith('archived-')) return true;
  if (ch.parentId && !cfg.ticketCategoryIds.has(ch.parentId)) {
    // Left watched category → treat as close if we were tracking it
    return tracked.has(ch.id);
  }
  return false;
}

async function upsertFromChannel(
  ch: TextChannel,
  openerId?: string | null,
  openerTag?: string | null,
): Promise<void> {
  await api.upsertTicket({
    channelId: ch.id,
    channelName: ch.name,
    guildId: ch.guildId,
    openerId: openerId ?? null,
    openerTag: openerTag ?? null,
    categoryId: ch.parentId,
  });
  tracked.add(ch.id);
}

client.once('ready', () => {
  const cats = [...cfg.ticketCategoryIds].join(', ');
  console.log(
    `[discord-ticket-bridge] Logged in as ${client.user?.tag ?? '?'}; watching categories: ${cats}; prefix="${cfg.ticketChannelPrefix}"; panel=${cfg.staffPanelUrl}`,
  );
});

client.on('channelCreate', (channel) => {
  void (async () => {
    try {
      if (!('guild' in channel) || !channel.guild) return;
      if (!isTicketChannel(channel)) return;
      const text = channel as TextChannel;
      // Best-effort opener: first permission overwrite that is a member (not @everyone / roles)
      let openerId: string | null = null;
      let openerTag: string | null = null;
      for (const ow of text.permissionOverwrites.cache.values()) {
        if (ow.type === 1 /* member */) {
          openerId = ow.id;
          try {
            const member = await text.guild.members.fetch(ow.id);
            openerTag = member.user.tag;
          } catch {
            openerTag = ow.id;
          }
          break;
        }
      }
      console.log(
        `[discord-ticket-bridge] ticket channel created: #${text.name} (${text.id})`,
      );
      await upsertFromChannel(text, openerId, openerTag);
    } catch (err) {
      console.error('[discord-ticket-bridge] channelCreate error:', err);
    }
  })();
});

client.on('messageCreate', (message) => {
  void (async () => {
    try {
      if (!message.guild || message.channel.type !== ChannelType.GuildText) {
        return;
      }
      const ch = message.channel as TextChannel;
      if (!isTicketChannel(ch) && !tracked.has(ch.id)) return;

      if (!tracked.has(ch.id) && isTicketChannel(ch)) {
        await upsertFromChannel(
          ch,
          message.author.bot ? null : message.author.id,
          message.author.bot ? null : message.author.tag,
        );
      }
      if (!tracked.has(ch.id)) return;

      const attachments = [...message.attachments.values()].map((a) => a.url);
      await api.appendMessage({
        channelId: ch.id,
        messageId: message.id,
        authorId: message.author.id,
        authorTag: message.author.tag,
        content: message.content || '',
        attachments,
        timestamp: message.createdAt.toISOString(),
        isBot: message.author.bot,
        isWebhook: Boolean(message.webhookId),
      });
    } catch (err) {
      console.error('[discord-ticket-bridge] messageCreate error:', err);
    }
  })();
});

client.on('channelDelete', (channel) => {
  void (async () => {
    try {
      const id = channel.id;
      if (!tracked.has(id)) return;
      console.log(`[discord-ticket-bridge] ticket channel deleted: ${id}`);
      await api.closeTicket({ channelId: id, reason: 'channel_deleted' });
      tracked.delete(id);
    } catch (err) {
      console.error('[discord-ticket-bridge] channelDelete error:', err);
    }
  })();
});

client.on('channelUpdate', (oldCh, newCh) => {
  void (async () => {
    try {
      if (!('guild' in newCh) || !newCh.guild) return;
      if (!tracked.has(newCh.id) && !isTicketChannel(oldCh as GuildBasedChannel)) {
        return;
      }
      if (!tracked.has(newCh.id)) return;

      if (looksArchived(newCh as GuildBasedChannel)) {
        console.log(
          `[discord-ticket-bridge] ticket archived/moved: ${newCh.id}`,
        );
        await api.closeTicket({
          channelId: newCh.id,
          reason: 'channel_archived',
        });
        tracked.delete(newCh.id);
        return;
      }

      // Name rename while still open — refresh subject
      if (
        'name' in newCh &&
        'name' in oldCh &&
        newCh.name !== oldCh.name &&
        isTicketChannel(newCh as GuildBasedChannel)
      ) {
        await upsertFromChannel(newCh as TextChannel);
      }
    } catch (err) {
      console.error('[discord-ticket-bridge] channelUpdate error:', err);
    }
  })();
});

client.login(cfg.discordToken).catch((err) => {
  console.error('[discord-ticket-bridge] login failed:', err);
  process.exit(1);
});
