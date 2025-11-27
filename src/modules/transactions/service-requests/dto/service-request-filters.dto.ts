import { IsOptional, IsEnum, IsMongoId, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceRequestStatus } from '../schemas/service-request.entity';

export class ServiceRequestFiltersDto {
  @ApiPropertyOptional({ description: 'Filter by status', enum: ServiceRequestStatus })
  @IsOptional()
  @IsEnum(ServiceRequestStatus)
  status?: ServiceRequestStatus;

  @ApiPropertyOptional({ description: 'Filter by category ID', example: '507f1f77bcf86cd799439011' })
  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Filter by seeker ID', example: '507f1f77bcf86cd799439012' })
  @IsOptional()
  @IsMongoId()
  seekerId?: string;

  @ApiPropertyOptional({ description: 'Page number', example: 1, minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}
