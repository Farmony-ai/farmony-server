import { IsString, IsEnum, IsBoolean, IsOptional, ValidateNested } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class NotificationPreferencesDto {
    @ApiPropertyOptional({ description: 'Service request updates (accepted, expired)', example: true })
    @IsBoolean()
    @IsOptional()
    serviceRequestUpdates?: boolean;

    @ApiPropertyOptional({ description: 'New opportunities for providers', example: true })
    @IsBoolean()
    @IsOptional()
    newOpportunities?: boolean;

    @ApiPropertyOptional({ description: 'Order status updates (in progress, completed)', example: true })
    @IsBoolean()
    @IsOptional()
    orderStatusUpdates?: boolean;

    @ApiPropertyOptional({ description: 'Payment updates', example: true })
    @IsBoolean()
    @IsOptional()
    paymentUpdates?: boolean;

    @ApiPropertyOptional({ description: 'Review updates', example: true })
    @IsBoolean()
    @IsOptional()
    reviewUpdates?: boolean;
}

export class UpdatePreferencesDto {
    @ApiPropertyOptional({
        description: 'Default landing page',
        enum: ['provider', 'seeker'],
        example: 'provider',
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

    @ApiPropertyOptional({ description: 'Master notifications toggle', example: true })
    @IsBoolean()
    @IsOptional()
    notificationsEnabled?: boolean;

    @ApiPropertyOptional({ description: 'Granular notification preferences' })
    @ValidateNested()
    @Type(() => NotificationPreferencesDto)
    @IsOptional()
    notificationPreferences?: NotificationPreferencesDto;
}
