import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Write-only Ticket Tool secrets: send a new value to set, omit to keep, clear* to wipe.
 * Responses never echo plaintext tokens/secrets.
 */
export class TicketToolConfigDto {
  /** New API token (tt_…) — ignored if empty/whitespace. */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  apiToken?: string;

  /** New webhook signing secret — ignored if empty/whitespace. */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  webhookSecret?: string;

  @IsOptional()
  @IsBoolean()
  clearApiToken?: boolean;

  @IsOptional()
  @IsBoolean()
  clearWebhookSecret?: boolean;
}
