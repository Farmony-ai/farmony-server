import { IsString, IsEnum, IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class UpdatePreferencesDto {
  @ApiPropertyOptional({
    description: 'Default landing page',
    enum: ['provider', 'seeker'],
    example: 'provider'
  })
  @Transform(({ value }) => value?.toLowerCase())
  @IsEnum(['provider', 'seeker'])
  @IsOptional()
  defaultLandingPage?: string;

  @ApiPropertyOptional({ description: 'Default provider tab', example: 'listings' })
  @Transform(({ value }) => value?.toLowerCase())
  @IsString()
  @IsOptional()
  defaultProviderTab?: string;

  @ApiPropertyOptional({ description: 'Preferred language', example: 'en' })
  @IsString()
  @IsOptional()
  preferredLanguage?: string;

  @ApiPropertyOptional({ description: 'Notifications enabled', example: true })
  @IsBoolean()
  @IsOptional()
  notificationsEnabled?: boolean;
}