import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RconDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  command!: string;

  /** Required true for denylisted / unknown commands. */
  @IsOptional()
  @IsBoolean()
  confirm?: boolean;
}
