import { IsOptional, IsString, MaxLength } from 'class-validator';

export class BridgeCloseDto {
  @IsString()
  @MaxLength(64)
  channelId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  reason?: string;
}
