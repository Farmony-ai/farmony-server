import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, IsNumber } from 'class-validator';

class UnifiedLocationDto {
  @ApiPropertyOptional({ description: 'Formatted address', example: 'Near water tank, Rampur' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ description: 'Coordinates as [longitude, latitude]', example: [77.1025, 28.7041], type: [Number] })
  @IsArray()
  @IsNumber({}, { each: true })
  coordinates: number[];

  @ApiPropertyOptional({ description: 'Village name', example: 'Rampur' })
  @IsOptional()
  @IsString()
  village?: string;

  @ApiPropertyOptional({ description: 'District', example: 'Meerut' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ description: 'State', example: 'Uttar Pradesh' })
  @IsOptional()
  @IsString()
  state?: string;
}

export class UnifiedBookingDto {
  @ApiProperty({ description: 'Booking ID', example: '507f1f77bcf86cd799439011' })
  id: string;

  @ApiProperty({ description: 'Booking type', enum: ['order', 'service_request'], example: 'order' })
  type: 'order' | 'service_request';

  @ApiProperty({
    description: 'Display status',
    enum: ['searching', 'matched', 'in_progress', 'no_accept', 'completed', 'cancelled', 'pending'],
    example: 'in_progress'
  })
  displayStatus: 'searching' | 'matched' | 'in_progress' | 'no_accept' | 'completed' | 'cancelled' | 'pending';

  @ApiProperty({ description: 'Original status from database', example: 'accepted' })
  originalStatus: string;

  @ApiProperty({ description: 'Booking title', example: 'Tractor rental for plowing' })
  title: string;

  @ApiPropertyOptional({ description: 'Description', example: 'Need tractor for 5 acres' })
  description?: string;

  @ApiPropertyOptional({ description: 'Provider name', example: 'Ram Singh' })
  providerName?: string;

  @ApiPropertyOptional({ description: 'Provider phone', example: '+919876543210' })
  providerPhone?: string;

  @ApiPropertyOptional({ description: 'Provider email', example: 'ram@example.com' })
  providerEmail?: string;

  @ApiPropertyOptional({ description: 'Provider ID', example: '507f1f77bcf86cd799439012' })
  providerId?: string;

  @ApiProperty({ description: 'Service start date', example: '2025-11-15T09:00:00Z' })
  serviceStartDate: Date;

  @ApiPropertyOptional({ description: 'Service end date', example: '2025-11-15T17:00:00Z' })
  serviceEndDate?: Date;

  @ApiPropertyOptional({ description: 'Location information', type: () => UnifiedLocationDto })
  @Type(() => UnifiedLocationDto)
  location?: UnifiedLocationDto;

  @ApiPropertyOptional({ description: 'Total amount in rupees', example: 5000 })
  totalAmount?: number;

  @ApiProperty({ description: 'Created at', example: '2025-11-12T10:00:00Z' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated at', example: '2025-11-12T15:00:00Z' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'Category information' })
  category?: any;

  @ApiPropertyOptional({ description: 'Subcategory information' })
  subcategory?: any;

  @ApiPropertyOptional({ description: 'Image URLs', example: ['https://example.com/image1.jpg'] })
  images?: string[];

  @ApiPropertyOptional({ description: 'Order type', example: 'rental' })
  orderType?: string;

  @ApiPropertyOptional({ description: 'Quantity', example: 1 })
  quantity?: number;

  @ApiPropertyOptional({ description: 'Unit of measure', example: 'per_day' })
  unitOfMeasure?: string;

  // Service request specific fields
  @ApiPropertyOptional({
    description: 'Budget range',
    example: { min: 3000, max: 7000 }
  })
  budget?: {
    min: number;
    max: number;
  };

  @ApiPropertyOptional({ description: 'Urgency level', example: 'high' })
  urgency?: string;

  @ApiPropertyOptional({ description: 'Current wave count', example: 2 })
  waveCount?: number;

  @ApiPropertyOptional({ description: 'Number of matched providers', example: 3 })
  matchedProvidersCount?: number;

  @ApiPropertyOptional({ description: 'Is currently searching for providers', example: true })
  isSearching?: boolean;

  @ApiPropertyOptional({ description: 'Minutes elapsed since search started', example: 15 })
  searchElapsedMinutes?: number;

  @ApiPropertyOptional({ description: 'Next wave notification time', example: '2025-11-12T10:20:00Z' })
  nextWaveAt?: Date;

  @ApiPropertyOptional({ description: 'Request expiration time', example: '2025-11-13T10:00:00Z' })
  expiresAt?: Date;

  @ApiPropertyOptional({ description: 'Associated order ID', example: '507f1f77bcf86cd799439013' })
  orderId?: string;
}
