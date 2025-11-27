import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { AddressesService } from '../../modules/addresses/addresses.service';
import {
  IAddressReference,
  IResolvedAddress,
  CreateAddressDto,
  IAddress
} from '../interfaces/address.interface';
import { Address, AddressDocument } from '../../modules/addresses/addresses.schema';

@Injectable()
export class AddressResolverService {
  constructor(
    private readonly addressesService: AddressesService,
  ) {}

  async resolveAddressReference(
    ref: IAddressReference,
    userId: string,
    context?: { saveTemporary?: boolean }
  ): Promise<IResolvedAddress> {

    if (ref.savedAddressId) {
      return this.resolveSavedAddress(ref.savedAddressId, userId);
    }

    if (ref.newAddress) {
      return this.resolveNewAddress(ref.newAddress, userId, context?.saveTemporary);
    }

    if (ref.tempAddress) {
      return this.resolveTempAddress(ref.tempAddress, userId);
    }

    throw new BadRequestException('No valid address reference provided');
  }

  private async resolveSavedAddress(
    addressId: Types.ObjectId | string,
    userId: string
  ): Promise<IResolvedAddress> {
    const address = await this.addressesService.findById(addressId.toString());

    if (address.userId.toString() !== userId) {
      throw new ForbiddenException('Cannot access address belonging to another user');
    }

    // Update usage tracking
    await this.addressesService.updateUsage(addressId.toString());

    return {
      addressId: (address as any)._id,
      address,
      coordinates: this.getCoordinates(address),
      formattedAddress: this.formatAddress(address),
    };
  }

  private async resolveNewAddress(
    dto: CreateAddressDto,
    userId: string,
    saveTemporary = false
  ): Promise<IResolvedAddress> {

    if (saveTemporary) {
      // Save as permanent address for future reuse
      const address = await this.addressesService.create({
        ...dto,
        userId,
      });
      return {
        addressId: (address as any)._id,
        address,
        coordinates: this.getCoordinates(address),
        formattedAddress: this.formatAddress(address),
      };
    } else {
      // Create temporary address object (not saved)
      const tempAddress = {
        ...dto,
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(userId),
        location: {
          type: 'Point' as const,
          coordinates: dto.coordinates
        },
        isActive: true,
        isDefault: false,
        isVerified: false,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      return {
        addressId: tempAddress._id,
        address: tempAddress,
        coordinates: dto.coordinates as [number, number],
        formattedAddress: this.formatAddress(tempAddress),
      };
    }
  }

  private async resolveTempAddress(
    dto: CreateAddressDto & { temporary: true },
    userId: string
  ): Promise<IResolvedAddress> {
    // Handle temporary address without saving
    const tempAddress = {
      ...dto,
      _id: new Types.ObjectId(),
      userId: new Types.ObjectId(userId),
      location: {
        type: 'Point' as const,
        coordinates: dto.coordinates
      },
      isActive: true,
      isDefault: false,
      isVerified: false,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    return {
      addressId: tempAddress._id,
      address: tempAddress,
      coordinates: dto.coordinates as [number, number],
      formattedAddress: this.formatAddress(tempAddress),
    };
  }

  formatAddress(address: any): string {
    return [
      address.customLabel,
      address.addressLine1,
      address.addressLine2,
      address.village,
      address.tehsil,
      address.district,
      address.state,
      address.pincode
    ].filter(Boolean).join(', ');
  }

  async calculateDistance(
    from: IResolvedAddress,
    to: IResolvedAddress
  ): Promise<number> {
    // Haversine formula implementation
    const R = 6371e3; // Earth's radius in meters
    const φ1 = from.coordinates[1] * Math.PI/180;
    const φ2 = to.coordinates[1] * Math.PI/180;
    const Δφ = (to.coordinates[1] - from.coordinates[1]) * Math.PI/180;
    const Δλ = (to.coordinates[0] - from.coordinates[0]) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  }

  private getCoordinates(address: Address): [number, number] {
    // Handle both new location field and legacy coordinates field
    if (address.location && address.location.coordinates) {
      return address.location.coordinates as [number, number];
    }
    if (address.coordinates) {
      return address.coordinates as [number, number];
    }
    return [0, 0]; // Default fallback
  }
}