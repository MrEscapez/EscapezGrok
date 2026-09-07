import { IsObject, IsOptional, IsString } from 'class-validator';

/**
 * Event envelope from EscapezCore (report.created, player.join, staffchat, …).
 */
export class BridgeEventDto {
  @IsString()
  type!: string;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  timestamp?: string;
}
