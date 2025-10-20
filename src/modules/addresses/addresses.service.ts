import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Address, AddressDocument } from './addresses.schema';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { AddressType } from '../../common/interfaces/address.interface';

@Injectable()
export class AddressesService {
  constructor(
    @InjectModel(Address.name) private addressModel: Model<AddressDocument>,
  ) {}

  async create(dto: Partial<CreateAddressDto> & { userId: string }): Promise<AddressDocument> {
    const addressType = this.resolveAddressType(dto);
    if (!addressType) {
      throw new BadRequestException('addressType is required');
    }

    const coordinates = this.extractCoordinatesFromPayload(dto);
    if (!coordinates) {
      throw new BadRequestException('Invalid coordinates format. Expected [longitude, latitude]');
    }

    const addressData: any = {
      ...dto,
      addressType,
      location: {
        type: 'Point',
        coordinates,
      },
      coordinates,
    };

    delete addressData.tag;

    if (dto.isDefault) {
      await this.addressModel.updateMany(
        { userId: dto.userId },
        { isDefault: false },
      );
    }

    if (!Object.prototype.hasOwnProperty.call(dto, 'isDefault')) {
      const existingCount = await this.addressModel.countDocuments({ userId: dto.userId });
      if (existingCount === 0) {
        addressData.isDefault = true;
      }
    }

    const address = new this.addressModel(addressData);
    return address.save();
  }

  async findAllByUser(userId: string): Promise<AddressDocument[]> {
    return this.addressModel.find({ userId }).exec();
  }

  async findById(id: string): Promise<AddressDocument> {
    const address = await this.addressModel.findById(id).exec();
    if (!address) throw new NotFoundException('Address not found');
    return address;
  }

  async update(id: string, dto: UpdateAddressDto): Promise<AddressDocument> {
    const updateData: any = { ...dto };

    if (dto.isDefault) {
      const current = await this.findById(id);
      await this.addressModel.updateMany(
        { userId: current.userId, _id: { $ne: id } },
        { isDefault: false },
      );
    }

    const addressType = this.resolveAddressType(updateData, { optional: true });
    if (addressType) {
      updateData.addressType = addressType;
    }

    const coordinates = this.extractCoordinatesFromPayload(updateData, { required: false });
    if (coordinates) {
      updateData.location = {
        type: 'Point',
        coordinates,
      };
      updateData.coordinates = coordinates;
    } else {
      delete updateData.location;
      delete updateData.coordinates;
    }

    delete updateData.tag;

    const updated = await this.addressModel.findByIdAndUpdate(id, updateData, { new: true }).exec();
    if (!updated) {
      throw new NotFoundException('Address not found');
    }

    await this.ensureGeoConsistency(updated);
    return updated;
  }

  async delete(id: string): Promise<AddressDocument> {
    const removed = await this.addressModel.findByIdAndDelete(id).exec();
    if (!removed) throw new NotFoundException('Address not found');
    return removed;
  }

  async setDefault(id: string): Promise<AddressDocument> {
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

  async suggestAddresses(partial: string, userId: string): Promise<AddressDocument[]> {
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
    filters?: { addressType?: AddressType; serviceCategories?: string[] }
  ): Promise<AddressDocument[]> {
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

  async createFromCoordinates(
    userId: string,
    coordinates: [number, number],
    additionalData?: Partial<CreateAddressDto>
  ): Promise<AddressDocument> {
    if (!this.validateCoordinates(coordinates)) {
      throw new BadRequestException('Invalid coordinates format. Expected [longitude, latitude]');
    }

    const payload: Partial<CreateAddressDto> & { userId: string } = {
      userId,
      addressType:
        additionalData?.addressType ||
        (additionalData && (additionalData as any).tag) ||
        AddressType.SERVICE_AREA,
      addressLine1: additionalData?.addressLine1 || 'Service Location',
      village: additionalData?.village || 'Not Specified',
      district: additionalData?.district || 'Not Specified',
      state: additionalData?.state || 'Not Specified',
      pincode: additionalData?.pincode || '000000',
      coordinates,
      customLabel: additionalData?.customLabel,
      tehsil: additionalData?.tehsil,
      accuracy: additionalData?.accuracy,
      serviceCategories: additionalData?.serviceCategories,
      accessInstructions: additionalData?.accessInstructions,
      isDefault: additionalData?.isDefault ?? false,
      isActive: additionalData?.isActive ?? true,
    };

    return this.create(payload);
  }

  // NEW: Find or create address at coordinates
  async findOrCreateByCoordinates(
    userId: string,
    coordinates: [number, number],
    additionalData?: Partial<CreateAddressDto>
  ): Promise<AddressDocument> {
    if (!this.validateCoordinates(coordinates)) {
      throw new BadRequestException('Invalid coordinates format. Expected [longitude, latitude]');
    }

    const existing = await this.addressModel.findOne({
      userId: new Types.ObjectId(userId),
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates },
          $maxDistance: 10,
        },
      },
    });

