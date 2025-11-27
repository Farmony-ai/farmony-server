import { IsMongoId, IsDateString, IsBoolean, IsArray, IsOptional, IsEnum, IsString, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DayOfWeek } from '../schemas/availability.schema';

export class TimeSlotDto {
  @ApiProperty({ description: 'Start time', example: '09:00' })
  @IsString()
  start: string;

  @ApiProperty({ description: 'End time', example: '17:00' })
  @IsString()
  end: string;
}

export class CreateAvailabilityDto {
  @ApiProperty({ description: 'Listing ID', example: '507f1f77bcf86cd799439011' })
  @IsMongoId()
  listingId: string;

  @ApiProperty({ description: 'Availability start date', example: '2025-11-15T00:00:00Z' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'Availability end date', example: '2025-12-31T23:59:59Z' })
  @IsDateString()
  endDate: string;

  @ApiProperty({
    description: 'Available days of the week',
    enum: DayOfWeek,
    isArray: true,
    example: [DayOfWeek.MONDAY, DayOfWeek.TUESDAY]
  })
  @IsArray()
  @IsEnum(DayOfWeek, { each: true })
  @ArrayMinSize(1)
  availableDays: DayOfWeek[];

  @ApiProperty({
    description: 'Available time slots',
    type: [TimeSlotDto],
    example: [{ start: '09:00', end: '17:00' }]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  @ArrayMinSize(1)
  timeSlots: TimeSlotDto[];

  @ApiPropertyOptional({ description: 'Is recurring availability', example: true })
  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;

  @ApiPropertyOptional({
    description: 'Recurring pattern',
    enum: ['daily', 'weekly', 'monthly'],
    example: 'weekly'
  })
  @IsString()
  @IsOptional()
  @IsEnum(['daily', 'weekly', 'monthly'])
  recurringPattern?: string;

  @ApiPropertyOptional({
    description: 'Blocked dates',
    type: [String],
    example: ['2025-12-25T00:00:00Z']
  })
  @IsArray()
  @IsDateString({}, { each: true })
  @IsOptional()
  blockedDates?: string[];

  @ApiPropertyOptional({ description: 'Is availability active', example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Additional notes', example: 'Not available on public holidays' })
  @IsString()
  @IsOptional()
  notes?: string;
}
