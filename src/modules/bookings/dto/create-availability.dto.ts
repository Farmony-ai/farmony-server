import { IsMongoId, IsDateString, IsBoolean, IsArray, IsOptional, IsEnum, IsString, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { DayOfWeek } from '../availability.schema';

export class TimeSlotDto {
  @IsString()
  start: string;

  @IsString()
  end: string;
}

export class CreateAvailabilityDto {
  @IsMongoId()
  listingId: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsArray()
  @IsEnum(DayOfWeek, { each: true })
  @ArrayMinSize(1)
  availableDays: DayOfWeek[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  @ArrayMinSize(1)
  timeSlots: TimeSlotDto[];

  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;

  @IsString()
  @IsOptional()
  @IsEnum(['daily', 'weekly', 'monthly'])
  recurringPattern?: string;

  @IsArray()
  @IsDateString({}, { each: true })
  @IsOptional()
  blockedDates?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}
