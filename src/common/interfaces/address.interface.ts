import { Types } from 'mongoose';

export interface IAddress {
  addressLine1: string;
  addressLine2?: string;
  village: string;
  tehsil?: string;
  district: string;
  state: string;
  pincode: string;
  coordinates: [number, number]; // [longitude, latitude]
  addressType?: string;
  customLabel?: string;
}

export interface IAddressReference {
  savedAddressId?: Types.ObjectId | string;
  newAddress?: CreateAddressDto;
  tempAddress?: CreateAddressDto & { temporary: true };
}

export interface IResolvedAddress {
  addressId: Types.ObjectId | string;
  address: any; // Will be Address type
  coordinates: [number, number];
  formattedAddress: string;
  distanceFromUser?: number; // meters
}

export interface CreateAddressDto {
  addressType: string;
  customLabel?: string;
  addressLine1: string;
  addressLine2?: string;
  village: string;
  tehsil?: string;
  district: string;
  state: string;
  pincode: string;
  coordinates: [number, number];
  accuracy?: number;
  serviceCategories?: string[];
  accessInstructions?: string;
  isDefault?: boolean;
}