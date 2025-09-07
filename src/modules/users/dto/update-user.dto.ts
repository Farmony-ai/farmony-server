import { IsBoolean, IsOptional, IsString, IsIn, IsMongoId, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdatePreferencesDto } from './update-preferences.dto';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  // Optional gender field; allows a small, readable set of values
  @IsOptional()
  @IsString()
  @IsIn(['male', 'female', 'other', 'prefer_not_to_say'])
  gender?: string;

  // Optional date of birth field; expects an ISO 8601 date like "1990-05-12"
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['none', 'pending', 'approved', 'rejected'])
  kycStatus?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdatePreferencesDto)
  preferences?: UpdatePreferencesDto;

  @IsOptional()
  @IsMongoId()
  defaultAddressId?: string;
} 