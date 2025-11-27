import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DeclineServiceRequestDto {
  @ApiPropertyOptional({ description: 'Reason for declining', example: 'Equipment not available' })
  @IsOptional()
  @IsString()
  reason?: string;
}
