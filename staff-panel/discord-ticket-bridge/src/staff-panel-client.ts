import type { BridgeConfig } from './config';

export type UpsertPayload = {
  channelId: string;
  channelName: string;
  guildId: string;
  openerId?: string | null;
  openerTag?: string | null;
  categoryId?: string | null;
};

export type MessagePayload = {
  channelId: string;
  messageId: string;
  authorId: string;
  authorTag: string;
  content: string;
  attachments: string[];
  timestamp: string;
  isBot: boolean;
  isWebhook: boolean;
};

export type ClosePayload = {
  channelId: string;
  reason?: string;
};

export class StaffPanelClient {
  constructor(private readonly cfg: BridgeConfig) {}

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.cfg.bridgeSecret}`,
      'X-Staff-Bridge-Secret': this.cfg.bridgeSecret,
      Accept: 'application/json',
    };
  }

  private async post(path: string, body: unknown): Promise<void> {
    const url = `${this.cfg.staffPanelUrl}/api/v1${path}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `Staff Panel ${path} → HTTP ${res.status}: ${text.slice(0, 200)}`,
      );
    }
  }

  upsertTicket(payload: UpsertPayload): Promise<void> {
    return this.post('/tickets/bridge/upsert', payload);
  }

  appendMessage(payload: MessagePayload): Promise<void> {
    return this.post('/tickets/bridge/message', payload);
  }

  closeTicket(payload: ClosePayload): Promise<void> {
    return this.post('/tickets/bridge/close', payload);
  }
}
