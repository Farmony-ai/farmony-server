import { IsBoolean, IsOptional, IsString, IsIn, IsMongoId, ValidateNested, IsEmail } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UpdatePreferencesDto } from './update-preferences.dto';

export class UpdateUserDto {
  @ApiPropertyOptional({ description: 'User name', example: 'Ram Singh' })
  @IsOptional()
  @IsString()
  name?: string;

  // Allow updating email safely when ValidationPipe whitelist is enabled
  @ApiPropertyOptional({ description: 'Email address', example: 'ram@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Phone number', example: '+919876543210' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Is user verified', example: true })
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @ApiPropertyOptional({
    description: 'KYC status',
    enum: ['none', 'pending', 'approved', 'rejected'],
    example: 'approved'
  })
  @IsOptional()
  @IsString()
  @IsIn(['none', 'pending', 'approved', 'rejected'])
  kycStatus?: string;

  @ApiPropertyOptional({ description: 'User preferences', type: () => UpdatePreferencesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdatePreferencesDto)
  preferences?: UpdatePreferencesDto;

  @ApiPropertyOptional({ description: 'Default address ID', example: '507f1f77bcf86cd799439011' })
  @IsOptional()
  @IsMongoId()
  defaultAddressId?: string;
} 