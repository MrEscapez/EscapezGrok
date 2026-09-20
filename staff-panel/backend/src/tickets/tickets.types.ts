export type StoredTicketMessage = {
  id: string;
  content: string;
  author: string;
  authorId?: string | null;
  createdAt: string;
  attachments?: string[];
  isBot?: boolean;
  isWebhook?: boolean;
};

export type StoredTicket = {
  id: string;
  ticketNumber: number | null;
  subject: string;
  player: string;
  status: string;
  priority: string | null;
  claimedBy: string | null;
  categoryId: string | null;
  channelId: string | null;
  guildId?: string | null;
  channelName?: string | null;
  openerId?: string | null;
  /** discord-bridge | ticket-tool | unknown */
  source?: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  messages: StoredTicketMessage[];
  /** Last raw payload fragment (sanitized, no secrets). */
  raw?: Record<string, unknown>;
};

export type TicketsFileShape = {
  updatedAt: string;
  tickets: StoredTicket[];
};

export type TicketListItem = {
  id: string;
  subject: string;
  player: string;
  status: string;
  ticketNumber: number | null;
  claimedBy: string | null;
  priority: string | null;
  channelId: string | null;
  channelName: string | null;
  source: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TicketDetail = TicketListItem & {
  categoryId: string | null;
  guildId: string | null;
  openerId: string | null;
  closedAt: string | null;
  messages: StoredTicketMessage[];
};
