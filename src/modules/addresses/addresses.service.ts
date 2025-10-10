import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Address, AddressDocument } from './addresses.schema';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressesService {
  constructor(
    @InjectModel(Address.name) private addressModel: Model<AddressDocument>,
  ) {}

  async create(dto: any): Promise<Address> {
    // Handle both new location field and legacy coordinates
    const addressData = { ...dto };

    if (dto.coordinates && !dto.location) {
      addressData.location = {
        type: 'Point',
        coordinates: dto.coordinates
      };
    }

    // If this is set as default, unset other default addresses
    if (dto.isDefault) {
      await this.addressModel.updateMany(
        { userId: dto.userId },
        { isDefault: false }
      );
    }

    // Set as default if first address
    if (!dto.hasOwnProperty('isDefault')) {
      const existingCount = await this.addressModel.countDocuments({ userId: dto.userId });
      if (existingCount === 0) {
        addressData.isDefault = true;
      }
    }

    const address = new this.addressModel(addressData);
    return address.save();
  }

  async findAllByUser(userId: string): Promise<Address[]> {
    return this.addressModel.find({ userId }).exec();
  }

  async findById(id: string): Promise<Address> {
    const address = await this.addressModel.findById(id).exec();
    if (!address) throw new NotFoundException('Address not found');
    return address;
  }

  async update(id: string, dto: UpdateAddressDto): Promise<Address> {
    // If updating to default, unset other defaults
    if (dto.isDefault) {
      const address = await this.findById(id);
      await this.addressModel.updateMany(
        { userId: address.userId, _id: { $ne: id } },
        { isDefault: false }
      );
    }
    
    const updated = await this.addressModel.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!updated) throw new NotFoundException('Address not found');
    return updated;
  }

  async delete(id: string): Promise<Address> {
    const removed = await this.addressModel.findByIdAndDelete(id).exec();
    if (!removed) throw new NotFoundException('Address not found');
    return removed;
  }

  async setDefault(id: string): Promise<Address> {
    const address = await this.addressModel.findById(id).exec();
    if (!address) throw new NotFoundException('Address not found');

    await this.addressModel.updateMany(
      { userId: address.userId },
      { isDefault: false }
    );

    address.isDefault = true;
    return address.save();
  }

  // New methods for address-first architecture
  async updateUsage(id: string): Promise<void> {
    await this.addressModel.updateOne(
      { _id: id },
      {
        $inc: { usageCount: 1 },
        $set: { lastUsedAt: new Date() }
      }
    );
  }

  async suggestAddresses(partial: string, userId: string): Promise<Address[]> {
    // Simple text search on user's existing addresses
    const userAddresses = await this.addressModel
      .find({
        userId,
        isActive: true,
        $or: [
          { addressLine1: { $regex: partial, $options: 'i' } },
          { village: { $regex: partial, $options: 'i' } },
          { customLabel: { $regex: partial, $options: 'i' } }
        ]
      })
      .sort({ usageCount: -1 })
      .limit(5)
      .exec();

    return userAddresses;
  }

  async findNearbyAddresses(
    coordinates: [number, number],
    radiusKm: number,
    filters?: { addressType?: string; serviceCategories?: string[] }
  ): Promise<Address[]> {
    const query: any = {
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates },
          $maxDistance: radiusKm * 1000 // Convert to meters
        }
      },
      isActive: true
    };

    if (filters?.addressType) {
      query.addressType = filters.addressType;
    }

    if (filters?.serviceCategories) {
      query.serviceCategories = { $in: filters.serviceCategories };
    }

    return this.addressModel.find(query).limit(50).exec();
  }
}