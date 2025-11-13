import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceRequestStatus } from '../schemas/service-request.entity';
import { GeoPointDto } from '@common/geo/geo.dto';

export class NotificationWaveDto {
  @ApiProperty() waveNumber: number;
  @ApiProperty() radius: number;
  @ApiProperty({ type: [String] }) notifiedProviders: string[];
  @ApiProperty() notifiedAt: Date;
  @ApiProperty() providersCount: number;
}

export class MatchingLifecycleDto {
  @ApiPropertyOptional({ type: [NotificationWaveDto] })
  notificationWaves?: NotificationWaveDto[];

  @ApiPropertyOptional() currentWave?: number;

  @ApiPropertyOptional() nextWaveAt?: Date;

  @ApiPropertyOptional({ type: [String] }) allNotifiedProviders?: string[];

  @ApiPropertyOptional({ type: [String] }) declinedProviders?: string[];
}

export class PaymentDto {
  @ApiPropertyOptional() totalAmount?: number;
}

export class OrderLifecycleDto {
  @ApiPropertyOptional() acceptedAt?: Date;
  @ApiPropertyOptional() providerId?: string;
  @ApiPropertyOptional() listingId?: string;
  @ApiPropertyOptional() orderRef?: string;
  @ApiPropertyOptional() agreedPrice?: number;
  @ApiPropertyOptional({ type: () => PaymentDto }) payment?: PaymentDto;
}

export class LifecycleDto {
  @ApiPropertyOptional({ type: () => MatchingLifecycleDto }) matching?: MatchingLifecycleDto;
  @ApiPropertyOptional({ type: () => OrderLifecycleDto }) order?: OrderLifecycleDto;
}

export class ServiceRequestResponseDto {
  @ApiProperty() _id: string;
  @ApiProperty() seekerId: string;
  @ApiProperty() categoryId: string;
  @ApiPropertyOptional() subCategoryId?: string;
  @ApiProperty() title: string;
  @ApiProperty() description: string;
  @ApiProperty({ type: () => GeoPointDto }) location: GeoPointDto;
  @ApiPropertyOptional() address?: string;
  @ApiProperty() serviceStartDate: Date;
  @ApiProperty() serviceEndDate: Date;
  @ApiProperty({ enum: ServiceRequestStatus }) status: ServiceRequestStatus;
  @ApiProperty() expiresAt: Date;
  @ApiPropertyOptional({ type: () => LifecycleDto }) lifecycle?: LifecycleDto;
  @ApiPropertyOptional({ type: [String] }) attachments?: string[];
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class PaginatedServiceRequestsDto {
  @ApiProperty({ type: [ServiceRequestResponseDto] }) requests: ServiceRequestResponseDto[];
  @ApiProperty() total: number;
}

export class AcceptServiceRequestResponseDto {
  @ApiProperty({ type: () => ServiceRequestResponseDto }) request: ServiceRequestResponseDto;
  @ApiProperty() orderId: string;
}

