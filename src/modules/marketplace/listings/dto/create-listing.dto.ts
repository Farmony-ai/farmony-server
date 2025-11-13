import {
  IsString,
  IsNotEmpty,
  IsMongoId,
  IsArray,
  ArrayNotEmpty,
  IsNumber,
  IsDateString,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsUrl,
  Min,
  ValidateNested
} from 'class-validator';

import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LocationDto } from './location.dto';

export enum UnitOfMeasure {
  PER_HOUR = 'per_hour',
  PER_DAY = 'per_day',
  PER_PIECE = 'per_piece',
  PER_KG = 'per_kg',
  PER_UNIT = 'per_unit'
}

export class CreateListingDto {
  @ApiProperty({ description: 'Provider user ID', example: '507f1f77bcf86cd799439011' })
  @IsMongoId()
  providerId: string;

  // Option 1: Use existing address
  @ApiPropertyOptional({ description: 'Existing address ID from user profile', example: '507f1f77bcf86cd799439012' })
  @IsOptional()
  @IsMongoId()
  addressId?: string;

  // Option 2: Provide coordinates + address details
  @ApiPropertyOptional({ description: 'Location coordinates', type: () => LocationDto })
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

  @ApiPropertyOptional({ description: 'Listing title', example: 'Mahindra Tractor 575 DI' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'Detailed description', example: 'Well-maintained tractor, 5 years old' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Category ID', example: '507f1f77bcf86cd799439013' })
  @IsMongoId()
  categoryId: string;

  @ApiProperty({ description: 'Sub-category ID', example: '507f1f77bcf86cd799439014' })
  @IsMongoId()
  subCategoryId: string;

  @ApiPropertyOptional({ description: 'Photo URLs', example: ['https://example.com/photo1.jpg'], type: [String] })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  photos?: string[];

  @ApiPropertyOptional({ description: 'Video URL', example: 'https://youtube.com/watch?v=xyz' })
  @IsUrl()
  @IsOptional()
  videoUrl?: string;


  @ApiProperty({ description: 'Price', example: 500, minimum: 0 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ description: 'Unit of measure', enum: UnitOfMeasure, example: UnitOfMeasure.PER_DAY })
  @IsEnum(UnitOfMeasure)
  unitOfMeasure: UnitOfMeasure;

  @ApiPropertyOptional({ description: 'Minimum order quantity', example: 1, minimum: 1 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  minimumOrder?: number;

  @ApiProperty({ description: 'Available from date', example: '2025-11-15T00:00:00Z' })
  @IsDateString()
  availableFrom: string;

  @ApiProperty({ description: 'Available to date', example: '2025-12-31T23:59:59Z' })
  @IsDateString()
  availableTo: string;

  @ApiPropertyOptional({ description: 'Is listing active', example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Tags', example: ['tractor', 'diesel', 'heavy-duty'], type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ description: 'Terms and conditions', example: 'Fuel not included' })
  @IsString()
  @IsOptional()
  termsAndConditions?: string;

}

