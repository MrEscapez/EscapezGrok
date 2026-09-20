import { IsOptional, IsString, MaxLength } from 'class-validator';

export class BridgeUpsertDto {
  @IsString()
  @MaxLength(64)
  channelId!: string;

  @IsString()
  @MaxLength(256)
  channelName!: string;

  @IsString()
  @MaxLength(64)
  guildId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  openerId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  openerTag?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  categoryId?: string | null;
}
