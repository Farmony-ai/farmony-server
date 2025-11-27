import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument, Address } from '../schemas/users.schema';
import { CreateAddressDto } from '../dto/create-address.dto';
import { UpdateAddressDto } from '../dto/update-address.dto';

@Injectable()
export class AddressService {
    constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

    private async findUserById(userId: string): Promise<UserDocument> {
        const user = await this.userModel.findById(userId).exec();
        if (!user) {
            throw new NotFoundException('User not found');
        }
        return user;
    }

    private validateObjectId(id: string, fieldName = 'ID'): void {
        if (!Types.ObjectId.isValid(id)) {
            throw new BadRequestException(`Invalid ${fieldName} format`);
        }
    }

    private findAddressIndex(user: UserDocument, addressId: string): number {
        const index = user.addresses.findIndex((addr) => addr._id?.toString() === addressId);
        if (index === -1) {
            throw new NotFoundException('Address not found');
        }
        return index;
    }

    private clearDefaultFlags(user: UserDocument): void {
        for (const addr of user.addresses) {
            addr.isDefault = false;
        }
    }

    async getUserAddresses(userId: string): Promise<Address[]> {
        const user = await this.findUserById(userId);
        return user.addresses || [];
    }

    async getAddressById(userId: string, addressId: string): Promise<Address> {
        this.validateObjectId(addressId, 'address ID');
        const user = await this.findUserById(userId);
        const index = this.findAddressIndex(user, addressId);
        return user.addresses[index];
    }

    async createAddress(userId: string, dto: CreateAddressDto): Promise<Address> {
        const user = await this.findUserById(userId);

        const isFirstAddress = !user.addresses?.length;
        const shouldBeDefault = dto.isDefault || isFirstAddress;

        if (shouldBeDefault && user.addresses?.length) {
            this.clearDefaultFlags(user);
        }

        const newAddress = {
            _id: new Types.ObjectId(),
            addressType: dto.addressType || 'other',
            customLabel: dto.customLabel,
            addressLine1: dto.addressLine1,
            addressLine2: dto.addressLine2,
            village: dto.village,
            tehsil: dto.tehsil,
            district: dto.district,
            state: dto.state,
            pincode: dto.pincode,
            accuracy: dto.accuracy,
            isDefault: shouldBeDefault,
            isActive: dto.isActive ?? true,
            isVerified: false,
            accessInstructions: dto.accessInstructions,
            serviceCategories: dto.serviceCategories?.map((id) => new Types.ObjectId(id)) || [],
            usageCount: 0,
            location: dto.location?.coordinates?.length === 2
                ? { type: 'Point' as const, coordinates: dto.location.coordinates }
                : undefined,
        } as Address;

        user.addresses.push(newAddress);

        if (shouldBeDefault) {
            user.defaultAddressId = newAddress._id;
        }

        await user.save();
        return newAddress;
    }

    async updateAddress(userId: string, addressId: string, dto: UpdateAddressDto): Promise<Address> {
        this.validateObjectId(addressId, 'address ID');
        const user = await this.findUserById(userId);
        const index = this.findAddressIndex(user, addressId);

        if (dto.isDefault === true) {
            this.clearDefaultFlags(user);
            user.defaultAddressId = user.addresses[index]._id;
        }

        const currentAddr = user.addresses[index];
        Object.assign(currentAddr, {
            ...dto,
            _id: currentAddr._id,
        });

        await user.save();
        return user.addresses[index];
    }

    async deleteAddress(userId: string, addressId: string): Promise<void> {
        this.validateObjectId(addressId, 'address ID');
        const user = await this.findUserById(userId);
        const index = this.findAddressIndex(user, addressId);

        const wasDefault = user.addresses[index].isDefault;
        user.addresses.splice(index, 1);

        if (wasDefault && user.addresses.length > 0) {
            user.addresses[0].isDefault = true;
            user.defaultAddressId = user.addresses[0]._id;
        } else if (user.addresses.length === 0) {
            user.defaultAddressId = undefined;
        }

        await user.save();
    }

    async setDefaultAddress(userId: string, addressId: string): Promise<UserDocument> {
        this.validateObjectId(addressId, 'address ID');
        const user = await this.findUserById(userId);
        this.findAddressIndex(user, addressId);

        this.clearDefaultFlags(user);

        const address = user.addresses.find((addr) => addr._id?.toString() === addressId);
        if (address) {
            address.isDefault = true;
        }

        user.defaultAddressId = new Types.ObjectId(addressId);
        return user.save();
    }
}
