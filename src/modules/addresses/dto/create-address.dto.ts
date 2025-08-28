import { IsString, IsNotEmpty, IsEnum, IsArray, ArrayMinSize, IsNumber, IsBoolean, IsOptional, IsMongoId } from 'class-validator';

export enum AddressTag {
  HOME = 'home',
  WORK = 'work',
  PERSONAL = 'personal',
  OTHER = 'other'
}

export class CreateAddressDto {
  @IsMongoId()
  userId: string;

  @IsEnum(AddressTag)
  tag: AddressTag;

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
  tehsil: string;

  @IsString()
  @IsNotEmpty()
  district: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  pincode: string;

  @IsArray()
  @ArrayMinSize(2)
  @IsNumber({}, { each: true })
  coordinates: number[];

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
