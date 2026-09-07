import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class CreateScheduleDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'weekStart moet YYYY-MM-DD zijn',
  })
  weekStart!: string;
}
