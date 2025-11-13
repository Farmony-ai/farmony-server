import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsDate,
  ValidateNested,
  IsMongoId,
  Min,
  Max,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class LocationDto {
  @ApiProperty({ description: 'Latitude', example: 28.7041, minimum: -90, maximum: 90 })
  @IsNumber({}, { message: 'Latitude must be a number' })
  @Min(-90, { message: 'Latitude must be between -90 and 90' })
  @Max(90, { message: 'Latitude must be between -90 and 90' })
  lat: number;

  @ApiProperty({ description: 'Longitude', example: 77.1025, minimum: -180, maximum: 180 })
  @IsNumber({}, { message: 'Longitude must be a number' })
  @Min(-180, { message: 'Longitude must be between -180 and 180' })
  @Max(180, { message: 'Longitude must be between -180 and 180' })
  lon: number;
}

class MetadataDto {
  @ApiPropertyOptional({ description: 'Quantity', example: 1, minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({ description: 'Unit of measure', example: 'per_hour' })
  @IsOptional()
  @IsString()
  unitOfMeasure?: string;

  @ApiPropertyOptional({ description: 'Duration in hours', example: 8, minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  duration?: number; // in hours

  @ApiPropertyOptional({ description: 'Special requirements', example: ['Must have GPS'], maxItems: 10 })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  specialRequirements?: string[];
}

export class CreateServiceRequestDto {
  @ApiProperty({ description: 'Category ID', example: '507f1f77bcf86cd799439011' })
  @IsMongoId()
  @IsNotEmpty()
  categoryId: string;

  @ApiPropertyOptional({ description: 'Sub-category ID', example: '507f1f77bcf86cd799439012' })
  @IsOptional()
  @IsMongoId()
  subCategoryId?: string;

  @ApiProperty({ description: 'Service request title', example: 'Need tractor for plowing' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Detailed description', example: 'I need a tractor to plow 5 acres of land' })
  @IsString()
  @IsNotEmpty()
  description: string;

  // OPTION 1: Provide existing address ID
  @ApiPropertyOptional({ description: 'Existing address ID from user profile', example: '507f1f77bcf86cd799439013' })
  @IsOptional()
  @IsMongoId()
  addressId?: string;

  // Legacy alias used by some clients
  @ApiPropertyOptional({ description: 'Legacy: Service address ID', example: '507f1f77bcf86cd799439013' })
  @IsOptional()
  @IsMongoId()
  serviceAddressId?: string;

  // OPTION 2: Provide coordinates and address details
  @ApiPropertyOptional({ description: 'Service location coordinates', type: () => LocationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;

  @ApiPropertyOptional({ description: 'Address line 1', example: 'Near water tank' })
  @IsOptional()
  @IsString()
  addressLine1?: string;

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

  @ApiPropertyOptional({ description: 'PIN code', example: '250001' })
  @IsOptional()
  @IsString()
  pincode?: string;

  @ApiProperty({ description: 'Service start date', example: '2025-11-15T09:00:00Z' })
  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  serviceStartDate: Date;

  @ApiProperty({ description: 'Service end date', example: '2025-11-15T17:00:00Z' })
  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  serviceEndDate: Date;


  @ApiPropertyOptional({ description: 'Additional metadata', type: () => MetadataDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MetadataDto)
  metadata?: MetadataDto;

  @ApiPropertyOptional({ description: 'S3 keys for uploaded files', example: ['uploads/photo1.jpg'], maxItems: 5 })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(5)
  attachments?: string[]; // S3 keys for uploaded files
}
