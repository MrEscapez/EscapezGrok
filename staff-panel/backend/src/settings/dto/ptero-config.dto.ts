import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Write-only API keys: send a new value to set, omit to keep, clear* to wipe.
 * Responses never echo plaintext keys.
 */
export class PteroConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  baseUrl?: string;

  /** New Application API key — ignored if empty/whitespace. */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  clientApiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  defaultServerId?: string;

  @IsOptional()
  @IsBoolean()
  clearApiKey?: boolean;

  @IsOptional()
  @IsBoolean()
  clearClientApiKey?: boolean;
}
