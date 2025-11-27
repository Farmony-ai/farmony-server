import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceRequestStatus } from '../schemas/service-request.entity';

export class ServiceRequestStatusDto {
  @ApiProperty({ description: 'Service request ID' })
  requestId: string;

  @ApiProperty({ description: 'Current status', enum: ServiceRequestStatus })
  status: ServiceRequestStatus;

  @ApiProperty({ description: 'Current wave number', example: 1 })
  currentWave: number;

  @ApiProperty({ description: 'Total waves sent so far', example: 2 })
  totalWaves: number;

  @ApiProperty({ description: 'Total providers notified', example: 5 })
  totalProvidersNotified: number;

  @ApiProperty({ description: 'Expiration time of the request', example: '2025-11-13T10:00:00Z' })
  expiresAt: Date;

  @ApiPropertyOptional({ description: 'Accepted provider ID if any' })
  acceptedBy?: string | null;

  @ApiPropertyOptional({ description: 'Associated order ID if created' })
  orderId?: string | null;
}

