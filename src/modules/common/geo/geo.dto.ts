import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class GeoPointDto {
  @ApiProperty({ enum: ['Point'], example: 'Point', description: 'GeoJSON type' })
  @IsEnum(['Point'])
  type: 'Point';

  @ApiProperty({ type: [Number], description: 'Coordinates as [longitude, latitude]' })
  @IsArray()
  @IsNumber({}, { each: true })
  coordinates: [number, number];
}

export class EmbeddedAddressDto {
  @ApiPropertyOptional({ description: 'Address line 1' })
  @IsOptional()
  @IsString()
  addressLine1?: string;

  @ApiPropertyOptional({ description: 'Village' })
  @IsOptional()
  @IsString()
  village?: string;

  @ApiPropertyOptional({ description: 'District' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ description: 'State' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ description: 'Pincode' })
  @IsOptional()
  @IsString()
  pincode?: string;

  @ApiPropertyOptional({ description: 'Coordinates as [longitude, latitude]', type: [Number] })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  coordinates?: [number, number];

  @ApiPropertyOptional({ description: 'Temporary address flag', default: true })
  @IsOptional()
  isTemporary?: boolean;
}

