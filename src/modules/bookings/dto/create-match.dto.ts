import { IsNumber, Min, Max, IsMongoId, IsInt, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMatchDto {
  @ApiProperty({ description: 'Latitude of user location' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({ description: 'Longitude of user location' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lon!: number;

  @ApiProperty({ description: 'Category ID from Catalogue collection' })
  @IsMongoId()
  categoryId!: string;

  @ApiProperty({ description: 'Maximum number of providers to return', default: 15 })
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit = 15;
}

