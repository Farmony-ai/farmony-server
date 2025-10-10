import { IsOptional, IsEnum, IsMongoId, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ServiceRequestStatus } from '../entities/service-request.entity';

export class ServiceRequestFiltersDto {
  @IsOptional()
  @IsEnum(ServiceRequestStatus)
  status?: ServiceRequestStatus;

  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @IsOptional()
  @IsMongoId()
  seekerId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}