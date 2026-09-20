export type StoredTicketMessage = {
  id: string;
  content: string;
  author: string;
  createdAt: string;
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
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  messages: StoredTicketMessage[];
  /** Last raw Ticket Tool payload fragment (sanitized, no secrets). */
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
  createdAt: string;
  updatedAt: string;
};

export type TicketDetail = TicketListItem & {
  categoryId: string | null;
  channelId: string | null;
  closedAt: string | null;
  messages: StoredTicketMessage[];
};