    if (existing) {
      await this.ensureGeoConsistency(existing);
      return existing;
    }

    return this.createFromCoordinates(userId, coordinates, additionalData);
  }

  // NEW: Get user's default service address
  async getDefaultServiceAddress(userId: string): Promise<AddressDocument> {
    // First try to get default address
    let address = await this.addressModel.findOne({
      userId: new Types.ObjectId(userId),
      isDefault: true
    });

    // If no default, get first address
    if (!address) {
      address = await this.addressModel.findOne({
        userId: new Types.ObjectId(userId)
      });
    }

    if (!address) {
      throw new NotFoundException('No address found for user. Please add an address first.');
    }

    await this.ensureGeoConsistency(address);
    return address;
  }

  // NEW: Get address with coordinates validation
  async getValidatedAddress(addressId: string): Promise<AddressDocument> {
    const address = await this.addressModel.findById(addressId).exec();

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    const coordinates = this.extractCoordinatesFromAddress(address);
    if (!coordinates) {
      throw new BadRequestException('Address has invalid coordinates');
    }

    await this.ensureGeoConsistency(address);
    return address;
  }

  // NEW: Validate coordinates format
  private validateCoordinates(coordinates: any): boolean {
    return Array.isArray(coordinates) &&
           coordinates.length === 2 &&
           typeof coordinates[0] === 'number' &&
           typeof coordinates[1] === 'number' &&
           coordinates[0] >= -180 && coordinates[0] <= 180 && // longitude
           coordinates[1] >= -90 && coordinates[1] <= 90;     // latitude
  }

  // NEW: Find addresses within radius
  async findAddressesInRadius(
    centerCoordinates: [number, number],
    radiusKm: number,
    filters?: { userId?: string; addressType?: AddressType; tag?: AddressType }
  ): Promise<AddressDocument[]> {
    const query: any = {
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: centerCoordinates
          },
          $maxDistance: radiusKm * 1000 // Convert km to meters
        }
      }
    };

    if (filters?.userId) {
      query.userId = new Types.ObjectId(filters.userId);
    }

    const addressType = filters?.addressType || filters?.tag;
    if (addressType) {
      query.addressType = addressType;
    }

    return this.addressModel.find(query).exec();
  }

  private resolveAddressType(
    dto: Partial<CreateAddressDto> & { addressType?: AddressType; tag?: AddressType },
    options: { optional?: boolean } = {},
  ): AddressType | null {
    const addressType = dto.addressType || dto.tag || null;

    if (!addressType) {
      if (options.optional) {
        return null;
      }
      throw new BadRequestException('addressType is required');
    }

    return addressType;
  }

  private extractCoordinatesFromPayload(
    dto: Partial<CreateAddressDto> & { coordinates?: any; location?: { coordinates?: any } },
    options: { required?: boolean } = { required: true },
  ): [number, number] | null {
    if (dto.location?.coordinates && this.validateCoordinates(dto.location.coordinates)) {
      return dto.location.coordinates as [number, number];
    }

    if (dto.coordinates && this.validateCoordinates(dto.coordinates)) {
      return dto.coordinates as [number, number];
    }

    if (options.required) {
      throw new BadRequestException('Invalid coordinates format. Expected [longitude, latitude]');
    }

    return null;
  }

  private extractCoordinatesFromAddress(address: Address | AddressDocument): [number, number] | null {
    if (address.location?.coordinates && this.validateCoordinates(address.location.coordinates)) {
      return address.location.coordinates as [number, number];
    }

    if (this.validateCoordinates(address.coordinates)) {
      return address.coordinates as [number, number];
    }

    return null;
  }

  private async ensureGeoConsistency(address: AddressDocument): Promise<AddressDocument> {
    const coordinates = this.extractCoordinatesFromAddress(address);
    if (!coordinates) {
      throw new BadRequestException('Address has invalid coordinates');
    }

    let changed = false;

    if (!address.addressType) {
      const legacyTag = (address as any).tag;
      address.addressType =
        legacyTag && Object.values(AddressType).includes(legacyTag as AddressType)
          ? (legacyTag as AddressType)
          : AddressType.OTHER;
      changed = true;
    }

    const hasValidLocation =
      address.location?.coordinates && this.validateCoordinates(address.location.coordinates);
    if (!hasValidLocation) {
      address.location = {
        type: 'Point',
        coordinates,
      } as any;
      changed = true;
    }

    const hasValidLegacyCoordinates =
      address.coordinates && this.validateCoordinates(address.coordinates);
    if (!hasValidLegacyCoordinates) {
      address.coordinates = coordinates;
      changed = true;
    }

    if (changed) {
      await address.save();
    }

    return address;
  }
}
