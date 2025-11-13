import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateServiceRequestDto } from './create-service-request.dto';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceRequestStatus } from '../schemas/service-request.entity';

export class UpdateServiceRequestDto extends PartialType(
  OmitType(CreateServiceRequestDto, ['categoryId', 'location'] as const),
) {
  @ApiPropertyOptional({ description: 'Cancellation reason', example: 'No longer needed' })
  @IsOptional()
  @IsString()
  cancellationReason?: string;
}