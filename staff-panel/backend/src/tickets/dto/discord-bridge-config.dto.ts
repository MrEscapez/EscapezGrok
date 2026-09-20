import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Write-only Discord bridge secret: send a new value to set, omit to keep, clear* to wipe.
 * Responses never echo plaintext secrets.
 */
export class DiscordBridgeConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  bridgeSecret?: string;

  @IsOptional()
  @IsBoolean()
  clearBridgeSecret?: boolean;
}
