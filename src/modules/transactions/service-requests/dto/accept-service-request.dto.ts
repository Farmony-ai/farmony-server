import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AcceptServiceRequestDto {
  @ApiPropertyOptional({ description: 'Message to seeker', example: 'I can help you with this' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ description: 'Estimated completion time', example: '2025-11-15T17:00:00Z' })
  @IsOptional()
  @IsString()
  estimatedCompletionTime?: string;
}
