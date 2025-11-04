import { IsString, IsEnum, IsBoolean, IsOptional } from 'class-validator';

export class UpdatePreferencesDto {
  @IsEnum(['provider', 'seeker'])
  @IsOptional()
  defaultLandingPage?: string;

  @IsString()
  @IsOptional()
  defaultProviderTab?: string;

  @IsString()
  @IsOptional()
  preferredLanguage?: string;

  @IsBoolean()
  @IsOptional()
  notificationsEnabled?: boolean;
}