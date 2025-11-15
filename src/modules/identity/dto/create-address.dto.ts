import { IsNotEmpty, IsString, IsOptional, IsBoolean, IsNumber, IsArray, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum AddressType {
  HOME = 'home',
  WORK = 'work',
  PERSONAL = 'personal',
  OTHER = 'other',
  FARM = 'farm',
  WAREHOUSE = 'warehouse',
  SERVICE_AREA = 'service_area',
  DELIVERY_POINT = 'delivery_point',
  MEETING_SPOT = 'meeting_spot',
}

export class GeoPointDto {
  @IsString()
  @IsNotEmpty()
  type: 'Point' = 'Point';

  @IsArray()
  @IsNumber({}, { each: true })
  coordinates: [number, number]; // [longitude, latitude]
}

export class CreateAddressDto {
  @IsOptional()
  @IsEnum(AddressType)
  addressType?: AddressType;

  @IsOptional()
  @IsString()
  customLabel?: string;

  @IsNotEmpty()
  @IsString()
  addressLine1: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsOptional()
  @IsString()
  village?: string;

  @IsOptional()
  @IsString()
  tehsil?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  pincode?: string;

  @IsOptional()
  @Type(() => GeoPointDto)
  location?: GeoPointDto;

  @IsOptional()
  @IsNumber()
  accuracy?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  accessInstructions?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceCategories?: string[];
}
