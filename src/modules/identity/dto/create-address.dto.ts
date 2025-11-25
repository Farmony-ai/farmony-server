import {
    IsNotEmpty,
    IsString,
    IsOptional,
    IsBoolean,
    IsNumber,
    IsArray,
    IsEnum,
    ValidateNested,
    Matches,
    MaxLength,
    Length,
    IsMongoId,
    Validate,
    Min,
    Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsValidCoordinates } from '../../common/validators/coordinates.validator';

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
    @ApiProperty({ default: 'Point' })
    @IsString()
    type: 'Point' = 'Point';

    @ApiProperty({
        description: 'Coordinates as [longitude, latitude]',
        example: [77.5946, 12.9716],
    })
    @IsArray()
    @Validate(IsValidCoordinates)
    coordinates: [number, number];
}

export class CreateAddressDto {
    @ApiPropertyOptional({ enum: AddressType, default: AddressType.OTHER })
    @IsOptional()
    @IsEnum(AddressType)
    addressType?: AddressType;

    @ApiPropertyOptional({ description: 'Custom label for address', maxLength: 50 })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    customLabel?: string;

    @ApiProperty({ description: 'Primary address line', example: '123 Main Street' })
    @IsNotEmpty()
    @IsString()
    @Length(5, 200)
    addressLine1: string;

    @ApiPropertyOptional({ description: 'Secondary address line' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    addressLine2?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(100)
    village?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(100)
    tehsil?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(100)
    district?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(100)
    state?: string;

    @ApiPropertyOptional({ description: '6-digit Indian pincode', example: '560001' })
    @IsOptional()
    @IsString()
    @Matches(/^[1-9][0-9]{5}$/, { message: 'Pincode must be a valid 6-digit Indian pincode' })
    pincode?: string;

    @ApiPropertyOptional({ type: GeoPointDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => GeoPointDto)
    location?: GeoPointDto;

    @ApiPropertyOptional({ description: 'GPS accuracy in meters' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(10000)
    accuracy?: number;

    @ApiPropertyOptional({ default: false })
    @IsOptional()
    @IsBoolean()
    isDefault?: boolean;

    @ApiPropertyOptional({ default: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @ApiPropertyOptional({ description: 'Instructions for accessing the location', maxLength: 500 })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    accessInstructions?: string;

    @ApiPropertyOptional({ description: 'Service category IDs', type: [String] })
    @IsOptional()
    @IsArray()
    @IsMongoId({ each: true })
    serviceCategories?: string[];
}
