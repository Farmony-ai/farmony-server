import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../../identity/schemas/users.schema';

/**
 * GeoService handles geocoding, address resolution, and geographic utilities
 * Integrates with Google Maps API for geocoding operations
 *
 * According to the architecture (docs/02-architecture-overview.md):
 * - Addresses are embedded in User schema (User.addresses[])
 * - This service provides geocoding utilities
 * - Google Maps API is used for address validation and geocoding
 */
@Injectable()
export class GeoService {
    private readonly logger = new Logger(GeoService.name);
    private readonly googleMapsApiKey: string;
    private readonly googleMapsBaseUrl = 'https://maps.googleapis.com/maps/api/geocode/json';

    constructor(
        private readonly configService: ConfigService,
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>
    ) {
        this.googleMapsApiKey = this.configService.get<string>('GOOGLE_MAPS_API_KEY', '');

        if (!this.googleMapsApiKey) {
            this.logger.warn('GOOGLE_MAPS_API_KEY not configured - geocoding will be disabled');
        }
    }

    /**
     * Geocode an address string to coordinates using Google Maps API
     * @param address - Address string to geocode
     * @returns Coordinates [longitude, latitude] or null if not found
     */
    async geocodeAddress(address: string): Promise<[number, number] | null> {
        if (!this.googleMapsApiKey) {
            this.logger.warn('Geocoding disabled - no API key configured');
            return null;
        }

        try {
            const url = `${this.googleMapsBaseUrl}?address=${encodeURIComponent(address)}&key=${this.googleMapsApiKey}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.status === 'OK' && data.results.length > 0) {
                const location = data.results[0].geometry.location;
                return [location.lng, location.lat]; // GeoJSON format: [longitude, latitude]
            }

            this.logger.warn(`Geocoding failed for address: ${address}, status: ${data.status}`);
            return null;
        } catch (error) {
            this.logger.error(`Error geocoding address: ${address}`, error);
            return null;
        }
    }

    /**
     * Reverse geocode coordinates to formatted address
     * @param latitude - Latitude
     * @param longitude - Longitude
     * @returns Formatted address string or null
     */
    async reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
        if (!this.googleMapsApiKey) {
            this.logger.warn('Reverse geocoding disabled - no API key configured');
            return null;
        }

        try {
            const url = `${this.googleMapsBaseUrl}?latlng=${latitude},${longitude}&key=${this.googleMapsApiKey}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.status === 'OK' && data.results.length > 0) {
                return data.results[0].formatted_address;
            }

            this.logger.warn(`Reverse geocoding failed for coordinates: ${latitude}, ${longitude}`);
            return null;
        } catch (error) {
            this.logger.error(`Error reverse geocoding coordinates: ${latitude}, ${longitude}`, error);
            return null;
        }
    }

    /**
     * Get address from user's embedded addresses array
     * @param userId - User ID
     * @param addressId - Address ID within user's addresses array
     * @returns Address with coordinates
     */
    async getUserAddress(userId: string, addressId: string): Promise<{
        _id: string;
        location: { type: 'Point'; coordinates: [number, number] };
        addressLine1: string;
        addressLine2?: string;
        village?: string;
        district?: string;
        state?: string;
        pincode?: string;
    } | null> {
        try {
            const user = await this.userModel.findById(userId).select('addresses').lean().exec();

            if (!user || !user.addresses) {
                return null;
            }

            const address = user.addresses.find((addr: any) => addr._id.toString() === addressId);

            if (!address) {
                return null;
            }

            return address as any;
        } catch (error) {
            this.logger.error(`Error fetching user address: ${userId}/${addressId}`, error);
            return null;
        }
    }

    /**
     * Get user's default address or first active address
     * @param userId - User ID
     * @returns Default address or null
     */
    async getDefaultAddress(userId: string): Promise<{
        _id: string;
        location: { type: 'Point'; coordinates: [number, number] };
        addressLine1: string;
    } | null> {
        try {
            const user = await this.userModel.findById(userId).select('addresses defaultAddressId').lean().exec();

            if (!user || !user.addresses || user.addresses.length === 0) {
                return null;
            }

            // Try to find default address
            if (user.defaultAddressId) {
                const defaultAddr = user.addresses.find((addr: any) =>
                    addr._id.toString() === user.defaultAddressId?.toString()
                );
                if (defaultAddr) {
                    return defaultAddr as any;
                }
            }

            // Fall back to first active address
            const firstActive = user.addresses.find((addr: any) => addr.isActive !== false);
            return firstActive as any || null;
        } catch (error) {
            this.logger.error(`Error fetching default address for user: ${userId}`, error);
            return null;
        }
    }

    /**
     * Resolve address for service request creation
     * Handles addressId or creates from coordinates if needed
     */
    async resolveForServiceRequestCreate(
        seekerId: string,
        createDto: any // Accepts CreateServiceRequestDto or any DTO with addressId and/or location
    ): Promise<{ serviceAddressId: string; coordinates: [number, number] }> {
        // Option 1: Address ID provided - get from user's addresses
        if (createDto.addressId) {
            const address = await this.getUserAddress(seekerId, createDto.addressId);
            if (!address) {
                throw new BadRequestException(`Address ${createDto.addressId} not found for user`);
            }

            if (!address.location?.coordinates) {
                throw new BadRequestException('Address does not have valid coordinates');
            }

            return {
                serviceAddressId: address._id.toString(),
                coordinates: address.location.coordinates
            };
        }

        // Option 2: Coordinates provided - use directly
        if (createDto.location?.coordinates) {
            const coords = createDto.location.coordinates;

            if (!this.isValidCoordinates(coords)) {
                throw new BadRequestException('Invalid coordinates provided');
            }

            // For coordinates without addressId, we use a special identifier
            // The actual address will be resolved via reverse geocoding if needed
            return {
                serviceAddressId: 'coordinates-only',
                coordinates: [coords[0], coords[1]]
            };
        }

        // Option 3: No address specified - use default
        const defaultAddress = await this.getDefaultAddress(seekerId);
        if (!defaultAddress) {
            throw new BadRequestException('No address provided and no default address found');
        }

        return {
            serviceAddressId: defaultAddress._id.toString(),
            coordinates: defaultAddress.location.coordinates
        };
    }

    /**
     * Resolve address for service request update
     */
    async resolveForServiceRequestUpdate(
        userId: string,
        addressId: string
    ): Promise<{ serviceAddressId: string; coordinates: [number, number] }> {
        const address = await this.getUserAddress(userId, addressId);

        if (!address) {
            throw new BadRequestException(`Address ${addressId} not found for user`);
        }

        if (!address.location?.coordinates) {
            throw new BadRequestException('Address does not have valid coordinates');
        }

        return {
            serviceAddressId: address._id.toString(),
            coordinates: address.location.coordinates
        };
    }

    /**
     * Validate coordinates format
     */
    private isValidCoordinates(coords: any): boolean {
        return (
            Array.isArray(coords) &&
            coords.length === 2 &&
            typeof coords[0] === 'number' &&
            typeof coords[1] === 'number' &&
            coords[0] >= -180 && coords[0] <= 180 && // longitude
            coords[1] >= -90 && coords[1] <= 90      // latitude
        );
    }

    /**
     * Get or create address by coordinates for listings
     * Since addresses are embedded in User, this returns a formatted address object
     */
    async getAddressByCoordinates(
        userId: string,
        coordinates: [number, number],
        addressData: {
            addressLine1?: string;
            village?: string;
            district?: string;
            state?: string;
            pincode?: string;
        }
    ): Promise<{
        _id: string;
        location: { type: 'Point'; coordinates: [number, number] };
        addressLine1: string;
    }> {
        // Check if user already has an address with these coordinates
        const user = await this.userModel.findById(userId).select('addresses').lean().exec();

        if (user?.addresses) {
            const existingAddr = user.addresses.find((addr: any) => {
                if (!addr.location?.coordinates) return false;
                const [lng, lat] = addr.location.coordinates;
                return Math.abs(lng - coordinates[0]) < 0.0001 && Math.abs(lat - coordinates[1]) < 0.0001;
            });

            if (existingAddr) {
                return existingAddr as any;
            }
        }

        // Create new address in user's addresses array
        const newAddress = {
            _id: new Types.ObjectId(),
            addressType: 'other',
            addressLine1: addressData.addressLine1 || 'Service Location',
            village: addressData.village,
            district: addressData.district,
            state: addressData.state,
            pincode: addressData.pincode,
            location: {
                type: 'Point' as const,
                coordinates: coordinates
            },
            isActive: true,
            isDefault: false,
            usageCount: 0
        };

        await this.userModel.updateOne(
            { _id: userId },
            { $push: { addresses: newAddress } }
        );

        return newAddress as any;
    }
}
