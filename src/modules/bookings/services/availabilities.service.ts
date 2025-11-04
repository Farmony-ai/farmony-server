import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Availability, AvailabilityDocument, DayOfWeek } from '../schemas/availability.schema';
import { CreateAvailabilityDto } from '../listings/dto/create-availability.dto';
import { UpdateAvailabilityDto } from '../listings/dto/update-availability.dto';

@Injectable()
export class AvailabilitiesService {
    constructor(@InjectModel(Availability.name) private availModel: Model<AvailabilityDocument>) {}

    async create(dto: CreateAvailabilityDto): Promise<Availability> {
        // Validate date range
        const startDate = new Date(dto.startDate);
        const endDate = new Date(dto.endDate);

        if (startDate >= endDate) {
            throw new BadRequestException('End date must be after start date');
        }

        // Check for overlapping availability
        const overlapping = await this.availModel.findOne({
            listingId: dto.listingId,
            isActive: true,
            $or: [{ startDate: { $lte: endDate }, endDate: { $gte: startDate } }],
        });

        if (overlapping) {
            throw new BadRequestException('Overlapping availability period exists');
        }

        const avail = new this.availModel(dto);
        return avail.save();
    }

    async findByListing(listingId: string): Promise<Availability[]> {
        return this.availModel.find({ listingId, isActive: true }).sort({ startDate: 1 }).exec();
    }

    async findAvailableOn(listingId: string, date: Date): Promise<Availability | null> {
        const dayOfWeek = this.getDayOfWeek(date);

        return this.availModel
            .findOne({
                listingId,
                isActive: true,
                startDate: { $lte: date },
                endDate: { $gte: date },
                availableDays: dayOfWeek,
                blockedDates: { $ne: date },
            })
            .exec();
    }

    async checkAvailability(listingId: string, startDate: Date, endDate: Date): Promise<boolean> {
        const availabilities = await this.availModel
            .find({
                listingId,
                isActive: true,
                startDate: { $lte: endDate },
                endDate: { $gte: startDate },
            })
            .exec();

        if (availabilities.length === 0) return false;

        // Check each day in the requested range
        const current = new Date(startDate);
        while (current <= endDate) {
            const dayOfWeek = this.getDayOfWeek(current) as unknown as DayOfWeek;
            const dayAvailable = availabilities.some((avail) => {
                return avail.availableDays.includes(dayOfWeek) && !avail.blockedDates.some((blocked) => blocked.toDateString() === current.toDateString());
            });

            if (!dayAvailable) return false;
            current.setDate(current.getDate() + 1);
        }

        return true;
    }

    async blockDates(listingId: string, dates: Date[]): Promise<void> {
        await this.availModel.updateMany({ listingId, isActive: true }, { $addToSet: { blockedDates: { $each: dates } } });
    }

    async update(id: string, dto: UpdateAvailabilityDto): Promise<Availability> {
        const updated = await this.availModel.findByIdAndUpdate(id, dto, { new: true }).exec();
        if (!updated) throw new NotFoundException('Availability not found');
        return updated;
    }

    async delete(id: string): Promise<Availability> {
        const removed = await this.availModel.findByIdAndDelete(id).exec();
        if (!removed) throw new NotFoundException('Availability not found');
        return removed;
    }

    private getDayOfWeek(date: Date): string {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        return days[date.getDay()];
    }
}
