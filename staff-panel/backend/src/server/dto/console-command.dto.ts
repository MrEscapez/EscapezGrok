import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ConsoleCommandDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  command!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  serverIdentifier?: string;
}
