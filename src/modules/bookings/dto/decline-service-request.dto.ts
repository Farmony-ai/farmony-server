import { IsOptional, IsString } from 'class-validator';

export class DeclineServiceRequestDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
