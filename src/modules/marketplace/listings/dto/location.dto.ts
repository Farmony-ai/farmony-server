import { IsString, IsArray, ArrayMinSize, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class LocationDto {
  @ApiProperty({
    type: String,
    description: 'GeoJSON type',
    example: 'Point'
  })
  @IsString()
  type: string;

  @ApiProperty({
    type: [Number],
    description: 'Coordinates as [longitude, latitude]',
    example: [77.1025, 28.7041]
  })
  @IsArray()
  @ArrayMinSize(2)
  @IsNumber({}, { each: true })
  coordinates: number[];
}
