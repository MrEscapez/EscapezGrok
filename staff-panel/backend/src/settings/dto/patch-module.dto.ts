import { IsBoolean } from 'class-validator';

export class PatchModuleDto {
  @IsBoolean()
  enabled!: boolean;
}
