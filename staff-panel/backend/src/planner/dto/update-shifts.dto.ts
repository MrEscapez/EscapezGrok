import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const SHIFT_TYPES = ['EARLY', 'DAY', 'LATE', 'NIGHT', 'OFF'] as const;

export class ShiftInputDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  id?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  staffUserId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  staffName!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @IsIn(SHIFT_TYPES)
  type!: (typeof SHIFT_TYPES)[number];

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  startTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  endTime?: string;
}

export class UpdateShiftsDto {
  @IsInt()
  @Min(1)
  version!: number;

  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ShiftInputDto)
  shifts!: ShiftInputDto[];
}
