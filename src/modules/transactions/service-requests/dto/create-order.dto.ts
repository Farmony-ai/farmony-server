import { IsMongoId, IsEnum, IsDateString, IsNumber, ArrayMinSize, IsArray, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderType } from '../schemas/orders.schema';

export enum OrderStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  PAID = 'paid',
  COMPLETED = 'completed',
  CANCELED = 'canceled',
}

export class CreateOrderDto {
  @ApiProperty({ description: 'Listing ID', example: '507f1f77bcf86cd799439011' })
  @IsMongoId()
  listingId: string;

  @ApiProperty({ description: 'Seeker (customer) ID', example: '507f1f77bcf86cd799439012' })
  @IsMongoId()
  seekerId: string;

  @ApiProperty({ description: 'Provider (owner) ID', example: '507f1f77bcf86cd799439013' })
  @IsMongoId()
  providerId: string;

  @ApiProperty({ description: 'Type of order', enum: OrderType, example: OrderType.RENTAL })
  @IsEnum(OrderType)
  orderType: OrderType;

  @ApiProperty({ description: 'Total amount in rupees', example: 5000 })
  @IsNumber()
  totalAmount: number;

  @ApiPropertyOptional({ description: 'Service start date', example: '2025-11-15T09:00:00Z' })
  @IsDateString()
  @IsOptional()
  serviceStartDate?: string;

  @ApiPropertyOptional({ description: 'Service end date', example: '2025-11-15T17:00:00Z' })
  @IsDateString()
  @IsOptional()
  serviceEndDate?: string;

  @ApiPropertyOptional({ description: 'Quantity', example: 1 })
  @IsNumber()
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional({ description: 'Unit of measure', example: 'per_day' })
  @IsString()
  @IsOptional()
  unitOfMeasure?: string;

  @ApiPropertyOptional({
    description: 'Service location coordinates as [longitude, latitude]',
    example: [77.1025, 28.7041],
    isArray: true,
    type: Number
  })
  @IsArray()
  @ArrayMinSize(2)
  @IsNumber({}, { each: true })
  @IsOptional()
  coordinates?: number[];
}
