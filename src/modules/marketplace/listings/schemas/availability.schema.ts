import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AvailabilityDocument = Availability & Document;

export enum DayOfWeek {
  MONDAY = 'monday',
  TUESDAY = 'tuesday',
  WEDNESDAY = 'wednesday',
  THURSDAY = 'thursday',
  FRIDAY = 'friday',
  SATURDAY = 'saturday',
  SUNDAY = 'sunday'
}

@Schema({ _id: false })
export class TimeSlot {
  @Prop({ type: String, required: true })
  start: string; // Format: "09:00"

  @Prop({ type: String, required: true })
  end: string; // Format: "17:00"
}

const TimeSlotSchema = SchemaFactory.createForClass(TimeSlot);

@Schema({ timestamps: true })
export class Availability {
  @Prop({ type: Types.ObjectId, ref: 'Listing', required: true })
  listingId: Types.ObjectId;

  @Prop({ type: Date, required: true })
  startDate: Date;

  @Prop({ type: Date, required: true })
  endDate: Date;

  @Prop({ type: [String], enum: Object.values(DayOfWeek), default: [] })
  availableDays: DayOfWeek[]; // Days of week when available

  @Prop({ type: [TimeSlotSchema], default: [] })
  timeSlots: TimeSlot[]; // Time slots for each available day

  @Prop({ type: Boolean, default: false })
  isRecurring: boolean;

  @Prop({ type: String, enum: ['daily', 'weekly', 'monthly'], default: 'weekly' })
  recurringPattern?: string;

  @Prop({ type: [Date], default: [] })
  blockedDates: Date[]; // Specific dates when not available

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: String })
  notes?: string; // Any special instructions
}

export const AvailabilitySchema = SchemaFactory.createForClass(Availability);
AvailabilitySchema.index({ listingId: 1, startDate: 1, endDate: 1 });
AvailabilitySchema.index({ listingId: 1, isActive: 1 });
