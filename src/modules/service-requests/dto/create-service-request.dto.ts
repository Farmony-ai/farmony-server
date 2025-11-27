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

class LocationDto {
  @IsNumber({}, { message: 'Latitude must be a number' })
  @Min(-90, { message: 'Latitude must be between -90 and 90' })
  @Max(90, { message: 'Latitude must be between -90 and 90' })
  lat: number;

  @IsNumber({}, { message: 'Longitude must be a number' })
  @Min(-180, { message: 'Longitude must be between -180 and 180' })
  @Max(180, { message: 'Longitude must be between -180 and 180' })
  lon: number;
}

class MetadataDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsString()
  unitOfMeasure?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  duration?: number; // in hours

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  specialRequirements?: string[];
}

export class CreateServiceRequestDto {
  @IsMongoId()
  @IsNotEmpty()
  categoryId: string;

  @IsOptional()
  @IsMongoId()
  subCategoryId?: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  // OPTION 1: Provide existing address ID
  @IsOptional()
  @IsMongoId()
  addressId?: string;

  // Legacy alias used by some clients
  @IsOptional()
  @IsMongoId()
  serviceAddressId?: string;

  // OPTION 2: Provide coordinates and address details
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

  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  serviceStartDate: Date;

  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  serviceEndDate: Date;

  
  @IsOptional()
  @ValidateNested()
  @Type(() => MetadataDto)
  metadata?: MetadataDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(5)
  attachments?: string[]; // S3 keys for uploaded files
}
