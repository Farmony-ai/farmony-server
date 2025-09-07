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
  
  @IsString()
  @IsOptional()
  category?: string;
  
  @IsString()
  @IsOptional()
  subcategory?: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  photos?: string[];

  @IsUrl()
  @IsOptional()
  videoUrl?: string;

  @ValidateNested()
  @Type(() => LocationDto)
  @IsOptional() 
  location: LocationDto;

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
