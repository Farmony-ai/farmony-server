import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateServiceRequestDto } from './create-service-request.dto';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ServiceRequestStatus } from '../entities/service-request.entity';

export class UpdateServiceRequestDto extends PartialType(
  OmitType(CreateServiceRequestDto, ['categoryId', 'location'] as const),
) {
  @IsOptional()
  @IsEnum(ServiceRequestStatus)
  status?: ServiceRequestStatus;

  @IsOptional()
  @IsString()
  cancellationReason?: string;
}