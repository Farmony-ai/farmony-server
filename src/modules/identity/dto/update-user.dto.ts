import { IsOptional, IsString, IsIn, IsMongoId, ValidateNested, IsEmail, IsDateString, IsPhoneNumber, Length, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UpdatePreferencesDto } from './update-preferences.dto';

export class UpdateUserDto {
    @ApiPropertyOptional({ description: 'User name', example: 'Ram Singh', minLength: 2, maxLength: 100 })
    @IsOptional()
    @IsString()
    @Length(2, 100)
    name?: string;

    @ApiPropertyOptional({ description: 'Email address', example: 'ram@example.com' })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiPropertyOptional({ description: 'Phone number with country code', example: '+919876543210' })
    @IsOptional()
    @IsPhoneNumber()
    phone?: string;

    @ApiPropertyOptional({ description: 'Gender', enum: ['male', 'female', 'other'], example: 'male' })
    @IsOptional()
    @IsString()
    @IsIn(['male', 'female', 'other'])
    gender?: string;

    @ApiPropertyOptional({ description: 'Date of birth', example: '1990-01-15' })
    @IsOptional()
    @IsDateString()
    dateOfBirth?: string;

    @ApiPropertyOptional({ description: 'User bio', example: 'Experienced farmer with 10 years in organic farming', maxLength: 500 })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    bio?: string;

    @ApiPropertyOptional({ description: 'User occupation', example: 'Farmer', maxLength: 100 })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    occupation?: string;

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