import {
  IsArray,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleIds?: string[];

  /** Optional password reset stub — rehashes with bcrypt when set. */
  @IsOptional()
  @IsString()
  @MinLength(4)
  password?: string;
}
