import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsArray,
  ArrayMinSize,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsMongoId,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { AddressType } from '../../../common/interfaces/address.interface';

export class CreateAddressDto {
  @IsMongoId()
  userId: string;

  @ApiProperty({
    enum: AddressType,
    description: 'Classification for the address (legacy alias "tag" also accepted)',
  })
  @IsEnum(AddressType)
  @Transform(({ value, obj }) => value ?? obj.tag)
  addressType: AddressType;

  @ApiPropertyOptional({
    enum: AddressType,
    description: 'Legacy alias mapping to addressType',
  })
  @IsOptional()
  @IsEnum(AddressType)
  tag?: AddressType;

  @ApiPropertyOptional({ description: 'User-facing label such as "North Field"' })
  @IsString()
  @IsOptional()
  customLabel?: string;

  @IsString()
  @IsNotEmpty()
  addressLine1: string;

  @IsString()
  @IsOptional()
  addressLine2?: string;

  @IsString()
  @IsNotEmpty()
  village: string;

  @IsString()
  @IsOptional()
  tehsil?: string;

  @IsString()
  @IsNotEmpty()
  district: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  pincode: string;

  @ApiProperty({
    type: [Number],
    description: 'Coordinates as [longitude, latitude]',
    example: [77.1025, 28.7041],
  })
  @IsArray()
  @ArrayMinSize(2)
  @IsNumber({}, { each: true })
  coordinates: [number, number];

  @ApiPropertyOptional({ description: 'GPS accuracy in meters' })
  @IsNumber()
  @IsOptional()
  accuracy?: number;

  @ApiPropertyOptional({ type: [String], description: 'Supported service categories' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  serviceCategories?: string[];

  @ApiPropertyOptional({ description: 'Directions or access information' })
  @IsString()
  @IsOptional()
  accessInstructions?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
