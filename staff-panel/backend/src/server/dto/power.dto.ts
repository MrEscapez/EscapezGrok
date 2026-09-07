import {
  IsBoolean,
  IsDefined,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class PowerDto {
  @IsIn(['start', 'stop', 'restart'])
  action!: 'start' | 'stop' | 'restart';

  /** Required true for all power actions (dangerous). */
  @IsDefined()
  @IsBoolean()
  confirm!: boolean;

  /** Optional Pterodactyl server identifier (Client API). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  serverIdentifier?: string;
}
