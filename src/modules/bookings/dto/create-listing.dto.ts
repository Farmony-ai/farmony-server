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
import { LocationDto } from './location.dto';

export enum UnitOfMeasure {
  PER_HOUR = 'per_hour',
  PER_DAY = 'per_day',
  PER_PIECE = 'per_piece',
  PER_KG = 'per_kg',
  PER_UNIT = 'per_unit'
}

export class CreateListingDto {
  @IsMongoId()
  providerId: string;

  // Option 1: Use existing address
  @IsOptional()
  @IsMongoId()
  addressId?: string;

  // Option 2: Provide coordinates + address details
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;

  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  village?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  pincode?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsMongoId()
  categoryId: string;

  @IsMongoId()
  subCategoryId: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  photos?: string[];

  @IsUrl()
  @IsOptional()
  videoUrl?: string;


  @IsNumber()
  @Min(0)
  price: number;

  @IsEnum(UnitOfMeasure)
  unitOfMeasure: UnitOfMeasure;

  @IsNumber()
  @Min(1)
  @IsOptional()
  minimumOrder?: number;

  @IsDateString()
  availableFrom: string;

  @IsDateString()
  availableTo: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  termsAndConditions?: string;

}

