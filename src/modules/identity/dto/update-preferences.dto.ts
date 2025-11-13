import { IsString, IsEnum, IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePreferencesDto {
  @ApiPropertyOptional({
    description: 'Default landing page',
    enum: ['provider', 'seeker'],
    example: 'provider'
  })
  @IsEnum(['provider', 'seeker'])
  @IsOptional()
  defaultLandingPage?: string;

  @ApiPropertyOptional({ description: 'Default provider tab', example: 'listings' })
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