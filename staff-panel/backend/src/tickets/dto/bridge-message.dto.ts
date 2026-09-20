import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class BridgeMessageDto {
  @IsString()
  @MaxLength(64)
  channelId!: string;

  @IsString()
  @MaxLength(64)
  messageId!: string;

  @IsString()
  @MaxLength(64)
  authorId!: string;

  @IsString()
  @MaxLength(128)
  authorTag!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  content?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timestamp?: string;

  @IsOptional()
  @IsBoolean()
  isBot?: boolean;

  @IsOptional()
  @IsBoolean()
  isWebhook?: boolean;
}
